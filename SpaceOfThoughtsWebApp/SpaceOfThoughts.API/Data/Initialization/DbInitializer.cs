using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace SpaceOfThoughts.API.Data.Initialization
{
    public static class DbInitializer
    {
        public static async Task MigrateAndSeedAsync(IApplicationBuilder app)
        {
            using var scope = app.ApplicationServices.CreateScope();
            var services = scope.ServiceProvider;

            try
            {
                // Run Migrations
                var authDbContext = services.GetRequiredService<AuthDbContext>();
                await authDbContext.Database.MigrateAsync();

                // Seed Identity
                var roleManager = services.GetRequiredService<RoleManager<IdentityRole>>();
                var userManager = services.GetRequiredService<UserManager<IdentityUser>>();

                await SeedRolesAsync(roleManager);
                await SeedAdminAsync(userManager);
            }
            catch (Exception ex)
            {
                var logger = services.GetRequiredService<ILogger<Program>>();
                logger.LogError(ex, "An error occurred during startup migration or seeding.");
                throw; // Crash early if core security seeding fails
            }
        }

        private static async Task SeedRolesAsync(RoleManager<IdentityRole> roleManager)
        {
            string[] roleNames = { "Reader", "Writer" };
            foreach (var roleName in roleNames)
            {
                if (!await roleManager.RoleExistsAsync(roleName))
                {
                    await roleManager.CreateAsync(new IdentityRole(roleName));
                }
            }
        }

        private static async Task SeedAdminAsync(UserManager<IdentityUser> userManager)
        {
            var adminEmail = "admin@test.com";
            var adminUser = await userManager.FindByEmailAsync(adminEmail);

            if (adminUser == null)
            {
                var newAdmin = new IdentityUser { UserName = "Admin", Email = adminEmail, EmailConfirmed = true };
                var result = await userManager.CreateAsync(newAdmin, "Admin@123");
                if (result.Succeeded)
                {
                    await userManager.AddToRolesAsync(newAdmin, new[] { "Reader", "Writer" });
                }
            }
        }
    }
}