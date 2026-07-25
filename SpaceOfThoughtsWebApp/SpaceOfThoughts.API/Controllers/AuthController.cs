using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using SpaceOfThoughts.API.Authentication;
using SpaceOfThoughts.API.Data;
using SpaceOfThoughts.API.Data.Initialization;
using SpaceOfThoughts.API.Models.DTOs;
using SpaceOfThoughts.API.Repositories.Interface;

namespace SpaceOfThoughts.API.Controllers
{
    // The AuthController handles user authentication, registration, and management
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private const string ProfileImageClaimType = "profile_image_url";
        private const string ProfileImagePositionClaimType = "profile_image_position";
        private const string UserBanClaimType = "is_banned";
        private const string DefaultProfileImagePosition = "50% 50% 100%";
        private const int DefaultProfileImageZoomPercent = 100;
        private const int MinimumProfileImageZoomPercent = 85;
        private const int MaximumProfileImageZoomPercent = 170;
        private const long MaxProfileImageSizeInBytes = 5 * 1024 * 1024;
        private static readonly string[] AllowedProfileImageExtensions =
        {
            ".jpg",
            ".jpeg",
            ".png",
            ".webp"
        };

        private readonly UserManager<IdentityUser> userManager;
        private readonly AuthDbContext authDbContext;
        private readonly ITokenRepository tokenRepository;
        private readonly IWebHostEnvironment webHostEnvironment;

        // Constructor to initialize UserManager and TokenRepository
        public AuthController(
            UserManager<IdentityUser> userManager,
            AuthDbContext authDbContext,
            ITokenRepository tokenRepository,
            IWebHostEnvironment webHostEnvironment
        )
        {
            this.userManager = userManager;
            this.authDbContext = authDbContext;
            this.tokenRepository = tokenRepository;
            this.webHostEnvironment = webHostEnvironment;
        }

