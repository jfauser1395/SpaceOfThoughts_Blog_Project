namespace SpaceOfThoughts.API.Models.DTOs
{
    // DTO representing a category returned to the client
    public class CategoryDto
    {
        // Unique identifier for the category
        public Guid Id { get; set; }

        // Name of the category
        public required string Name { get; set; }

        // URL handle (slug) for the category
        public required string UrlHandle { get; set; }
    }
}
