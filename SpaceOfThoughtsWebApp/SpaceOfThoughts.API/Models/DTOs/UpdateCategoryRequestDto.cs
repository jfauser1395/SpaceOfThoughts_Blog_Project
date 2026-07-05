namespace SpaceOfThoughts.API.Models.DTOs
{
    // DTO for updating an existing category
    public class UpdateCategoryRequestDto
    {
        // Name of the category
        public required string Name { get; set; }

        // URL handle (slug) for the category
        public required string UrlHandle { get; set; }
    }
}
