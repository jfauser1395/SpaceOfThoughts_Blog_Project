using System.ComponentModel.DataAnnotations;

namespace SpaceOfThoughts.API.Models.DTOs
{
    // DTO for changing the current user's comment reaction
    public class BlogCommentReactionRequestDto
    {
        // Reaction value sent from the client, either like or dislike
        [Required]
        public required string Reaction { get; set; }
    }
}
