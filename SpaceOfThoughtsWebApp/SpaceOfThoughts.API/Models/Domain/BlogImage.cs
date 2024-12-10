namespace SpaceOfThoughts.API.Models.Domain
{
    // BlogImage represents an image associated with blog posts in the application
    public class BlogImage
    {
        // Unique identifier for the image
        public Guid Id { get; set; }

        // Name of the file
        public required string FileName { get; set; }

        // Extension of the file (e.g., .jpg, .png)
        public required string FileExtension { get; set; }

        // Title or caption for the image
        public required string Title { get; set; }

        // URL where the image is stored (nullable as it may not be set initially)
        public string? Url { get; set; }

        // Date and time when the image was created
        public DateTime DateCreated { get; set; }
    }
}
