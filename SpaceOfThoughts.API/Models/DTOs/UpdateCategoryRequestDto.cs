namespace SpaceOfThoughts.API.Models.DTOs
{
    public class UpdateCategoryRequestDto
    {
        public required string Name { get; set; }

        public required string UrlHandle { get; set; }
    }
}
