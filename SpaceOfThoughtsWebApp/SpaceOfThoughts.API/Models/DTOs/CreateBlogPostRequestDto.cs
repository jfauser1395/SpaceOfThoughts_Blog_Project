namespace SpaceOfThoughts.API.Models.DTOs
{
    // DTO for creating a new blog post
    public class CreateBlogPostRequestDto
    {
        // Title of the blog post
        public required string Title { get; set; }

        // Short description of the blog post for summaries and previews
        public required string ShortDescription { get; set; }

        // Main content of the blog post
        public required string Content { get; set; }

        // URL of the featured image for the blog post
        public required string FeaturedImageUrl { get; set; }

        // URL handle (slug) for the blog post
        public required string UrlHandle { get; set; }

        // Date when the blog post was published
        public DateTime PublishedDate { get; set; }

        // Author of the blog post
        public required string Author { get; set; }

        // Flag indicating if the blog post is visible to readers
        public bool IsVisible { get; set; }

        // Category IDs selected for the blog post
        public required Guid[] Categories { get; set; }
    }
}
