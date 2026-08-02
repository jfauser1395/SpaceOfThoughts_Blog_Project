using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace SpaceOfThoughts.API.Data.Initialization
{
    // Applies required database migrations and maintains the one protected administrator.
    public static class DbInitializer
    {
        // Normal API startup migrates both contexts and reconciles the configured administrator.
        public static Task MigrateAndSeedAsync(IApplicationBuilder app)
        {
            return RunInitializationAsync(
                app,
                async services =>
                {
                    await MigrateDatabasesAsync(services);

                    var roleManager = services.GetRequiredService<RoleManager<IdentityRole>>();
                    var userManager = services.GetRequiredService<UserManager<IdentityUser>>();
                    var authDbContext = services.GetRequiredService<AuthDbContext>();
                    var configuration = services.GetRequiredService<IConfiguration>();
                    var (userName, email) = ReadConfiguredAdminIdentity(configuration);

                    await SeedRolesAsync(roleManager);
                    await ReconcileAdminAsync(authDbContext, userManager, userName, email);
                },
                "startup migration or identity reconciliation"
            );
        }

        // spotctl invokes this one-shot path and supplies the password through standard input.
        public static Task MigrateAndProvisionAdminAsync(
            IApplicationBuilder app,
            string userName,
            string email,
            string password
        )
        {
            userName = RequireIdentityValue(userName, "administrator username");
            email = RequireIdentityValue(email, "administrator email");

            if (string.IsNullOrEmpty(password))
            {
                throw new InvalidOperationException("The administrator password cannot be empty.");
            }

            return RunInitializationAsync(
                app,
                async services =>
                {
                    await MigrateDatabasesAsync(services);

                    var roleManager = services.GetRequiredService<RoleManager<IdentityRole>>();
                    var userManager = services.GetRequiredService<UserManager<IdentityUser>>();
                    var authDbContext = services.GetRequiredService<AuthDbContext>();

                    await SeedRolesAsync(roleManager);
                    await ProvisionAdminAsync(
                        authDbContext,
                        userManager,
                        userName,
                        email,
                        password
                    );
                },
                "spotctl migration or administrator provisioning"
            );
        }

        private static async Task RunInitializationAsync(
            IApplicationBuilder app,
            Func<IServiceProvider, Task> operation,
            string operationName
        )
        {
            using var scope = app.ApplicationServices.CreateScope();
            var services = scope.ServiceProvider;

            try
            {
                await operation(services);
            }
            catch (Exception ex)
            {
                var logger = services.GetRequiredService<ILogger<Program>>();
                logger.LogError(ex, "An error occurred during {OperationName}.", operationName);
                throw;
            }
        }

        private static async Task MigrateDatabasesAsync(IServiceProvider services)
        {
            var applicationDbContext = services.GetRequiredService<ApplicationDbContext>();
            await applicationDbContext.Database.MigrateAsync();

            var authDbContext = services.GetRequiredService<AuthDbContext>();
            await authDbContext.Database.MigrateAsync();
        }

        // Create application roles only when they are not already available.
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

        private static async Task ReconcileAdminAsync(
            AuthDbContext authDbContext,
            UserManager<IdentityUser> userManager,
            string userName,
            string email
        )
        {
            await using var transaction = await authDbContext.Database.BeginTransactionAsync();

            try
            {
                var adminUser = await ResolveAdminCandidateAsync(userManager, userName, email);
                if (adminUser is null)
                {
                    throw new InvalidOperationException(
                        "No bootstrap administrator exists. Run spotctl setup to provision it."
                    );
                }

                await ReconcileIdentityAsync(userManager, adminUser, userName, email);
                await EnsureRequiredRolesAsync(userManager, adminUser);
                await EnsureSoleInitialAdminAsync(userManager, adminUser);

                await transaction.CommitAsync();
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        private static async Task ProvisionAdminAsync(
            AuthDbContext authDbContext,
            UserManager<IdentityUser> userManager,
            string userName,
            string email,
            string password
        )
        {
            await using var transaction = await authDbContext.Database.BeginTransactionAsync();

            try
            {
                var adminUser = await ResolveAdminCandidateAsync(userManager, userName, email);
                var wasCreated = adminUser is null;

                if (wasCreated)
                {
                    adminUser = new IdentityUser
                    {
                        UserName = userName,
                        Email = email,
                        EmailConfirmed = true
                    };

                    var createResult = await userManager.CreateAsync(adminUser, password);
                    ThrowIfFailed(createResult, "create the initial administrator");
                }
                else
                {
                    await ReconcileIdentityAsync(userManager, adminUser!, userName, email);

                    var resetToken = await userManager.GeneratePasswordResetTokenAsync(adminUser!);
                    var resetResult = await userManager.ResetPasswordAsync(
                        adminUser!,
                        resetToken,
                        password
                    );
                    ThrowIfFailed(resetResult, "reset the initial administrator password");
                }

                await EnsureRequiredRolesAsync(userManager, adminUser!);
                await EnsureSoleInitialAdminAsync(userManager, adminUser!);

                await transaction.CommitAsync();
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        // Prefer the non-delegable role. With no role holder, recover only an unambiguous
        // account matching the configured username or email address.
        private static async Task<IdentityUser?> ResolveAdminCandidateAsync(
            UserManager<IdentityUser> userManager,
            string userName,
            string email
        )
        {
            var initialAdmins = await userManager.GetUsersInRoleAsync(
                IdentitySeedConstants.InitialAdminRole
            );

            if (initialAdmins.Count > 1)
            {
                throw new InvalidOperationException(
                    "More than one InitialAdmin exists. Administrator credentials cannot be reconciled safely."
                );
            }

            var roleAdmin = initialAdmins.SingleOrDefault();
            if (roleAdmin is not null)
            {
                return roleAdmin;
            }

            var emailMatch = await userManager.FindByEmailAsync(email);
            var userNameMatch = await userManager.FindByNameAsync(userName);

            if (
                emailMatch is not null
                && userNameMatch is not null
                && !string.Equals(emailMatch.Id, userNameMatch.Id, StringComparison.Ordinal)
            )
            {
                throw new InvalidOperationException(
                    "The configured administrator username and email belong to different users."
                );
            }

            return emailMatch ?? userNameMatch;
        }

        private static async Task ReconcileIdentityAsync(
            UserManager<IdentityUser> userManager,
            IdentityUser adminUser,
            string userName,
            string email
        )
        {
            var userNameOwner = await userManager.FindByNameAsync(userName);
            if (
                userNameOwner is not null
                && !string.Equals(userNameOwner.Id, adminUser.Id, StringComparison.Ordinal)
            )
            {
                throw new InvalidOperationException(
                    "The configured administrator username already belongs to another user."
                );
            }

            var emailOwner = await userManager.FindByEmailAsync(email);
            if (
                emailOwner is not null
                && !string.Equals(emailOwner.Id, adminUser.Id, StringComparison.Ordinal)
            )
            {
                throw new InvalidOperationException(
                    "The configured administrator email already belongs to another user."
                );
            }

            if (!string.Equals(adminUser.UserName, userName, StringComparison.Ordinal))
            {
                var userNameResult = await userManager.SetUserNameAsync(adminUser, userName);
                ThrowIfFailed(userNameResult, "update the initial administrator username");
            }

            if (!string.Equals(adminUser.Email, email, StringComparison.Ordinal))
            {
                var emailResult = await userManager.SetEmailAsync(adminUser, email);
                ThrowIfFailed(emailResult, "update the initial administrator email");
            }

            if (!adminUser.EmailConfirmed)
            {
                adminUser.EmailConfirmed = true;
                var confirmEmailResult = await userManager.UpdateAsync(adminUser);
                ThrowIfFailed(confirmEmailResult, "confirm the initial administrator email");
            }
        }

        private static async Task EnsureRequiredRolesAsync(
            UserManager<IdentityUser> userManager,
            IdentityUser adminUser
        )
        {
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

        private static async Task EnsureSoleInitialAdminAsync(
            UserManager<IdentityUser> userManager,
            IdentityUser expectedAdmin
        )
        {
            var initialAdmins = await userManager.GetUsersInRoleAsync(
                IdentitySeedConstants.InitialAdminRole
            );

            if (
                initialAdmins.Count != 1
                || !string.Equals(initialAdmins[0].Id, expectedAdmin.Id, StringComparison.Ordinal)
            )
            {
                throw new InvalidOperationException(
                    "Exactly one InitialAdmin must exist after administrator reconciliation."
                );
            }
        }

        private static (string UserName, string Email) ReadConfiguredAdminIdentity(
            IConfiguration configuration
        )
        {
            return (
                RequireIdentityValue(
                    configuration["BootstrapAdmin:UserName"],
                    "BootstrapAdmin:UserName"
                ),
                RequireIdentityValue(
                    configuration["BootstrapAdmin:Email"],
                    "BootstrapAdmin:Email"
                )
            );
        }

        private static string RequireIdentityValue(string? value, string name)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                throw new InvalidOperationException($"Administrator configuration '{name}' is required.");
            }

            var normalizedValue = value.Trim();
            if (normalizedValue.Contains('\r') || normalizedValue.Contains('\n'))
            {
                throw new InvalidOperationException(
                    $"Administrator configuration '{name}' cannot contain line breaks."
                );
            }

            return normalizedValue;
        }

        // Fail startup instead of silently leaving core authorization data incomplete.
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
