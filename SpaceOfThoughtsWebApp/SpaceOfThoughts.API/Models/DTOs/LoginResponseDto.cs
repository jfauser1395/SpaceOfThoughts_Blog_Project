namespace SpaceOfThoughts.API.Models.DTOs
{
    public class LoginResponseDto
    {
        public required string Id { get; set; }
        public required string UserName { get; set; }
        public required string Email { get; set; }
        public required string Token { get; set; }
        public required List<string> Roles { get; set; }
    }
}
