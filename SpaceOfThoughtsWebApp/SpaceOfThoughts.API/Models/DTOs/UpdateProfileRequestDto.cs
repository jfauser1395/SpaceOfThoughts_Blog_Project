namespace SpaceOfThoughts.API.Models.DTOs
{
    // DTO for updating the current user's profile credentials and avatar position
    public class UpdateProfileRequestDto
    {
        // Updated username for the current user
        public required string UserName { get; set; }

        // Updated email address for the current user
        public required string Email { get; set; }

        // Current password required when changing the password
        public string? CurrentPassword { get; set; }

        // Optional new password for the current user
        public string? NewPassword { get; set; }

        // Saved object position for the user's profile image
        public string? ProfileImagePosition { get; set; }
    }
}
