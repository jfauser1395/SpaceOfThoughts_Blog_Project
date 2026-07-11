using SpaceOfThoughts.API.Models.Domain;

namespace SpaceOfThoughts.API.Repositories.Interface
{
    // Interface for managing BlogComment entities
    public interface IBlogCommentRepository
    {
        // Method to get comments for a blog post
        Task<IEnumerable<BlogComment>> GetByBlogPostIdAsync(Guid blogPostId);

        // Method to get one comment for a blog post
        Task<BlogComment?> GetByIdAsync(Guid blogPostId, Guid commentId);

        // Method to create a new blog comment
        Task<BlogComment> CreateAsync(BlogComment blogComment);

        // Mark a comment as deleted without removing its replies
        Task<BlogComment?> SoftDeleteAsync(Guid blogPostId, Guid commentId);

        // Method to get the current depth of a comment in its thread
        Task<int> GetDepthAsync(Guid blogPostId, Guid commentId);

        // Method to toggle a user reaction for a comment
        Task<BlogComment?> ToggleReactionAsync(
            Guid blogPostId,
            Guid commentId,
            string userId,
            BlogCommentReactionType reactionType
        );
    }
}
