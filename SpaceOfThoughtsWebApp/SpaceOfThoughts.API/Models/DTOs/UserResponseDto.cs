namespace SpaceOfThoughts.API.Models.DTOs
{
    // DTO representing a user's data returned to the client
    public class UserResponseDto
    {
        // Unique identifier for the user
        public required string Id { get; set; }

        // Username of the user
        public string? UserName { get; set; }

        // Email address of the user
        public string? Email { get; set; }

        // Roles assigned to the user
        public required IList<string> Roles { get; set; }

        // Optional profile image URL for the user
        public string? ProfileImageUrl { get; set; }

        // Saved profile image position for the user
        public string? ProfileImagePosition { get; set; }

        // Flag indicating if the user is banned
        public bool IsBanned { get; set; }
    }
}
