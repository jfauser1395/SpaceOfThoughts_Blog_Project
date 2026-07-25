namespace SpaceOfThoughts.API.Models.DTOs
{
    // DTO representing the response received after a successful login
    public class LoginResponseDto
    {
        // Unique identifier for the authenticated user
        public required string Id { get; set; }

        // Username of the authenticated user
        public required string UserName { get; set; }

        // Email address of the authenticated user
        public required string Email { get; set; }

        // Roles assigned to the authenticated user
        public required List<string> Roles { get; set; }

        // Optional profile image URL for the authenticated user
        public string? ProfileImageUrl { get; set; }

        // Saved profile image position for the authenticated user
        public string? ProfileImagePosition { get; set; }
    }
}
