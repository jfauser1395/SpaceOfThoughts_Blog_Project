namespace SpaceOfThoughts.API.Models.DTOs
{
    // DTO for updating the editable cover page content
    public class UpdateCoverPageRequestDto
    {
        // Short introductory label displayed above the welcome title
        public required string Kicker { get; set; }

        // Main welcome title displayed on the cover page
        public required string WelcomeTitle { get; set; }

        // Introductory text displayed below the welcome title
        public required string Introduction { get; set; }

        // Optional background image URL for the cover page
        public string? BackgroundImageUrl { get; set; }

        // Framing as "x% y% zoom%"; null restores the centred, unzoomed default
        public string? BackgroundImagePosition { get; set; }

        // Overlay strength as a percentage, constrained to the editor's supported range
        public int BackgroundOverlayStrength { get; set; }
    }
}
