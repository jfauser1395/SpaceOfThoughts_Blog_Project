using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace SpaceOfThoughts.API.Data
{
    // AuthDbContext manages authentication and authorization data
    // Inherits from IdentityDbContext to integrate ASP.NET Core Identity for authentication
    public class AuthDbContext : IdentityDbContext
    {
        // Constructor to pass options to the base DbContext class
        public AuthDbContext(DbContextOptions<AuthDbContext> options)
            : base(options) { }

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
        }
    }
}
