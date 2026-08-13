namespace SpaceOfThoughts.API.Models.DTOs
{
    // DTO for updating an existing blog post
    public class UpdateBlogpostRequestDto
    {
        // Title of the blog post
        public required string Title { get; set; }

        // Short description of the blog post for summaries and previews
        public required string ShortDescription { get; set; }

        // Main content of the blog post
        public required string Content { get; set; }

        // URL of the featured image for the blog post
        public required string FeaturedImageUrl { get; set; }

        // Saved "x% y% zoom%" framings applied to the cropped featured image.
        // The blog card and the article banner are framed independently.
        public string? FeaturedImageCardPosition { get; set; }

        public string? FeaturedImageBannerPosition { get; set; }

        // Optional background picture shown behind the article, with the saved
        // "x% y% zoom%" framing that crops it to the reader's viewport
        public string? BackgroundImageUrl { get; set; }

        public string? BackgroundImagePosition { get; set; }

        // Date when the blog post was published
        public DateTime PublishedDate { get; set; }

        // Author of the blog post
        public required string Author { get; set; }

        // Flag indicating if the blog post is visible to readers
        public bool IsVisible { get; set; }

        // Category IDs selected for the blog post
        public List<Guid> Categories { get; set; } = new List<Guid>();
    }
}
