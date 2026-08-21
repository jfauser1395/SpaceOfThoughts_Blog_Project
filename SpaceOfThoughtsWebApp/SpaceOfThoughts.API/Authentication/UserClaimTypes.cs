namespace SpaceOfThoughts.API.Authentication
{
    // Claim names the application stores on Identity users, shared by every
    // controller that reads or writes them
    public static class UserClaimTypes
    {
        // URL of the user's profile image
        public const string ProfileImage = "profile_image_url";

        // Saved "x% y% zoom%" framing of the profile image
        public const string ProfileImagePosition = "profile_image_position";

        // Marks an account as banned
        public const string UserBan = "is_banned";
    }
}
