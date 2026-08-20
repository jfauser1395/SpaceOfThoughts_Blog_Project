namespace SpaceOfThoughts.API.Models.Domain
{
    // VerificationOptions holds the settings of the six digit codes, bound from
    // the "Verification" configuration section (Verification__* in production)
    public class VerificationOptions
    {
        // Base64 key the codes are hashed with, kept out of the database
        public required string CodeSecret { get; init; }

        // Lifetime of a code in minutes, also shown to the user in the email
        public required int ExpiryMinutes { get; init; }

        // Failed guesses a code survives before it is refused
        public required int MaxAttempts { get; init; }
    }
}
