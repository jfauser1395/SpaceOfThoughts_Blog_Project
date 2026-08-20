using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SpaceOfThoughts.API.Data;
using SpaceOfThoughts.API.Models.Domain;
using SpaceOfThoughts.API.Repositories.Interface;
using System.Security.Cryptography;
using System.Text;

namespace SpaceOfThoughts.API.Repositories.Implementation
{
    // Issues and checks the six digit codes of the email flows
    public class VerificationCodeRepository(IOptions<VerificationOptions> options,
        AuthDbContext dbContext,
        ILogger<VerificationCodeRepository> logger) : IVerificationCodeRepository
    {
        // Issue a code for the user and hand back the plain digits once, so
        // the caller can put them into the email
        public async Task<string> CreateAsync(string userId, CodePurpose purpose, CancellationToken ct)
        {
            try
            {
                // Only the hash is kept, the digits leave with the return value
                var code = GenerateCode();
                var codeHash = Hash(code);
                var expiresAt = DateTime.UtcNow.AddMinutes(options.Value.ExpiryMinutes);

                var existingCode = await FindAsync(userId, purpose, ct);

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
                    await dbContext.VerificationCodes.AddAsync(verificationCode, ct);
                }
                else
                {
                    // Overwriting drops the old hash and hands the user a fresh
                    // set of attempts, without touching the primary key
                    existingCode.CodeHash = codeHash;
                    existingCode.ExpiresAt = expiresAt;
                    existingCode.AttemptCount = 0;
                }

                await dbContext.SaveChangesAsync(ct);

                // The only moment the plain code exists, for the email to carry
                return code;
            }
            catch (OperationCanceledException)
            {
                // The caller gave up on the request, which is not a failure
                throw;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to issue a {Purpose} code for user {UserId}", purpose, userId);
                throw;
            }
        }

        // Check the code the user entered and consume it when it matches
        public async Task<bool> VerifyAsync(string userId, CodePurpose purpose, string code, CancellationToken ct)
        {
            try
            {
                var existingCode = await FindAsync(userId, purpose, ct);

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
                    await dbContext.SaveChangesAsync(ct);
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
                    await dbContext.SaveChangesAsync(ct);
                    return false;
                }

                // A code is good for a single use
                dbContext.VerificationCodes.Remove(existingCode);
                await dbContext.SaveChangesAsync(ct);
                return true;
            }
            catch (OperationCanceledException)
            {
                // The caller gave up on the request, which is not a failure
                throw;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to verify a {Purpose} code for user {UserId}", purpose, userId);
                throw;
            }
        }

        // The code currently in flight for this user and flow, at most one
        private Task<VerificationCode?> FindAsync(string userId, CodePurpose purpose, CancellationToken ct) =>
            dbContext.VerificationCodes
                .FirstOrDefaultAsync(vc => vc.UserId == userId && vc.Purpose == purpose, ct);

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
