namespace SpaceOfThoughts.API.Models.DTOs
{
    // DTO for creating a new category
    public class CreateCategoryRequestDto
    {
        // Name of the category
        public required string Name { get; set; }
    }
}
