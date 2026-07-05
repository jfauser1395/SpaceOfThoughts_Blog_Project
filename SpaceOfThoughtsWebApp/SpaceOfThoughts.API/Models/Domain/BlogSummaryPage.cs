namespace SpaceOfThoughts.API.Models.Domain
{
    // BlogSummaryPage represents display settings for the public blogs summary page
    public class BlogSummaryPage
    {
        // Unique identifier for the blogs summary page settings
        public Guid Id { get; set; }

        // Optional background image URL for the blogs summary page
        public string? BackgroundImageUrl { get; set; }

        // Date and time when the blogs summary page was last updated
        public DateTime UpdatedAt { get; set; }
    }
}
