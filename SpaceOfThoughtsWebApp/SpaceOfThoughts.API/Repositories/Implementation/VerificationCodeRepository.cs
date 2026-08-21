using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SpaceOfThoughts.API.Data;
using SpaceOfThoughts.API.Models.Domain;
using SpaceOfThoughts.API.Repositories.Interface;
using System.Security.Cryptography;
using System.Text;

namespace SpaceOfThoughts.API.Repositories.Implementation
{
    // Issues and checks the six digit codes of both email flows: stored rows
    // with attempt counting for password reset, derived stateless codes for
    // registration, where no user row exists yet
    public class VerificationCodeRepository(IOptions<VerificationOptions> options,
        AuthDbContext dbContext,
        ILogger<VerificationCodeRepository> logger) : IVerificationCodeRepository
    {
        // Password reset flow: the user exists, so the code lives on their
        // row, which is what makes single use and attempt limits possible

        // Issue a code for the user and hand back the plain digits once, so
        // the caller can put them into the email
        public async Task<string> CreateAsync(string userId, CodePurpose purpose)
        {
            try
            {
                // Only the hash is kept, the digits leave with the return value
                var code = GenerateCode();
                var codeHash = Hash(code);
                var expiresAt = DateTime.UtcNow.AddMinutes(options.Value.ExpiryMinutes);

                var existingCode = await FindAsync(userId, purpose);

                if (existingCode is null)
                {
                    // Nothing in flight for this flow yet, so start a row
                    var verificationCode = new VerificationCode
                    {
                        Id = Guid.NewGuid(),
                        UserId = userId,
                        CodeHash = codeHash,
                        Purpose = purpose,
                        ExpiresAt = expiresAt,
                        AttemptCount = 0,
                    };
                    await dbContext.VerificationCodes.AddAsync(verificationCode);
                }
                else
                {
                    // Overwriting drops the old hash and hands the user a fresh
                    // set of attempts, without touching the primary key
                    existingCode.CodeHash = codeHash;
                    existingCode.ExpiresAt = expiresAt;
                    existingCode.AttemptCount = 0;
                }

                await dbContext.SaveChangesAsync();

                // The only moment the plain code exists, for the email to carry
                return code;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to issue a {Purpose} code for user {UserId}", purpose, userId);
                throw;
            }
        }

        // Check the code the user entered and consume it when it matches
        public async Task<bool> VerifyAsync(string userId, CodePurpose purpose, string code)
        {
            try
            {
                var existingCode = await FindAsync(userId, purpose);

                // Nothing in flight, so there is nothing to accept
                if (existingCode is null)
                {
                    return false;
                }

                // A code that ran out of time or of attempts is of no further
                // use, so it leaves rather than lingering until a cleanup
                if (existingCode.ExpiresAt <= DateTime.UtcNow
                    || existingCode.AttemptCount >= options.Value.MaxAttempts)
                {
                    dbContext.VerificationCodes.Remove(existingCode);
                    await dbContext.SaveChangesAsync();
                    return false;
                }

                // Compared in fixed time, so the answer cannot be narrowed down
                // by measuring how long the comparison took
                var matches = CryptographicOperations.FixedTimeEquals(
                    Convert.FromBase64String(existingCode.CodeHash),
                    Convert.FromBase64String(Hash(code)));

                if (!matches)
                {
                    // Counting the miss is what limits guessing the six digits
                    existingCode.AttemptCount++;
                    await dbContext.SaveChangesAsync();
                    return false;
                }

                // A code is good for a single use
                dbContext.VerificationCodes.Remove(existingCode);
                await dbContext.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to verify a {Purpose} code for user {UserId}", purpose, userId);
                throw;
            }
        }

        // Registration flow: no user row exists yet, so the code is derived
        // from the email and the current time window instead of stored,
        // and never touches the database

        // Derive the code for this email and the current time window
        public string CreateForRegistration(string email) =>
            DeriveCode(email, CurrentTimeBucket());

        // Recompute the code for the current and the previous window, so the
        // digits do not expire in the user's hands right at a window boundary.
        // Both comparisons run in fixed time
        public bool VerifyForRegistration(string email, string code)
        {
            var bucket = CurrentTimeBucket();
            var entered = Encoding.UTF8.GetBytes(code ?? string.Empty);

            var current = CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(DeriveCode(email, bucket)), entered);
            var previous = CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(DeriveCode(email, bucket - 1)), entered);

            return current || previous;
        }

        // UTC time divided into windows of the configured code lifetime, so a
        // derived code stays valid for one to two lifetimes
        private long CurrentTimeBucket() =>
            DateTime.UtcNow.Ticks / TimeSpan.FromMinutes(options.Value.ExpiryMinutes).Ticks;

        // Six digits taken from the keyed hash of the email and the window.
        // The email is normalized so casing does not change the digits
        private string DeriveCode(string email, long bucket)
        {
            using var hmac = new HMACSHA256(Convert.FromBase64String(options.Value.CodeSecret));
            var hash = hmac.ComputeHash(
                Encoding.UTF8.GetBytes(email.Trim().ToLowerInvariant() + "|" + bucket));
            return (BitConverter.ToUInt32(hash, 0) % 1_000_000).ToString("D6");
        }

        // The code currently in flight for this user and flow, at most one
        private Task<VerificationCode?> FindAsync(string userId, CodePurpose purpose) =>
            dbContext.VerificationCodes
                .FirstOrDefaultAsync(vc => vc.UserId == userId && vc.Purpose == purpose);

        // Six random digits, leading zeros are kept
        private static string GenerateCode() => RandomNumberGenerator.GetInt32(0, 1000000).ToString("D6");

        // Keyed hash rather than a plain one: six digits are only a million
        // candidates, so SHA-256 alone, salted or not, is walked through in
        // seconds once the database leaks. HMAC mixes in a secret that lives in
        // the configuration only, which leaves the stored hashes useless
        // without it, while staying cheap enough to run on every attempt
        private string Hash(string code)
        {
            using var hmac = new HMACSHA256(Convert.FromBase64String(options.Value.CodeSecret));
            return Convert.ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes(code)));
        }
    }
}
