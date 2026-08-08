namespace SpaceOfThoughts.API.Models.DTOs
{
    // DTO for updating blogs summary page settings
    public class UpdateBlogSummaryPageRequestDto
    {
        // Optional background image URL for the blogs summary page
        public string? BackgroundImageUrl { get; set; }

        // Saved "x% y% zoom%" framing applied to the background picture
        public string? BackgroundImagePosition { get; set; }
    }
}
