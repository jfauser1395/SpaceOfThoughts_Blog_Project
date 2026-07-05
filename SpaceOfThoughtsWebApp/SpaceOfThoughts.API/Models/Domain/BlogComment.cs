namespace SpaceOfThoughts.API.Models.Domain
{
    // BlogComment represents a user comment on a blog post
    public class BlogComment
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

        // Date when the comment was created
        public DateTime CreatedAt { get; set; }

        // Blog post navigation property
        public BlogPost? BlogPost { get; set; }

        // Parent comment navigation property
        public BlogComment? ParentComment { get; set; }

        // Replies to this comment
        public ICollection<BlogComment> Replies { get; set; } = new List<BlogComment>();

        // Reactions users have left on this comment
        public ICollection<BlogCommentReaction> Reactions { get; set; } =
            new List<BlogCommentReaction>();
    }
}
