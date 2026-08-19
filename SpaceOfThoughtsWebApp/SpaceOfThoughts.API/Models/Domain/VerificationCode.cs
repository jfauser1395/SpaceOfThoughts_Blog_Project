using Microsoft.AspNetCore.Identity;

namespace SpaceOfThoughts.API.Models.Domain
{
    // VerificationCode represents a code currently in flight, stored so the
    // user's input can be checked later. Rows are removed once consumed
    public class VerificationCode
    {
        // Unique identifier for the code
        public Guid Id { get; set; }

        // Identity user ID the code was issued to
        public required string UserId { get; set; }

        // Hash of the six digit code, never the code itself
        public required string CodeHash { get; set; }

        // Flow the code was issued for, so it cannot be used for the other one
        public required CodePurpose Purpose { get; set; }

        // Date and time after which the code is no longer accepted
        public DateTime ExpiresAt { get; set; }

        // Failed attempts so far, used to stop guessing the six digits
        public int AttemptCount { get; set; }

        // Identity user navigation property
        public IdentityUser? User { get; set; }
    }
}
