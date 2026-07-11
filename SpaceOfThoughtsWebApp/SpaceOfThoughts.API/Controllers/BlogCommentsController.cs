using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SpaceOfThoughts.API.Models.Domain;
using SpaceOfThoughts.API.Models.DTOs;
using SpaceOfThoughts.API.Repositories.Interface;

namespace SpaceOfThoughts.API.Controllers
{
    // The BlogCommentsController handles comments for published blog posts
    [Route("api/blogposts/{blogPostId:guid}/comments")]
    [ApiController]
    public class BlogCommentsController : ControllerBase
    {
        // Maximum number of nested replies allowed in one comment thread
        private const int MaxThreadDepth = 10;

        // Claim names used to read profile image data from Identity
        private const string ProfileImageClaimType = "profile_image_url";
        private const string ProfileImagePositionClaimType = "profile_image_position";
        private const string DefaultProfileImagePosition = "50% 50% 100%";
        private const string DeletedAuthorName = "[deleted]";
        private const string DeletedCommentContent = "Comment deleted.";
        private readonly IBlogPostRepository blogPostRepository;
        private readonly IBlogCommentRepository blogCommentRepository;
        private readonly UserManager<IdentityUser> userManager;

        // Constructor to initialize repositories and user manager
        public BlogCommentsController(
            IBlogPostRepository blogPostRepository,
            IBlogCommentRepository blogCommentRepository,
            UserManager<IdentityUser> userManager
        )
        {
            this.blogPostRepository = blogPostRepository;
            this.blogCommentRepository = blogCommentRepository;
            this.userManager = userManager;
        }

        // GET: {apiBaseUrl}/api/blogposts/{blogPostId}/comments - Get comments for a published blog post
        [HttpGet]
        public async Task<IActionResult> GetCommentsForBlogPost([FromRoute] Guid blogPostId)
        {
            // Only return comments for blog posts that are visible to readers
            var blogPost = await blogPostRepository.GetByIdAsync(blogPostId);
            if (blogPost is null || !blogPost.IsVisible)
            {
                return NotFound();
            }

            var comments = (await blogCommentRepository.GetByBlogPostIdAsync(blogPostId)).ToList();
            var currentUserId = await GetCurrentUserIdAsync();
            var authorIds = comments.Select(comment => comment.AuthorId).ToList();

            // Load profile image metadata once per author before building the comment tree
            var authorProfileImageUrls = await GetProfileImageUrlsByUserIdAsync(
                authorIds
            );
            var authorProfileImagePositions = await GetProfileImagePositionsByUserIdAsync(
                authorIds
            );
            var existingAuthorIds = await GetExistingUserIdsAsync(authorIds);

            var response = BuildCommentTree(
                comments,
                currentUserId,
                authorProfileImageUrls,
                authorProfileImagePositions,
                existingAuthorIds
            );

            return Ok(response);
        }

