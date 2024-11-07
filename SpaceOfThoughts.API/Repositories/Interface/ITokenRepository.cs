using Microsoft.AspNetCore.Identity;

namespace SpaceOfThoughts.API.Repositories.Interface
{
    // Interface for managing JWT token creation
    public interface ITokenRepository
    {
        // Method to create a JWT token for a given user and their roles
        string CreateJWTToken(IdentityUser user, List<string> roles);
    }
}
