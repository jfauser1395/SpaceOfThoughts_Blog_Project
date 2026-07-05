namespace SpaceOfThoughts.API.Models.DTOs
{
    // DTO representing a blog image returned to the client
    public class BlogImageDto
    {
        // Unique identifier for the image
        public Guid Id { get; set; }

        // Name of the file
        public required string FileName { get; set; }

        // Extension of the file
        public required string FileExtension { get; set; }

        // Title or caption for the image
        public required string Title { get; set; }

        // URL where the image is stored
        public string? Url { get; set; }

        // Date and time when the image was created
        public DateTime DateCreated { get; set; }
    }
}
