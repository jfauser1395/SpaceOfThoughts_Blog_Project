namespace SpaceOfThoughts.API.Models.DTOs
{
    // DTO representing settings for the public blogs summary page
    public class BlogSummaryPageDto
    {
        // Unique identifier for the blogs summary page settings
        public Guid Id { get; set; }

        // Optional background image URL for the blogs summary page
        public string? BackgroundImageUrl { get; set; }

        // Saved "x% y% zoom%" framing applied to the background picture
        public string? BackgroundImagePosition { get; set; }

        // Date and time when the blogs summary page was last updated
        public DateTime UpdatedAt { get; set; }
    }
}
