namespace SpaceOfThoughts.API.Models.DTOs
{
    // DTO representing the public cover page response
    public class CoverPageDto
    {
        // Unique identifier for the cover page
        public Guid Id { get; set; }

        // Short introductory label displayed above the welcome title
        public required string Kicker { get; set; }

        // Main welcome title displayed on the cover page
        public required string WelcomeTitle { get; set; }

        // Introductory text displayed below the welcome title
        public required string Introduction { get; set; }

        // Optional background image URL for the cover page
        public string? BackgroundImageUrl { get; set; }

        // Saved "x% y% zoom%" framing applied to the cover background image
        public string? BackgroundImagePosition { get; set; }

        // Strength of the translucent gradient placed over the cover background
        public int BackgroundOverlayStrength { get; set; }

        // Date and time when the cover page was last updated
        public DateTime UpdatedAt { get; set; }
    }
}
