namespace SpaceOfThoughts.API.Models.Domain
{
    // BlogCommentReaction represents a user's like or dislike on a blog comment
    public class BlogCommentReaction
    {
        // Unique identifier for the reaction
        public Guid Id { get; set; }

        // Comment this reaction belongs to
        public Guid BlogCommentId { get; set; }

        // Identity user ID of the reacting user
        public required string UserId { get; set; }

        // Type of reaction the user selected
        public BlogCommentReactionType ReactionType { get; set; }

        // Date when the reaction was created
        public DateTime CreatedAt { get; set; }

        // Comment navigation property
        public BlogComment? BlogComment { get; set; }
    }
}
