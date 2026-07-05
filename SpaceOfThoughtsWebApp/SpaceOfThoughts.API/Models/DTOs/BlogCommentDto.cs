namespace SpaceOfThoughts.API.Models.DTOs
{
    // DTO representing a blog comment returned to the client
    public class BlogCommentDto
    {
        // Unique identifier for the comment
        public Guid Id { get; set; }

        // Blog post this comment belongs to
        public Guid BlogPostId { get; set; }

        // Parent comment when this comment is a reply
        public Guid? ParentCommentId { get; set; }

        // Comment content entered by the user
        public required string Content { get; set; }

        // Identity user ID of the comment author
        public required string AuthorId { get; set; }

        // Display name of the comment author
        public required string AuthorName { get; set; }

        // Optional profile image URL for the comment author
        public string? AuthorProfileImageUrl { get; set; }

        // Saved profile image position for the comment author
        public string? AuthorProfileImagePosition { get; set; }

        // Date when the comment was created
        public DateTime CreatedAt { get; set; }

        // Number of likes on the comment
        public int LikeCount { get; set; }

        // Number of dislikes on the comment
        public int DislikeCount { get; set; }

        // Current user's reaction to the comment, if any
        public string? UserReaction { get; set; }

        // Replies nested under this comment
        public List<BlogCommentDto> Replies { get; set; } = new();
    }
}
