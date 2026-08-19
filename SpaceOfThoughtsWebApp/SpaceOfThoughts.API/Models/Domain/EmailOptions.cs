namespace SpaceOfThoughts.API.Models.Domain
{
    // EmailOptions holds the Resend settings, bound from the "Email"
    // configuration section (Email__* environment variables in production)
    public class EmailOptions
    {
        // Secret key authenticating the application against Resend
        public required string ApiKey { get; init; }

        // Template published for email verification codes
        public required string VerificationTemplateId { get; init; }

        // Template published for password reset codes
        public required string PasswordResetTemplateId { get; init; }
    }
}
