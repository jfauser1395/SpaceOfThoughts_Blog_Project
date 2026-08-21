namespace SpaceOfThoughts.API.Models.DTOs
{
    // DTO for registering a new user account
    public class RegisterRequestDto
    {
        // Username for the new user
        public required string UserName { get; set; }

        // Email address for the new user
        public required string Email { get; set; }

        // Password for the new user
        public required string Password { get; set; }

        // Request verification code
        public required string? Code { get; init; }
    }
}
