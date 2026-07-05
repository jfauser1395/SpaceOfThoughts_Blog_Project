namespace SpaceOfThoughts.API.Models.DTOs
{
    // DTO representing a blog post returned to the client
    public class BlogPostDto
    {
        // Unique identifier for the blog post
        public Guid Id { get; set; }

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

        // Categories associated with the blog post
        public required List<CategoryDto> Categories { get; set; } = new List<CategoryDto>();
    }
}
