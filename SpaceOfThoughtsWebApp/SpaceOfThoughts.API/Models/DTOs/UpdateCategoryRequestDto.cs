namespace SpaceOfThoughts.API.Models.DTOs
{
    // DTO for updating an existing category
    public class UpdateCategoryRequestDto
    {
        // Name of the category
        public required string Name { get; set; }
    }
}
