namespace SpaceOfThoughts.API.Models.Domain
{
    // BlogPost represents a blog post in the application
    public class BlogPost
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

        // Saved "x% y% zoom%" framings applied when the featured image is
        // cropped. The blog card and the article banner are different shapes, so
        // each keeps its own framing. Null keeps the centred rendering.
        public string? FeaturedImageCardPosition { get; set; }

        public string? FeaturedImageBannerPosition { get; set; }

        // Optional background picture shown behind the article, with the saved
        // "x% y% zoom%" framing that crops it to the reader's viewport
        public string? BackgroundImageUrl { get; set; }

        public string? BackgroundImagePosition { get; set; }

        // URL handle (slug) for the blog post. Assigned by BlogPostRepository from
        // the title on every save and never supplied by a caller, so it is not
        // `required`: that would only force each caller to write a dummy value.
        public string UrlHandle { get; set; } = string.Empty;

        // Date when the blog post was published
        public DateTime PublishedDate { get; set; }

        // Author of the blog post
        public required string Author { get; set; }

        // Flag indicating if the blog post is visible to readers
        public bool IsVisible { get; set; }

        // Categories associated with the blog post
        public ICollection<Category> Categories { get; set; } = new List<Category>();

        // Comments associated with the blog post
        public ICollection<BlogComment> Comments { get; set; } = new List<BlogComment>();
    }
}
