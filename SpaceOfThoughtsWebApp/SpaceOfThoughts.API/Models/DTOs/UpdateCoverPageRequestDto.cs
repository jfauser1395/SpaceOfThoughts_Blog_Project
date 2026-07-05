namespace SpaceOfThoughts.API.Models.DTOs
{
    // DTO for updating the editable cover page content
    public class UpdateCoverPageRequestDto
    {
        // Main welcome title displayed on the cover page
        public required string WelcomeTitle { get; set; }

        // Introductory text displayed below the welcome title
        public required string Introduction { get; set; }

        // Optional background image URL for the cover page
        public string? BackgroundImageUrl { get; set; }
    }
}