        // POST: {apiBaseUrl}/api/auth/login - Endpoint to log in a user with email and password
        [HttpPost]
        [Route("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequestDto request)
        {
            // Find the user by email
            var identityUser = await userManager.FindByEmailAsync(request.Email);
            if (identityUser is not null)
            {
                // Check if the provided password matches the user's password
                var checkPasswordResult = await userManager.CheckPasswordAsync(
                    identityUser,
                    request.Password
                );

                // Create a JWT token and form the login response
                if (checkPasswordResult)
                {
                    if (await IsUserBannedAsync(identityUser))
                    {
                        ModelState.AddModelError("", "This account has been banned.");
                        return ValidationProblem(ModelState);
                    }

                    var roles = await userManager.GetRolesAsync(identityUser);
                    if (identityUser.UserName != null && identityUser.Email != null)
                    {
                        return Ok(await BuildLoginResponseDtoAsync(identityUser, roles.ToList()));
                    }
                }
            }

            // If the email or password is incorrect, return a validation problem
            ModelState.AddModelError("", "Email or Password is incorrect");
            return ValidationProblem(ModelState);
        }

        // POST: {apiBaseUrl}/api/auth/logout - Delete the server-owned authentication cookie
        [HttpPost]
        [Route("logout")]
        [AllowAnonymous]
        public IActionResult Logout()
        {
            DeleteAuthorizationCookie();
            return NoContent();
        }

        // POST: {apiBaseUrl}/api/auth/register - Endpoint to register a new user
        [HttpPost]
        [Route("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequestDto request)
        {
            var userName = request.UserName?.Trim();
            var email = request.Email?.Trim();

            if (string.IsNullOrWhiteSpace(userName))
            {
                ModelState.AddModelError("userName", "Username is required");
            }

            if (string.IsNullOrWhiteSpace(email))
            {
                ModelState.AddModelError("email", "Email is required");
            }

            if (!ModelState.IsValid)
            {
                return ValidationProblem(ModelState);
            }

            // Check if the email entry is formatted correctly
            try
            {
                var addr = new System.Net.Mail.MailAddress(email!);
                if (!string.Equals(addr.Address, email, StringComparison.OrdinalIgnoreCase))
                {
                    ModelState.AddModelError("email", "Invalid email format");
                    return ValidationProblem(ModelState);
                }
            }
            catch (FormatException)
            {
                ModelState.AddModelError("email", "Invalid email format");
                return ValidationProblem(ModelState);
            }

            // Check if the email is already taken
            var existingUserByEmail = await userManager.FindByEmailAsync(email!);
            if (existingUserByEmail is not null)
            {
                ModelState.AddModelError("email", "Email is already taken");
                return ValidationProblem(ModelState);
            }

            // Check if the username is already taken
            var existingUserByUsername = await userManager.FindByNameAsync(userName!);
            if (existingUserByUsername is not null)
            {
                ModelState.AddModelError("userName", "Username is already taken");
                return ValidationProblem(ModelState);
            }

            // Create a new IdentityUser object
            var user = new IdentityUser
            {
                UserName = userName,
                Email = email
            };

            // Create the user in the database
            IdentityResult identityResult;
            try
            {
                identityResult = await userManager.CreateAsync(user, request.Password);
            }
            catch (DbUpdateException exception)
            {
                if (!TryAddUniqueIdentityError(exception))
                {
                    throw;
                }

                return ValidationProblem(ModelState);
            }

            if (identityResult.Succeeded)
            {
                // Add the default role of 'Reader' to the new user
                identityResult = await userManager.AddToRoleAsync(user, "Reader");
                if (identityResult.Succeeded)
                {
                    // Return a login payload so registration also starts an authenticated session
                    var roles = await userManager.GetRolesAsync(user);
                    return Ok(await BuildLoginResponseDtoAsync(user, roles.ToList()));
                }
            }

            AddIdentityErrorsToModelState(identityResult);
            return ValidationProblem(ModelState);
        }

        // GET: {apiBaseUrl}/api/auth/me - Endpoint to get the current user's profile
        [HttpGet]
        [Route("me")]
        [Authorize(Roles = "Reader,Writer")]
        public async Task<IActionResult> GetCurrentProfile()
        {
            var user = await GetCurrentUserAsync();
            if (user is null)
            {
                return Unauthorized();
            }

            return Ok(await BuildUserResponseDtoAsync(user));
        }

        // PUT: {apiBaseUrl}/api/auth/me - Endpoint to update the current user's profile
        [HttpPut]
        [Route("me")]
        [Authorize(Roles = "Reader,Writer")]
        public async Task<IActionResult> UpdateCurrentProfile([FromBody] UpdateProfileRequestDto request)
        {
            var user = await GetCurrentUserAsync();
            if (user is null)
            {
                return Unauthorized();
            }

            var userName = request.UserName?.Trim();
            var email = request.Email?.Trim();

            if (string.IsNullOrWhiteSpace(userName))
            {
                ModelState.AddModelError("userName", "Username is required");
            }

            if (string.IsNullOrWhiteSpace(email))
            {
                ModelState.AddModelError("email", "Email is required");
            }
            else if (!IsValidEmail(email))
            {
                ModelState.AddModelError("email", "Invalid email format");
            }

            if (
                !string.IsNullOrWhiteSpace(request.ProfileImagePosition)
                && !IsValidProfileImagePosition(request.ProfileImagePosition)
            )
            {
                ModelState.AddModelError(
                    nameof(request.ProfileImagePosition),
                    "Profile picture position must use two percentages between 0% and 100% and an optional zoom between 85% and 170%"
                );
            }

            if (
                !string.IsNullOrWhiteSpace(request.NewPassword)
                && string.IsNullOrWhiteSpace(request.CurrentPassword)
            )
            {
                ModelState.AddModelError(
                    nameof(request.CurrentPassword),
                    "Current password is required to set a new password"
                );
            }

            if (!ModelState.IsValid)
            {
                return ValidationProblem(ModelState);
            }

            var isUserNameChanging = !string.Equals(
                user.UserName,
                userName,
                StringComparison.Ordinal
            );
            var isEmailChanging = !string.Equals(
                user.Email,
                email,
                StringComparison.OrdinalIgnoreCase
            );

            // Validate both requested identifiers before changing either one.
            // This prevents a known conflict from partially updating the profile.
            if (isUserNameChanging)
            {
                var existingUserByUsername = await userManager.FindByNameAsync(userName!);
                if (existingUserByUsername is not null && existingUserByUsername.Id != user.Id)
                {
                    ModelState.AddModelError("userName", "Username is already taken");
                }
            }

            if (isEmailChanging)
            {
                var existingUserByEmail = await userManager.FindByEmailAsync(email!);
                if (existingUserByEmail is not null && existingUserByEmail.Id != user.Id)
                {
                    ModelState.AddModelError("email", "Email is already taken");
                }
            }

            if (!ModelState.IsValid)
            {
                return ValidationProblem(ModelState);
            }

            // UserManager writes through this scoped context. Keeping those writes
            // in one transaction prevents a successful username change from being
            // committed when a later email change loses a uniqueness race.
            await using var transaction = await authDbContext.Database.BeginTransactionAsync();
            try
            {
                if (isUserNameChanging)
                {
                    var setUserNameResult = await userManager.SetUserNameAsync(user, userName);
                    if (!setUserNameResult.Succeeded)
                    {
                        AddIdentityErrorsToModelState(setUserNameResult);
                        await transaction.RollbackAsync();
                        return ValidationProblem(ModelState);
                    }
                }

                if (isEmailChanging)
                {
                    var setEmailResult = await userManager.SetEmailAsync(user, email);
                    if (!setEmailResult.Succeeded)
                    {
                        AddIdentityErrorsToModelState(setEmailResult);
                        await transaction.RollbackAsync();
                        return ValidationProblem(ModelState);
                    }
                }

                if (!string.IsNullOrWhiteSpace(request.ProfileImagePosition))
                {
                    var replacePositionResult = await ReplaceClaimAsync(
                        user,
                        ProfileImagePositionClaimType,
                        NormalizeProfileImagePosition(request.ProfileImagePosition)
                    );

                    if (!replacePositionResult.Succeeded)
                    {
                        AddIdentityErrorsToModelState(replacePositionResult);
                        await transaction.RollbackAsync();
                        return ValidationProblem(ModelState);
                    }
                }

                if (!string.IsNullOrWhiteSpace(request.NewPassword))
                {
                    var changePasswordResult = await userManager.ChangePasswordAsync(
                        user,
                        request.CurrentPassword!,
                        request.NewPassword
                    );

                    if (!changePasswordResult.Succeeded)
                    {
                        AddIdentityErrorsToModelState(changePasswordResult);
                        await transaction.RollbackAsync();
                        return ValidationProblem(ModelState);
                    }
                }

                await transaction.CommitAsync();
            }
            catch (DbUpdateException exception)
            {
                await transaction.RollbackAsync();
                if (!TryAddUniqueIdentityError(exception))
                {
                    throw;
                }

                return ValidationProblem(ModelState);
            }

            user = await userManager.FindByIdAsync(user.Id) ?? user;
            var roles = await userManager.GetRolesAsync(user);
            return Ok(await BuildLoginResponseDtoAsync(user, roles.ToList()));
        }

        // DELETE: {apiBaseUrl}/api/auth/me - Delete the authenticated user's own account
        [HttpDelete]
        [Route("me")]
        [Authorize]
        public async Task<IActionResult> DeleteCurrentAccount()
        {
            var user = await GetCurrentUserAsync();
            if (user is null)
            {
                return Unauthorized();
            }

            // The seeded administrator must remain available for managing a new installation
            if (await IsProtectedAdminUserAsync(user))
            {
                ModelState.AddModelError("", "The initial admin user cannot be deleted.");
                return ValidationProblem(ModelState);
            }

            var result = await DeleteUserAccountAsync(user);
            if (!result.Succeeded)
            {
                AddIdentityErrorsToModelState(result);
                return ValidationProblem(ModelState);
            }

            DeleteAuthorizationCookie();
            return NoContent();
        }

        // GET: {apiBaseUrl}/api/auth/users - Endpoint to get all users with optional query, sorting, and pagination
        [HttpGet]
        [Route("users")]
        [Authorize(Roles = "Writer")]
        public async Task<IActionResult> GetAllUsers(
            [FromQuery] string? query,
            [FromQuery] string? sortBy,
            [FromQuery] string? sortDirection,
            [FromQuery] int? pageNumber,
            [FromQuery] int? pageSize
        )
        {
            // Filter out the initial administrator by its non-delegable role
            var initialAdmins = await userManager.GetUsersInRoleAsync(
                IdentitySeedConstants.InitialAdminRole
            );
            var initialAdminIds = initialAdmins.Select(user => user.Id).ToArray();
            var usersQuery =
                userManager
                    .Users?.Where(u => !initialAdminIds.Contains(u.Id) && u.UserName != null)
                    .AsQueryable() ?? Enumerable.Empty<IdentityUser>().AsQueryable();

            // Apply query filtering if provided
            if (!string.IsNullOrWhiteSpace(query))
            {
                var userNamePrefix = query.Trim();
                usersQuery = usersQuery.Where(u =>
                    u.UserName != null && u.UserName.StartsWith(userNamePrefix)
                );
            }

            // Apply sorting if provided
            if (!string.IsNullOrWhiteSpace(sortBy))
            {
                if (string.Equals(sortBy, "userName", StringComparison.OrdinalIgnoreCase))
                {
                    var isAsc = string.Equals(
                        sortDirection,
                        "asc",
                        StringComparison.OrdinalIgnoreCase
                    );
                    usersQuery = isAsc
                        ? usersQuery.OrderBy(u => u.UserName).ThenBy(u => u.Id)
                        : usersQuery.OrderByDescending(u => u.UserName).ThenBy(u => u.Id);
                }
                else if (string.Equals(sortBy, "email", StringComparison.OrdinalIgnoreCase))
                {
                    var isAsc = string.Equals(
                        sortDirection,
                        "asc",
                        StringComparison.OrdinalIgnoreCase
                    );
                    usersQuery = isAsc
                        ? usersQuery.OrderBy(u => u.Email).ThenBy(u => u.Id)
                        : usersQuery.OrderByDescending(u => u.Email).ThenBy(u => u.Id);
                }
            }
            else
            {
                // Keep the default manage-users view alphabetical and pagination stable
                usersQuery = usersQuery.OrderBy(u => u.UserName).ThenBy(u => u.Id);
            }

            // Apply pagination
            // Pag number 1 page size 5- skip 0, take 5 (and so on)
            var skipResults = (pageNumber - 1) * pageSize;
            usersQuery = usersQuery.Skip(skipResults ?? 0).Take(pageSize ?? 100);

            // Convert to DTO
            var users = await usersQuery.ToListAsync();
            var response = new List<UserResponseDto>();

            foreach (var user in users)
            {
                response.Add(await BuildUserResponseDtoAsync(user));
            }

            return Ok(response);
        }

        // GET: {apiBaseUrl}/api/auth/users/{id} - Endpoint to get a user by their ID
        [HttpGet]
        [Route("users/{id}")]
        [Authorize(Roles = "Writer")]
        public async Task<IActionResult> GetUserById([FromRoute] string id)
        {
            // Find the user by their ID
            var user = await userManager.FindByIdAsync(id);
            if (user is null)
            {
                return NotFound();
            }

            return Ok(await BuildUserResponseDtoAsync(user));
        }

        // POST: {apiBaseUrl}/api/auth/profile-image - Upload a profile picture for the current user
        [HttpPost]
        [Route("profile-image")]
        [Authorize(Roles = "Reader,Writer")]
        public async Task<IActionResult> UploadProfileImage(
            [FromForm] IFormFile? file,
            [FromForm] string? profileImagePosition
        )
        {
            ValidateProfileImageUpload(file);

            if (
                !string.IsNullOrWhiteSpace(profileImagePosition)
                && !IsValidProfileImagePosition(profileImagePosition)
            )
            {
                ModelState.AddModelError(
                    nameof(profileImagePosition),
                    "Profile picture position must use two percentages between 0% and 100% and an optional zoom between 85% and 170%"
                );
            }

            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var user = await GetCurrentUserAsync();
            if (user is null)
            {
                return Unauthorized();
            }

            var fileExtension = Path.GetExtension(file!.FileName).ToLowerInvariant();
            var profilePicturesDirectory = Path.Combine(
                webHostEnvironment.ContentRootPath,
                "Images",
                "ProfilePictures"
            );
            Directory.CreateDirectory(profilePicturesDirectory);

            var fileName = $"{user.Id}-{Guid.NewGuid():N}{fileExtension}";
            var localPath = Path.Combine(profilePicturesDirectory, fileName);

            await using (var stream = new FileStream(localPath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            var profileImageUrl =
                $"{Request.Scheme}://{Request.Host}{Request.PathBase}/Images/ProfilePictures/{fileName}";
            var previousProfileImageUrl = await GetClaimValueAsync(user, ProfileImageClaimType);

            var replacePositionResult = await ReplaceClaimAsync(
                user,
                ProfileImagePositionClaimType,
                NormalizeProfileImagePosition(profileImagePosition ?? DefaultProfileImagePosition)
            );

            if (!replacePositionResult.Succeeded)
            {
                DeleteLocalProfileImage(localPath);
                AddIdentityErrorsToModelState(replacePositionResult);
                return ValidationProblem(ModelState);
            }

            var replaceImageResult = await ReplaceClaimAsync(user, ProfileImageClaimType, profileImageUrl);
            if (!replaceImageResult.Succeeded)
            {
                DeleteLocalProfileImage(localPath);
                AddIdentityErrorsToModelState(replaceImageResult);
                return ValidationProblem(ModelState);
            }

            DeletePreviousProfileImage(previousProfileImageUrl);

            return Ok(await BuildUserResponseDtoAsync(user));
        }

        // GET: {apiBaseUrl}/api/auth/count - Endpoint to get the total count of users, excluding the admin
        [HttpGet]
        [Route("count")]
        public async Task<IActionResult> GetUsersTotal()
        {
            // Get total count of users excluding the initial administrator
            var initialAdmins = await userManager.GetUsersInRoleAsync(
                IdentitySeedConstants.InitialAdminRole
            );
            var initialAdminIds = initialAdmins.Select(user => user.Id).ToArray();
            var count = await userManager.Users.CountAsync(user =>
                !initialAdminIds.Contains(user.Id)
            );
            return Ok(count);
        }

        // PUT: {apiBaseUrl}/api/auth/users/{id}/ban - Endpoint to ban a user by their ID
        [HttpPut]
        [Route("users/{id}/ban")]
        [Authorize(Roles = "Writer")]
        public async Task<IActionResult> BanUser(string id)
        {
            var user = await userManager.FindByIdAsync(id);
            if (user is null)
            {
                return NotFound();
            }

            if (await IsProtectedAdminUserAsync(user))
            {
                ModelState.AddModelError("", "The admin user cannot be banned.");
                return ValidationProblem(ModelState);
            }

            var result = await SetUserBanStateAsync(user, true);
            if (!result.Succeeded)
            {
                AddIdentityErrorsToModelState(result);
                return ValidationProblem(ModelState);
            }

            return Ok(await BuildUserResponseDtoAsync(user));
        }

        // PUT: {apiBaseUrl}/api/auth/users/{id}/unban - Endpoint to unban a user by their ID
        [HttpPut]
        [Route("users/{id}/unban")]
        [Authorize(Roles = "Writer")]
        public async Task<IActionResult> UnbanUser(string id)
        {
            var user = await userManager.FindByIdAsync(id);
            if (user is null)
            {
                return NotFound();
            }

            var result = await SetUserBanStateAsync(user, false);
            if (!result.Succeeded)
            {
                AddIdentityErrorsToModelState(result);
                return ValidationProblem(ModelState);
            }

            return Ok(await BuildUserResponseDtoAsync(user));
        }

        // PUT: {apiBaseUrl}/api/auth/users/{id}/writing-privileges - Grant Writer to another user
        [HttpPut]
        [Route("users/{id}/writing-privileges")]
        [Authorize(Roles = IdentitySeedConstants.InitialAdminRole)]
        public async Task<IActionResult> GrantWritingPrivileges(string id)
        {
            var user = await userManager.FindByIdAsync(id);
            if (user is null)
            {
                return NotFound();
            }

            if (await IsProtectedAdminUserAsync(user))
            {
                ModelState.AddModelError("", "Writing privileges can only be granted to another user.");
                return ValidationProblem(ModelState);
            }

            if (!await userManager.IsInRoleAsync(user, IdentitySeedConstants.WriterRole))
            {
                var result = await userManager.AddToRoleAsync(
                    user,
                    IdentitySeedConstants.WriterRole
                );
                if (!result.Succeeded)
                {
                    AddIdentityErrorsToModelState(result);
                    return ValidationProblem(ModelState);
                }
            }

            return Ok(await BuildUserResponseDtoAsync(user));
        }

        // DELETE: {apiBaseUrl}/api/auth/users/{id}/writing-privileges - Remove Writer from another user
        [HttpDelete]
        [Route("users/{id}/writing-privileges")]
        [Authorize(Roles = IdentitySeedConstants.InitialAdminRole)]
        public async Task<IActionResult> RevokeWritingPrivileges(string id)
        {
            var user = await userManager.FindByIdAsync(id);
            if (user is null)
            {
                return NotFound();
            }

            if (await IsProtectedAdminUserAsync(user))
            {
                ModelState.AddModelError("", "Writing privileges can only be changed for another user.");
                return ValidationProblem(ModelState);
            }

            if (await userManager.IsInRoleAsync(user, IdentitySeedConstants.WriterRole))
            {
                var result = await userManager.RemoveFromRoleAsync(
                    user,
                    IdentitySeedConstants.WriterRole
                );
                if (!result.Succeeded)
                {
                    AddIdentityErrorsToModelState(result);
                    return ValidationProblem(ModelState);
                }
            }

            return Ok(await BuildUserResponseDtoAsync(user));
        }

        // DELETE: {apiBaseUrl}/api/auth/users/{id} - Endpoint to delete a user by their ID
        [HttpDelete]
        [Route("users/{id}")]
        [Authorize(Roles = "Writer")]
        public async Task<IActionResult> DeleteUser(string id)
        {
            // Find the user by their ID
            var user = await userManager.FindByIdAsync(id);
            if (user is null)
            {
                return NotFound();
            }

            // Apply the same bootstrap-admin protection to administrative deletion requests
            if (await IsProtectedAdminUserAsync(user))
            {
                ModelState.AddModelError("", "The initial admin user cannot be deleted.");
                return ValidationProblem(ModelState);
            }

            var result = await DeleteUserAccountAsync(user);
            if (!result.Succeeded)
            {
                AddIdentityErrorsToModelState(result);
                return ValidationProblem(ModelState);
            }

            return Ok();
        }

        // Resolve the current Identity user from the authenticated request's email claim
        private async Task<IdentityUser?> GetCurrentUserAsync()
        {
            var email = User.FindFirstValue(ClaimTypes.Email);
            if (string.IsNullOrWhiteSpace(email))
            {
                return null;
            }

            return await userManager.FindByEmailAsync(email);
        }

        // Delete an Identity account and clean up its managed profile picture after success
        private async Task<IdentityResult> DeleteUserAccountAsync(IdentityUser user)
        {
            var profileImageUrl = await GetClaimValueAsync(user, ProfileImageClaimType);
            var result = await userManager.DeleteAsync(user);

            if (result.Succeeded)
            {
                DeletePreviousProfileImage(profileImageUrl);
            }

            return result;
        }

        // Build the login payload with roles, JWT, and optional profile claims
        private async Task<LoginResponseDto> BuildLoginResponseDtoAsync(
            IdentityUser user,
            List<string> roles
        )
        {
            var expiresAt = DateTimeOffset.UtcNow.Add(JwtCookieDefaults.Lifetime);
            var token = tokenRepository.CreateJWTToken(user, roles, expiresAt);
            SetAuthorizationCookie(token, expiresAt);

             
            if (string.IsNullOrWhiteSpace(user.UserName) || string.IsNullOrWhiteSpace(user.Email))
            {
                throw new InvalidOperationException(
                    "An authenticated user must have a username and email address."
                );
            }
            return new LoginResponseDto
            {
                Id = user.Id,
                UserName = user.UserName,
                Email = user.Email,
                Roles = roles,
                ProfileImageUrl = await GetClaimValueAsync(user, ProfileImageClaimType),
                ProfileImagePosition =
                    await GetClaimValueAsync(user, ProfileImagePositionClaimType)
                    ?? DefaultProfileImagePosition
            };
        }

        // Keep the JWT unavailable to JavaScript while allowing the browser to send it to the API.
        private void SetAuthorizationCookie(string token, DateTimeOffset expiresAt)
        {
            Response.Cookies.Append(
                JwtCookieDefaults.Name,
                token,
                CreateAuthorizationCookieOptions(expiresAt)
            );
        }

        // HttpOnly cookies must be removed by the API because client-side JavaScript cannot access them.
        private void DeleteAuthorizationCookie()
        {
            Response.Cookies.Delete(
                JwtCookieDefaults.Name,
                CreateAuthorizationCookieOptions(DateTimeOffset.UnixEpoch)
            );
        }

        private CookieOptions CreateAuthorizationCookieOptions(DateTimeOffset expires)
        {
            return new CookieOptions
            {
                HttpOnly = true,
                Secure = true,
                SameSite = webHostEnvironment.IsDevelopment()
                    ? SameSiteMode.None
                    : SameSiteMode.Strict,
                Path = "/",
                Expires = expires,
                IsEssential = true
            };
        }

        // Build the administrative user payload with roles, profile data, and ban state
        private async Task<UserResponseDto> BuildUserResponseDtoAsync(IdentityUser user)
        {
            var roles = await userManager.GetRolesAsync(user);
            return new UserResponseDto
            {
                Id = user.Id,
                UserName = user.UserName,
                Email = user.Email,
                Roles = roles,
                ProfileImageUrl = await GetClaimValueAsync(user, ProfileImageClaimType),
                ProfileImagePosition =
                    await GetClaimValueAsync(user, ProfileImagePositionClaimType)
                    ?? DefaultProfileImagePosition,
                IsBanned = await IsUserBannedAsync(user)
            };
        }

        // Read the first stored value for a user claim type
        private async Task<string?> GetClaimValueAsync(IdentityUser user, string claimType)
        {
            var claims = await userManager.GetClaimsAsync(user);
            return claims.FirstOrDefault(claim => claim.Type == claimType)?.Value;
        }

        // Interpret the custom ban claim as a case-insensitive Boolean value
        private async Task<bool> IsUserBannedAsync(IdentityUser user)
        {
            var claims = await userManager.GetClaimsAsync(user);
            return claims.Any(claim =>
                claim.Type == UserBanClaimType
                && string.Equals(claim.Value, bool.TrueString, StringComparison.OrdinalIgnoreCase)
            );
        }

        // Replace existing ban claims so each user has at most one authoritative ban state
        private async Task<IdentityResult> SetUserBanStateAsync(IdentityUser user, bool isBanned)
        {
            var existingClaims = (await userManager.GetClaimsAsync(user))
                .Where(claim => claim.Type == UserBanClaimType)
                .ToList();

            foreach (var claim in existingClaims)
            {
                var removeResult = await userManager.RemoveClaimAsync(user, claim);
                if (!removeResult.Succeeded)
                {
                    return removeResult;
                }
            }

            if (!isBanned)
            {
                return IdentityResult.Success;
            }

            return await userManager.AddClaimAsync(
                user,
                new Claim(UserBanClaimType, bool.TrueString)
            );
        }

        // Recognize the seeded administrator by its non-delegable bootstrap role
        private async Task<bool> IsProtectedAdminUserAsync(IdentityUser user)
        {
            return await userManager.IsInRoleAsync(
                user,
                IdentitySeedConstants.InitialAdminRole
            );
        }

        // Remove stale values before storing one current value for a profile claim
        private async Task<IdentityResult> ReplaceClaimAsync(
            IdentityUser user,
            string claimType,
            string value
        )
        {
            var existingClaims = (await userManager.GetClaimsAsync(user))
                .Where(claim => claim.Type == claimType)
                .ToList();

            foreach (var claim in existingClaims)
            {
                var removeResult = await userManager.RemoveClaimAsync(user, claim);
                if (!removeResult.Succeeded)
                {
                    return removeResult;
                }
            }

            return await userManager.AddClaimAsync(user, new Claim(claimType, value));
        }

        // Add validation errors for missing, unsupported, or oversized profile images
        private void ValidateProfileImageUpload(IFormFile? file)
        {
            if (file is null || file.Length == 0)
            {
                ModelState.AddModelError("file", "A profile picture is required");
                return;
            }

            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!AllowedProfileImageExtensions.Contains(extension))
            {
                ModelState.AddModelError("file", "Supported profile picture formats are JPG, PNG, and WEBP");
            }

            if (file.Length > MaxProfileImageSizeInBytes)
            {
                ModelState.AddModelError("file", "Profile picture size cannot be more than 5MB");
            }
        }

        // Validate the normalized email before passing it to ASP.NET Identity
        private static bool IsValidEmail(string email)
        {
            try
            {
                var address = new System.Net.Mail.MailAddress(email);
                return address.Address == email;
            }
            catch (FormatException)
            {
                return false;
            }
        }

        // Validate the stored x, y, and optional zoom values for profile image framing
        private static bool IsValidProfileImagePosition(string value)
        {
            var parts = value.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            return (parts.Length == 2 || parts.Length == 3)
                && IsValidPercent(parts[0])
                && IsValidPercent(parts[1])
                && (parts.Length == 2 || IsValidZoomPercent(parts[2]));
        }

        // Accept positioning percentages only within the visible image range
        private static bool IsValidPercent(string value)
        {
            var numberText = value.Trim().TrimEnd('%');
            return int.TryParse(numberText, out var number) && number >= 0 && number <= 100;
        }

        // Restrict avatar zoom to the range supported by the frontend crop controls
        private static bool IsValidZoomPercent(string value)
        {
            var numberText = value.Trim().TrimEnd('%');
            return int.TryParse(numberText, out var number)
                && number >= MinimumProfileImageZoomPercent
                && number <= MaximumProfileImageZoomPercent;
        }

        // Normalize image framing to the persisted "x% y% zoom%" representation
        private static string NormalizeProfileImagePosition(string value)
        {
            var parts = value.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            if (
                (parts.Length != 2 && parts.Length != 3)
                || !IsValidPercent(parts[0])
                || !IsValidPercent(parts[1])
                || (parts.Length == 3 && !IsValidZoomPercent(parts[2]))
            )
            {
                return DefaultProfileImagePosition;
            }

            var zoom = parts.Length == 3
                ? parts[2].Trim().TrimEnd('%')
                : DefaultProfileImageZoomPercent.ToString();

            return $"{parts[0].Trim().TrimEnd('%')}% {parts[1].Trim().TrimEnd('%')}% {zoom}%";
        }

        // Forward Identity errors through model state so API clients receive useful details
        private void AddIdentityErrorsToModelState(IdentityResult identityResult)
        {
            var errorIndex = 1;
            foreach (var error in identityResult.Errors)
            {
                if (error.Code == nameof(IdentityErrorDescriber.DuplicateUserName))
                {
                    ModelState.AddModelError("userName", "Username is already taken");
                    continue;
                }

                if (error.Code == nameof(IdentityErrorDescriber.DuplicateEmail))
                {
                    ModelState.AddModelError("email", "Email is already taken");
                    continue;
                }

                ModelState.AddModelError($"{errorIndex++}", error.Description);
            }
        }

        // Convert SQL Server's final concurrency guard into the same field-level
        // validation response used by the normal Identity duplicate checks.
        private bool TryAddUniqueIdentityError(DbUpdateException exception)
        {
            var currentException = (Exception?)exception;
            while (currentException is not null)
            {
                if (
                    currentException is SqlException sqlException
                    && (sqlException.Number == 2601 || sqlException.Number == 2627)
                )
                {
                    if (
                        sqlException.Message.Contains(
                            "EmailIndex",
                            StringComparison.OrdinalIgnoreCase
                        )
                    )
                    {
                        ModelState.AddModelError("email", "Email is already taken");
                        return true;
                    }

                    if (
                        sqlException.Message.Contains(
                            "UserNameIndex",
                            StringComparison.OrdinalIgnoreCase
                        )
                    )
                    {
                        ModelState.AddModelError("userName", "Username is already taken");
                        return true;
                    }
                }

                currentException = currentException.InnerException;
            }

            return false;
        }

        // Remove a local profile image only when the resolved file still exists
        private static void DeleteLocalProfileImage(string path)
        {
            if (System.IO.File.Exists(path))
            {
                System.IO.File.Delete(path);
            }
        }

        // Delete only profile images hosted inside this application's managed image directory
        private void DeletePreviousProfileImage(string? profileImageUrl)
        {
            if (
                string.IsNullOrWhiteSpace(profileImageUrl)
                || !Uri.TryCreate(profileImageUrl, UriKind.Absolute, out var uri)
                || !uri.AbsolutePath.StartsWith(
                    "/Images/ProfilePictures/",
                    StringComparison.OrdinalIgnoreCase
                )
            )
            {
                return;
            }

            var fileName = Path.GetFileName(uri.LocalPath);
            if (string.IsNullOrWhiteSpace(fileName))
            {
                return;
            }

            var localPath = Path.Combine(
                webHostEnvironment.ContentRootPath,
                "Images",
                "ProfilePictures",
                fileName
            );

            DeleteLocalProfileImage(localPath);
        }
    }
}