        // POST: {apiBaseUrl}/api/blogposts/{blogPostId}/comments - Add a comment to a published blog post
        [HttpPost]
        [Authorize(Roles = "Reader,Writer")]
        public async Task<IActionResult> CreateCommentForBlogPost(
            [FromRoute] Guid blogPostId,
            [FromBody] CreateBlogCommentRequestDto request
        )
        {
            // Validate the blog post is public before allowing new comments
            var blogPost = await blogPostRepository.GetByIdAsync(blogPostId);
            if (blogPost is null || !blogPost.IsVisible)
            {
                return NotFound();
            }

            var content = request.Content.Trim();
            if (string.IsNullOrWhiteSpace(content))
            {
                ModelState.AddModelError(nameof(request.Content), "Comment content is required");
                return ValidationProblem(ModelState);
            }

            if (request.ParentCommentId.HasValue)
            {
                // Validate the parent comment belongs to this post before creating a reply
                var parentComment = await blogCommentRepository.GetByIdAsync(
                    blogPostId,
                    request.ParentCommentId.Value
                );

                if (parentComment is null)
                {
                    return NotFound();
                }

                // Prevent reply chains from growing beyond the configured thread depth
                var parentDepth = await blogCommentRepository.GetDepthAsync(
                    blogPostId,
                    parentComment.Id
                );

                if (parentDepth >= MaxThreadDepth)
                {
                    ModelState.AddModelError(
                        nameof(request.ParentCommentId),
                        $"Replies can go up to {MaxThreadDepth} comments in a thread."
                    );
                    return ValidationProblem(ModelState);
                }
            }

            var user = await GetCurrentUserAsync();
            if (user is null || string.IsNullOrWhiteSpace(user.UserName))
            {
                return Unauthorized();
            }

            var blogComment = new BlogComment
            {
                BlogPostId = blogPostId,
                ParentCommentId = request.ParentCommentId,
                Content = content,
                AuthorId = user.Id,
                AuthorName = user.UserName,
                CreatedAt = DateTime.UtcNow
            };

            // Save the comment and map it back with the current author's profile metadata
            blogComment = await blogCommentRepository.CreateAsync(blogComment);

            var response = MapComment(
                blogComment,
                user.Id,
                new Dictionary<string, string?> { [user.Id] = await GetProfileImageUrlAsync(user) },
                new Dictionary<string, string?>
                {
                    [user.Id] = await GetProfileImagePositionAsync(user)
                },
                new HashSet<string>(StringComparer.Ordinal) { user.Id }
            );

            return Ok(response);
        }

        // POST: {apiBaseUrl}/api/blogposts/{blogPostId}/comments/{commentId}/reaction - Toggle like or dislike
        [HttpPost("{commentId:guid}/reaction")]
        [Authorize(Roles = "Reader,Writer")]
        public async Task<IActionResult> ToggleReactionForComment(
            [FromRoute] Guid blogPostId,
            [FromRoute] Guid commentId,
            [FromBody] BlogCommentReactionRequestDto request
        )
        {
            // Only allow reactions on blog posts that are visible to readers
            var blogPost = await blogPostRepository.GetByIdAsync(blogPostId);
            if (blogPost is null || !blogPost.IsVisible)
            {
                return NotFound();
            }

            if (!TryParseReaction(request.Reaction, out var reactionType))
            {
                ModelState.AddModelError(nameof(request.Reaction), "Reaction must be like or dislike");
                return ValidationProblem(ModelState);
            }

            var user = await GetCurrentUserAsync();
            if (user is null)
            {
                return Unauthorized();
            }

            // Toggle off the same reaction or switch to the opposite reaction
            var comment = await blogCommentRepository.ToggleReactionAsync(
                blogPostId,
                commentId,
                user.Id,
                reactionType
            );

            if (comment is null)
            {
                return NotFound();
            }

            var authorProfileImageUrl = await GetProfileImageUrlByUserIdAsync(comment.AuthorId);
            var authorProfileImagePosition =
                await GetProfileImagePositionByUserIdAsync(comment.AuthorId);
            var existingAuthorIds = await GetExistingUserIdsAsync(new[] { comment.AuthorId });

            return Ok(
                MapComment(
                    comment,
                    user.Id,
                    new Dictionary<string, string?> { [comment.AuthorId] = authorProfileImageUrl },
                    new Dictionary<string, string?>
                    {
                        [comment.AuthorId] = authorProfileImagePosition
                    },
                    existingAuthorIds
                )
            );
        }

        // DELETE: {apiBaseUrl}/api/blogposts/{blogPostId}/comments/{commentId} - Soft-delete a comment
        [HttpDelete("{commentId:guid}")]
        [Authorize(Roles = "Reader,Writer")]
        public async Task<IActionResult> DeleteCommentForBlogPost(
            [FromRoute] Guid blogPostId,
            [FromRoute] Guid commentId
        )
        {
            var blogPost = await blogPostRepository.GetByIdAsync(blogPostId);
            if (blogPost is null || !blogPost.IsVisible)
            {
                return NotFound();
            }

            var user = await GetCurrentUserAsync();
            if (user is null)
            {
                return Unauthorized();
            }

            var comment = await blogCommentRepository.GetByIdAsync(blogPostId, commentId);
            if (comment is null)
            {
                return NotFound();
            }

            var isWriter = await userManager.IsInRoleAsync(user, "Writer");
            if (comment.AuthorId != user.Id && !isWriter)
            {
                return Forbid();
            }

            var deletedComment = await blogCommentRepository.SoftDeleteAsync(blogPostId, commentId);
            if (deletedComment is null)
            {
                return NotFound();
            }

            var existingAuthorIds = await GetExistingUserIdsAsync(
                new[] { deletedComment.AuthorId }
            );

            return Ok(
                MapComment(
                    deletedComment,
                    user.Id,
                    new Dictionary<string, string?>(),
                    new Dictionary<string, string?>(),
                    existingAuthorIds
                )
            );
        }

