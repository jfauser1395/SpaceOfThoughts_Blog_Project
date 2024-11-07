namespace SpaceOfThoughts.API.Models.DTOs
{
    public class UserResponseDto
    {
        public required string Id { get; set; }
        public string? UserName { get; set; }
        public string? Email { get; set; }
        public required IList<string> Roles { get; set; }
    }
}
