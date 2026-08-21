using SpaceOfThoughts.API.Models.Domain;

namespace SpaceOfThoughts.API.Repositories.Interface
{
    // Interface for issuing and checking the six digit codes
    public interface IVerificationCodeRepository
    {
        // Password reset flow: the user exists, so the code is stored on
        // their row, giving single use and a counted number of attempts

        // Issue a code for the user, replacing any code still in flight for the
        // same flow. Returns the plain code once, for the email to carry
        Task<string> CreateAsync(string userId, CodePurpose purpose);

        // Check a code the user entered and consume it when it matches
        Task<bool> VerifyAsync(string userId, CodePurpose purpose, string code);

        // Registration flow: no user exists yet, so nothing can be stored.
        // The code is derived from the email and the current time window
        // instead, and never touches the database

        // Derive the code for this email and the current time window
        string CreateForRegistration(string email);

        // Recompute the code and compare it against what the user entered
        bool VerifyForRegistration(string email, string code);
    }
}
