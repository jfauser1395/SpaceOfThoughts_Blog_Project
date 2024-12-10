namespace SpaceOfThoughts.API.Models.DTOs
{
    public class CreateCategoryRequestDto
    {
        public required string Name { get; set; }
        public required string UrlHandle { get; set; }
    }
}
