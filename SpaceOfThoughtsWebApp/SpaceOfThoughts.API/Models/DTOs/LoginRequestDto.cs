namespace SpaceOfThoughts.API.Models.DTOs
{
    // DTO for login request data
    public class LoginRequestDto
    {
        // Email address used to log in
        public required string Email { get; set; }

        // Password used to log in
        public required string Password { get; set; }
    }
}
