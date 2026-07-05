using System.ComponentModel.DataAnnotations;

namespace SpaceOfThoughts.API.Models.DTOs
{
    // DTO for creating a new blog comment or reply
    public class CreateBlogCommentRequestDto
    {
        // Comment content entered by the user
        [Required]
        [StringLength(2000, MinimumLength = 1)]
        public required string Content { get; set; }

        // Parent comment ID when creating a reply
        public Guid? ParentCommentId { get; set; }
    }
}
