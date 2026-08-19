namespace SpaceOfThoughts.API.Models.Domain
{
    // EmailResult represents the outcome of a send attempt
    public class EmailResult
    {
        // Flag indicating if the provider accepted the message
        public required bool Success { get; init; }

        // Id assigned by the provider (null when the send failed)
        public string? Id { get; init; }

        // Reason the send failed (null when it succeeded)
        public string? Error { get; init; }
    }
}
