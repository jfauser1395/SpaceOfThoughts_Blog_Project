using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
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

        // Configure the model and seed initial data
        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);

            // Define role IDs for Reader and Writer
            var readerRoleId = "0839b6ac-c835-4402-b477-dff84f98f9d1"; // Example reader ID, change before publishing
            var writerRoleId = "775bed88-eb72-4a1f-93ee-bdf869707bdc"; // Example writer ID, change before publishing

            // Create Reader and Writer roles and set initial properties
            var role = new List<IdentityRole>
            {
                new IdentityRole()
                {
                    Id = readerRoleId,
                    Name = "Reader",
                    NormalizedName = "READER",
                    ConcurrencyStamp = readerRoleId // A random value that changes whenever a user is persisted to the store
                },
                new IdentityRole()
                {
                    Id = writerRoleId,
                    Name = "Writer",
                    NormalizedName = "WRITER",
                    ConcurrencyStamp = writerRoleId
                },
            };

            // Seed the roles into the database
            builder.Entity<IdentityRole>().HasData(role);

            // Define an admin user ID
            var adminUserId = "6542a5f0-8e4f-44df-a7e8-afbee3ad97cf"; // Example user ID, change before publishing

            // Create an Admin user and set initial properties
            var admin = new IdentityUser()
            {
                Id = adminUserId,
                UserName = "Admin",
                Email = "admin@test.com", // Example email, change before publishing
                NormalizedEmail = "ADMIN@TEST.COM",
                NormalizedUserName = "ADMIN"
            };

            // Generate a hashed password for the Admin user
            admin.PasswordHash = new PasswordHasher<IdentityUser>().HashPassword(
                admin,
                "Admin@123" // Example password, change before publishing
            );

            // Seed the Admin user into the database
            builder.Entity<IdentityUser>().HasData(admin);

            // Assign roles to the Admin user
            var adminRoles = new List<IdentityUserRole<string>>()
            {
                new() { UserId = adminUserId, RoleId = readerRoleId },
                new() { UserId = adminUserId, RoleId = writerRoleId }
            };

            // Seed the admin roles into the database
            builder.Entity<IdentityUserRole<string>>().HasData(adminRoles);
        }
    }
}