        // Get the current authenticated Identity user from the email claim
        private async Task<IdentityUser?> GetCurrentUserAsync()
        {
            var email = User.FindFirstValue(ClaimTypes.Email);
            if (string.IsNullOrWhiteSpace(email))
            {
                return null;
            }

            return await userManager.FindByEmailAsync(email);
        }

        // Get the current authenticated user's ID if a user is logged in
        private async Task<string?> GetCurrentUserIdAsync()
        {
            var user = await GetCurrentUserAsync();
            return user?.Id;
        }

        // Build a lookup of user IDs to profile image URLs
        private async Task<Dictionary<string, string?>> GetProfileImageUrlsByUserIdAsync(
            IEnumerable<string> userIds
        )
        {
            var profileImageUrls = new Dictionary<string, string?>();

            foreach (var userId in userIds.Where(id => !string.IsNullOrWhiteSpace(id)).Distinct())
            {
                profileImageUrls[userId] = await GetProfileImageUrlByUserIdAsync(userId);
            }

            return profileImageUrls;
        }

        // Build a lookup of user IDs to profile image positions
        private async Task<Dictionary<string, string?>> GetProfileImagePositionsByUserIdAsync(
            IEnumerable<string> userIds
        )
        {
            var profileImagePositions = new Dictionary<string, string?>();

            foreach (var userId in userIds.Where(id => !string.IsNullOrWhiteSpace(id)).Distinct())
            {
                profileImagePositions[userId] = await GetProfileImagePositionByUserIdAsync(userId);
            }

            return profileImagePositions;
        }

        // Identify authors whose Identity accounts still exist
        private async Task<HashSet<string>> GetExistingUserIdsAsync(IEnumerable<string> userIds)
        {
            var distinctUserIds = userIds
                .Where(id => !string.IsNullOrWhiteSpace(id))
                .Distinct()
                .ToList();

            if (distinctUserIds.Count == 0)
            {
                return new HashSet<string>(StringComparer.Ordinal);
            }

            var existingUserIds = await userManager
                .Users.Where(user => distinctUserIds.Contains(user.Id))
                .Select(user => user.Id)
                .ToListAsync();

            return existingUserIds.ToHashSet(StringComparer.Ordinal);
        }

        // Get a user's profile image URL from Identity claims
        private async Task<string?> GetProfileImageUrlByUserIdAsync(string userId)
        {
            var user = await userManager.FindByIdAsync(userId);
            if (user is null)
            {
                return null;
            }

            return await GetProfileImageUrlAsync(user);
        }

        // Get a user's saved profile image position from Identity claims
        private async Task<string?> GetProfileImagePositionByUserIdAsync(string userId)
        {
            var user = await userManager.FindByIdAsync(userId);
            if (user is null)
            {
                return DefaultProfileImagePosition;
            }

            return await GetProfileImagePositionAsync(user);
        }

        // Read the profile image URL claim for a user
        private async Task<string?> GetProfileImageUrlAsync(IdentityUser user)
        {
            var claims = await userManager.GetClaimsAsync(user);
            return claims.FirstOrDefault(claim => claim.Type == ProfileImageClaimType)?.Value;
        }

        // Read the profile image position claim for a user
        private async Task<string?> GetProfileImagePositionAsync(IdentityUser user)
        {
            var claims = await userManager.GetClaimsAsync(user);
            return claims.FirstOrDefault(claim => claim.Type == ProfileImagePositionClaimType)?.Value
                ?? DefaultProfileImagePosition;
        }

