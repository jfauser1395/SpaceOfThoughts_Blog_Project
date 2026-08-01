using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace SpaceOfThoughts.API.Data.Initialization
{
    // Applies required database migrations and creates the identity data needed at startup
    public static class DbInitializer
    {
        // Migrate both application contexts before seeding roles and the protected admin account
        public static async Task MigrateAndSeedAsync(IApplicationBuilder app)
        {
            using var scope = app.ApplicationServices.CreateScope();
            var services = scope.ServiceProvider;

            try
            {
                // Run Migrations
                var applicationDbContext = services.GetRequiredService<ApplicationDbContext>();
                await applicationDbContext.Database.MigrateAsync();

                var authDbContext = services.GetRequiredService<AuthDbContext>();
                await authDbContext.Database.MigrateAsync();

                // Seed Identity
                var roleManager = services.GetRequiredService<RoleManager<IdentityRole>>();
                var userManager = services.GetRequiredService<UserManager<IdentityUser>>();
                var configuration = services.GetRequiredService<IConfiguration>();

                await SeedRolesAsync(roleManager);
                await SeedAdminAsync(userManager, configuration);
            }
            catch (Exception ex)
            {
                var logger = services.GetRequiredService<ILogger<Program>>();
                logger.LogError(ex, "An error occurred during startup migration or seeding.");
                throw; // Crash early if core security seeding fails
            }
        }

        // Create application roles only when they are not already available
        private static async Task SeedRolesAsync(RoleManager<IdentityRole> roleManager)
        {
            string[] roleNames =
            {
                IdentitySeedConstants.ReaderRole,
                IdentitySeedConstants.WriterRole,
                IdentitySeedConstants.InitialAdminRole
            };
            foreach (var roleName in roleNames)
            {
                if (!await roleManager.RoleExistsAsync(roleName))
                {
                    var result = await roleManager.CreateAsync(new IdentityRole(roleName));
                    ThrowIfFailed(result, $"create the {roleName} role");
                }
            }
        }

        // Create or recover the one initial administrator and idempotently restore its roles
        private static async Task SeedAdminAsync(
            UserManager<IdentityUser> userManager,
            IConfiguration configuration
        )
        {
            var initialAdmins = await userManager.GetUsersInRoleAsync(
                IdentitySeedConstants.InitialAdminRole
            );

            if (initialAdmins.Count > 1)
            {
                throw new InvalidOperationException(
                    "More than one bootstrap administrator exists. Writing privileges cannot be seeded safely."
                );
            }

            var adminUser = initialAdmins.SingleOrDefault();
            adminUser ??= await userManager.FindByEmailAsync(IdentitySeedConstants.AdminEmail);
            adminUser ??= await userManager.FindByNameAsync(IdentitySeedConstants.AdminUserName);

            if (adminUser == null)
            {
                var initialPassword = configuration["BootstrapAdmin:InitialPassword"];
                if (string.IsNullOrWhiteSpace(initialPassword))
                {
                    throw new InvalidOperationException(
                        "Bootstrap administrator configuration 'BootstrapAdmin:InitialPassword' "
                            + "is required when creating the initial administrator."
                    );
                }

                adminUser = new IdentityUser
                {
                    UserName = IdentitySeedConstants.AdminUserName,
                    Email = IdentitySeedConstants.AdminEmail,
                    EmailConfirmed = true
                };
                var createResult = await userManager.CreateAsync(adminUser, initialPassword);
                ThrowIfFailed(createResult, "create the initial administrator");
            }

            var currentRoles = await userManager.GetRolesAsync(adminUser);
            var requiredRoles = new[]
            {
                IdentitySeedConstants.ReaderRole,
                IdentitySeedConstants.WriterRole,
                IdentitySeedConstants.InitialAdminRole
            };
            var missingRoles = requiredRoles.Except(currentRoles).ToArray();

            if (missingRoles.Length > 0)
            {
                var roleResult = await userManager.AddToRolesAsync(adminUser, missingRoles);
                ThrowIfFailed(roleResult, "restore the initial administrator roles");
            }
        }

        // Fail startup instead of silently leaving core authorization data incomplete
        private static void ThrowIfFailed(IdentityResult result, string operation)
        {
            if (result.Succeeded)
            {
                return;
            }

            var details = string.Join("; ", result.Errors.Select(error => error.Description));
            throw new InvalidOperationException($"Unable to {operation}: {details}");
        }
    }
}
