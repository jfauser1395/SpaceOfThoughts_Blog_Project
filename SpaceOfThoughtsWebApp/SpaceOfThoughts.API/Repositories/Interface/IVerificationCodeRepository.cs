using SpaceOfThoughts.API.Models.Domain;

namespace SpaceOfThoughts.API.Repositories.Interface
{
    // Interface for issuing and checking the six digit codes
    public interface IVerificationCodeRepository
    {
        // Issue a code for the user, replacing any code still in flight for the
        // same flow. Returns the plain code once, for the email to carry
        Task<string> CreateAsync(string userId, CodePurpose purpose, CancellationToken ct);

        // Check a code the user entered and consume it when it matches
        Task<bool> VerifyAsync(string userId, CodePurpose purpose, string code, CancellationToken ct);
    }
}
