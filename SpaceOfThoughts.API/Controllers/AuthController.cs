using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SpaceOfThoughts.API.Models.DTOs;
using SpaceOfThoughts.API.Repositories.Interface;

namespace SpaceOfThoughts.API.Controllers
{
    // The AuthController handles user authentication, registration, and management
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly UserManager<IdentityUser> userManager;
        private readonly ITokenRepository tokenRepository;

        // Constructor to initialize UserManager and TokenRepository
        public AuthController(
            UserManager<IdentityUser> userManager,
            ITokenRepository tokenRepository
        )
        {
            this.userManager = userManager;
            this.tokenRepository = tokenRepository;
        }

        // POST: {apiBaseUrl}/api/auth/login - Endpoint to log in a user with email and password
        [HttpPost]
        [Route("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequestDto request)
        {
            var identityUser = await userManager.FindByEmailAsync(request.Email);
            if (identityUser is not null)
            {
                // Check if the provided password matches the user's password
                var checkPasswordResult = await userManager.CheckPasswordAsync(
                    identityUser,
                    request.Password
                );
                if (checkPasswordResult)
                {
                    var roles = await userManager.GetRolesAsync(identityUser);
                    // Create a JWT token and form the login response
                    var jwtToken = tokenRepository.CreateJWTToken(identityUser, roles.ToList());
                    var response = new LoginResponseDto
                    {
                        Id = identityUser.Id,
                        UserName = identityUser.UserName ?? "Unknown User", // Default value if null
                        Email = request.Email,
                        Roles = roles.ToList(),
                        Token = jwtToken
                    };
                    return Ok(response);
                }
            }
            // If the email or password is incorrect, return a validation problem
            ModelState.AddModelError("", "Email or Password is incorrect");
            return ValidationProblem(ModelState);
        }

        // POST: {apiBaseUrl}/api/auth/register - Endpoint to register a new user
        [HttpPost]
        [Route("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequestDto request)
        {
            // Check if the email entry is formatted correctly
            try
            {
                var addr = new System.Net.Mail.MailAddress(request.Email);
                if (addr.Address != request.Email)
                {
                    ModelState.AddModelError("", "Invalid email format");
                    return ValidationProblem(ModelState);
                }
            }
            catch (FormatException)
            {
                ModelState.AddModelError("emailFormat", "Invalid email format");
                return ValidationProblem(ModelState);
            }

            // Check if the email is already taken
            var existingUserByEmail = await userManager.FindByEmailAsync(request.Email);
            if (existingUserByEmail is not null)
            {
                ModelState.AddModelError("email", "Email is already taken");
                return ValidationProblem(ModelState);
            }

            // Check if the username is already taken
            var existingUserByUsername = await userManager.FindByNameAsync(request.UserName);
            if (existingUserByUsername is not null)
            {
                ModelState.AddModelError("userName", "Username is already taken");
                return ValidationProblem(ModelState);
            }

            // Create a new IdentityUser object
            var user = new IdentityUser
            {
                UserName = request.UserName?.Trim(),
                Email = request.Email?.Trim()
            };

            // Create the user in the database
            var identityResult = await userManager.CreateAsync(user, request.Password);
            if (identityResult.Succeeded)
            {
                // Add the default role of 'Reader' to the new user
                identityResult = await userManager.AddToRoleAsync(user, "Reader");
                if (identityResult.Succeeded)
                {
                    return Ok();
                }
                else
                {
                    // Loop through identity errors and add to ModelState
                    int errorIndex = 1;
                    if (identityResult.Errors.Any())
                    {
                        foreach (var error in identityResult.Errors)
                        {
                            ModelState.AddModelError($"{errorIndex}", error.Description);
                            errorIndex++;
                        }
                    }
                }
            }
            else
            {
                // Loop through identity errors and add to ModelState
                int errorIndex = 1;
                if (identityResult.Errors.Any())
                {
                    foreach (var error in identityResult.Errors)
                    {
                        ModelState.AddModelError($"{errorIndex}", error.Description);
                        errorIndex++;
                    }
                }
            }
            return ValidationProblem(ModelState);
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
            // Ensure userManager is not null
            if (userManager == null)
                throw new ArgumentNullException(nameof(userManager));

            // Filter out the admin user by name to not be displayed on the client
            var usersQuery =
                userManager
                    .Users?.Where(u => u.UserName != "Admin" && u.UserName != null)
                    .AsQueryable() ?? Enumerable.Empty<IdentityUser>().AsQueryable();

            // Apply query filtering if provided
            if (!string.IsNullOrWhiteSpace(query))
            {
                usersQuery = usersQuery.Where(u =>
                    u.UserName != null && u.UserName.Contains(query)
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
                        ? usersQuery.OrderBy(u => u.UserName)
                        : usersQuery.OrderByDescending(u => u.UserName);
                }
            }
            else
            {
                // Default OrderBy if none provided
                usersQuery = usersQuery.OrderBy(u => u.Id);
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
                var roles = await userManager.GetRolesAsync(user);
                var userResponse = new UserResponseDto
                {
                    Id = user.Id,
                    UserName = user.UserName,
                    Email = user.Email,
                    Roles = roles
                };
                response.Add(userResponse);
            }

            return Ok(response);
        }

        // GET: {apiBaseUrl}/api/auth/users/{id} - Endpoint to get a user by their ID
        [HttpGet]
        [Route("users/{id}")]
        [Authorize(Roles = "Writer")]
        public async Task<IActionResult> GetUserById([FromRoute] string id)
        {
            var user = await userManager.FindByIdAsync(id);
            if (user is null)
            {
                return NotFound();
            }
            var roles = await userManager.GetRolesAsync(user);
            var response = new UserResponseDto
            {
                Id = user.Id,
                UserName = user.UserName,
                Email = user.Email,
                Roles = roles
            };
            return Ok(response);
        }

        // GET: {apiBaseUrl}/api/auth/count - Endpoint to get the total count of users, excluding the admin
        [HttpGet]
        [Route("count")]
        public async Task<IActionResult> GetUsersTotal()
        {
            var count = await userManager.Users.CountAsync();
            return Ok(count - 1); // -1 because we do not count the admin
        }

        // DELETE: {apiBaseUrl}/api/auth/users/{id} - Endpoint to delete a user by their ID
        [HttpDelete]
        [Route("users/{id}")]
        [Authorize(Roles = "Writer")]
        public async Task<IActionResult> DeleteUser(string id)
        {
            var user = await userManager.FindByIdAsync(id);
            if (user is null)
            {
                return NotFound();
            }
            var result = await userManager.DeleteAsync(user);
            if (!result.Succeeded)
            {
                return BadRequest(result.Errors);
            }
            return Ok();
        }
    }
}
