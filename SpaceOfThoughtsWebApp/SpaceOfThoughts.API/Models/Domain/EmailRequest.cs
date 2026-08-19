namespace SpaceOfThoughts.API.Models.Domain
{
    // Flow a verification code was issued for
    public enum CodePurpose
    {
        EmailVerification,
        PasswordReset
    }

    // EmailRequest represents a single outgoing verification email
    public class EmailRequest
    {
        // Address the email is sent to
        public required string ToAddress { get; init; }

        // Name of the recipient, shown in the template
        public required string UserName { get; init; }

        // Six digit code the user enters to complete the flow
        public required string Code { get; init; }

        // Lifetime of the code in minutes, shown in the template
        public required int ExpiresInMinutes { get; init; }

        // Flow the code belongs to, selecting the template
        public required CodePurpose Purpose { get; init; }
    }
}