        // Convert the reaction string from the client into the domain enum
        private static bool TryParseReaction(
            string reaction,
            out BlogCommentReactionType reactionType
        )
        {
            switch (reaction.Trim().ToLowerInvariant())
            {
                case "like":
                    reactionType = BlogCommentReactionType.Like;
                    return true;
                case "dislike":
                    reactionType = BlogCommentReactionType.Dislike;
                    return true;
                default:
                    reactionType = default;
                    return false;
            }
        }

        // Convert a flat comment list into a nested comment tree
        private static List<BlogCommentDto> BuildCommentTree(
            IEnumerable<BlogComment> comments,
            string? currentUserId,
            IReadOnlyDictionary<string, string?> profileImageUrls,
            IReadOnlyDictionary<string, string?> profileImagePositions,
            IReadOnlySet<string> existingAuthorIds
        )
        {
            var orderedComments = comments.OrderBy(comment => comment.CreatedAt).ToList();
            var commentDtos = orderedComments.ToDictionary(
                comment => comment.Id,
                comment => MapComment(
                    comment,
                    currentUserId,
                    profileImageUrls,
                    profileImagePositions,
                    existingAuthorIds
                )
            );
            var rootComments = new List<BlogCommentDto>();

            // Add replies under their parent comments while keeping top-level comments separate
            foreach (var comment in orderedComments)
            {
                var commentDto = commentDtos[comment.Id];

                if (
                    comment.ParentCommentId.HasValue
                    && commentDtos.TryGetValue(comment.ParentCommentId.Value, out var parentDto)
                )
                {
                    parentDto.Replies.Add(commentDto);
                }
                else
                {
                    rootComments.Add(commentDto);
                }
            }

            return rootComments;
        }

        // Convert a BlogComment domain model to DTO with reactions and author profile metadata
        private static BlogCommentDto MapComment(
            BlogComment comment,
            string? currentUserId,
            IReadOnlyDictionary<string, string?> profileImageUrls,
            IReadOnlyDictionary<string, string?> profileImagePositions,
            IReadOnlySet<string> existingAuthorIds
        )
        {
            string? userReaction = null;
            var isAuthorDeleted = !existingAuthorIds.Contains(comment.AuthorId);
            profileImageUrls.TryGetValue(
                comment.AuthorId,
                out var authorProfileImageUrl
            );
            profileImagePositions.TryGetValue(
                comment.AuthorId,
                out var authorProfileImagePosition
            );

            if (!comment.IsDeleted && !string.IsNullOrWhiteSpace(currentUserId))
            {
                // Include the current user's reaction so the UI can mark the active button
                var reaction = comment.Reactions.FirstOrDefault(reaction =>
                    reaction.UserId == currentUserId
                );

                userReaction = reaction?.ReactionType switch
                {
                    BlogCommentReactionType.Like => "like",
                    BlogCommentReactionType.Dislike => "dislike",
                    _ => null
                };
            }

            return new BlogCommentDto
            {
                Id = comment.Id,
                BlogPostId = comment.BlogPostId,
                ParentCommentId = comment.ParentCommentId,
                Content = comment.IsDeleted ? DeletedCommentContent : comment.Content,
                AuthorId = comment.AuthorId,
                AuthorName = comment.IsDeleted || isAuthorDeleted
                    ? DeletedAuthorName
                    : comment.AuthorName,
                AuthorProfileImageUrl = comment.IsDeleted || isAuthorDeleted
                    ? null
                    : authorProfileImageUrl,
                AuthorProfileImagePosition =
                    authorProfileImagePosition ?? DefaultProfileImagePosition,
                CreatedAt = comment.CreatedAt,
                IsDeleted = comment.IsDeleted,
                IsAuthorDeleted = isAuthorDeleted,
                LikeCount = comment.Reactions.Count(reaction =>
                    reaction.ReactionType == BlogCommentReactionType.Like
                ),
                DislikeCount = comment.Reactions.Count(reaction =>
                    reaction.ReactionType == BlogCommentReactionType.Dislike
                ),
                UserReaction = userReaction,
                Replies = new List<BlogCommentDto>()
            };
        }
    }
}
