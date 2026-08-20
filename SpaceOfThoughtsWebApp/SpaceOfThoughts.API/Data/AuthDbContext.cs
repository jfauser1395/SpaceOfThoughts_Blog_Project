using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using SpaceOfThoughts.API.Models.Domain;

namespace SpaceOfThoughts.API.Data
{
    // AuthDbContext manages authentication and authorization data
    // Inherits from IdentityDbContext to integrate ASP.NET Core Identity for authentication
    public class AuthDbContext(DbContextOptions<AuthDbContext> options) : IdentityDbContext(options)
    {

        //Table to store the verification codes currently in flight
        public required DbSet<VerificationCode> VerificationCodes { get; set; }

        // Configure the model 
        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);

            // Match Identity's unique normalized username index so concurrent
            // requests cannot assign the same email address to two accounts.
            builder.Entity<IdentityUser>()
                .HasIndex(user => user.NormalizedEmail)
                .HasDatabaseName("EmailIndex")
                .IsUnique();

            // Configure the codes currently in flight
            builder.Entity<VerificationCode>(entity =>
            {
                // A user holds at most one code per flow, so a resend replaces
                // the previous code instead of leaving two valid ones behind
                entity
                    .HasIndex(code => new { code.UserId, code.Purpose })
                    .IsUnique();

                // Codes belong to the user and are meaningless once the
                // account is gone, so let the delete cascade
                entity
                    .HasOne<IdentityUser>()
                    .WithMany()
                    .HasForeignKey(code => code.UserId)
                    .OnDelete(DeleteBehavior.Cascade);
            });
        }
    }
}
