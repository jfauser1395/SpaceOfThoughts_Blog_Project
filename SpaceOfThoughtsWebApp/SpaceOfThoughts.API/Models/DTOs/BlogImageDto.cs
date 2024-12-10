namespace SpaceOfThoughts.API.Models.DTOs
{
    public class BlogImageDto
    {
        public Guid Id { get; set; }

        public required string FileName { get; set; }

        public required string FileExtension { get; set; }

        public required string Title { get; set; }

        public string? Url { get; set; }

        public DateTime DateCreated { get; set; }
    }
}
