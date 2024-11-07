using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;
using SpaceOfThoughts.API.Repositories.Interface;

namespace SpaceOfThoughts.API.Repositories.Implementation
{
    // TokenRepository handles the creation of JWT tokens for authentication
    public class TokenRepository : ITokenRepository
    {
        private readonly IConfiguration configuration;

        // Constructor to initialize IConfiguration
        public TokenRepository(IConfiguration configuration)
        {
            this.configuration = configuration;
        }

        // Create a JWT token for a given user and their roles
        public string CreateJWTToken(IdentityUser user, List<string> roles)
        {
            // Retrieve JWT configuration values from app settings
            var jwtKey =
                configuration["Jwt:Key"]
                ?? throw new InvalidOperationException("JWT Key is missing");
            var jwtIssuer =
                configuration["Jwt:Issuer"]
                ?? throw new InvalidOperationException("JWT Issuer is missing");
            var jwtAudience =
                configuration["Jwt:Audience"]
                ?? throw new InvalidOperationException("JWT Audience is missing");

            // Create Claims
            var claims = new List<Claim>();

            // Add email claim if it's not null or empty
            if (!string.IsNullOrEmpty(user.Email))
            {
                claims.Add(new Claim(ClaimTypes.Email, user.Email));
            }

            // Add role claims for each role the user belongs to
            claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));

            // JWT Security Token Parameters
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
            var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
            var token = new JwtSecurityToken(
                issuer: jwtIssuer,
                audience: jwtAudience,
                claims: claims,
                expires: DateTime.Now.AddMinutes(15),
                signingCredentials: credentials
            );

            // Return the generated JWT token as a string
            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}
