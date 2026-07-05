using Microsoft.EntityFrameworkCore;
using SpaceOfThoughts.API.Data;
using SpaceOfThoughts.API.Models.Domain;
using SpaceOfThoughts.API.Repositories.Interface;

namespace SpaceOfThoughts.API.Repositories.Implementation
{
    // BlogCommentRepository handles operations for BlogComment entities
    public class BlogCommentRepository : IBlogCommentRepository
    {
        private readonly ApplicationDbContext dbContext;

        public BlogCommentRepository(ApplicationDbContext dbContext)
        {
            this.dbContext = dbContext;
        }

        // Get all comments for a blog post
        public async Task<IEnumerable<BlogComment>> GetByBlogPostIdAsync(Guid blogPostId)
        {
            return await dbContext
                .BlogComments.Where(comment => comment.BlogPostId == blogPostId)
                .Include(comment => comment.Reactions)
                .OrderBy(comment => comment.CreatedAt)
                .ToListAsync();
        }

        // Get one comment for a blog post
        public async Task<BlogComment?> GetByIdAsync(Guid blogPostId, Guid commentId)
        {
            return await dbContext
                .BlogComments.Include(comment => comment.Reactions)
                .FirstOrDefaultAsync(comment =>
                    comment.BlogPostId == blogPostId && comment.Id == commentId
                );
        }

        // Create a new blog comment
        public async Task<BlogComment> CreateAsync(BlogComment blogComment)
        {
            await dbContext.BlogComments.AddAsync(blogComment);
            await dbContext.SaveChangesAsync();
            return blogComment;
        }

        // Get the current depth of a comment in its thread
        public async Task<int> GetDepthAsync(Guid blogPostId, Guid commentId)
        {
            var depth = 0;
            Guid? currentCommentId = commentId;

            while (currentCommentId.HasValue)
            {
                var currentComment = await dbContext
                    .BlogComments.AsNoTracking()
                    .Select(comment => new
                    {
                        comment.Id,
                        comment.BlogPostId,
                        comment.ParentCommentId
                    })
                    .FirstOrDefaultAsync(comment => comment.Id == currentCommentId.Value);

                if (currentComment is null || currentComment.BlogPostId != blogPostId)
                {
                    break;
                }

                depth++;
                currentCommentId = currentComment.ParentCommentId;
            }

            return depth;
        }

        // Toggle a user reaction for a comment
        public async Task<BlogComment?> ToggleReactionAsync(
            Guid blogPostId,
            Guid commentId,
            string userId,
            BlogCommentReactionType reactionType
        )
        {
            var comment = await dbContext
                .BlogComments.Include(comment => comment.Reactions)
                .FirstOrDefaultAsync(comment =>
                    comment.BlogPostId == blogPostId && comment.Id == commentId
                );

            if (comment is null)
            {
                return null;
            }

            var existingReaction = comment.Reactions.FirstOrDefault(reaction =>
                reaction.UserId == userId
            );

            if (existingReaction is null)
            {
                await dbContext.BlogCommentReactions.AddAsync(
                    new BlogCommentReaction
                    {
                        BlogCommentId = commentId,
                        UserId = userId,
                        ReactionType = reactionType,
                        CreatedAt = DateTime.UtcNow
                    }
                );
            }
            else if (existingReaction.ReactionType == reactionType)
            {
                dbContext.BlogCommentReactions.Remove(existingReaction);
            }
            else
            {
                existingReaction.ReactionType = reactionType;
            }

            await dbContext.SaveChangesAsync();

            return await GetByIdAsync(blogPostId, commentId);
        }
    }
}
