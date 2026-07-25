using SpaceOfThoughts.API.Models.Domain;

namespace SpaceOfThoughts.API.Repositories.Interface
{
    // Interface for managing the cover page entity
    public interface ICoverPageRepository
    {
        // Method to get the stored cover page
        Task<CoverPage?> GetAsync();

        // Method to update the stored cover page
        Task<CoverPage> UpdateAsync(CoverPage coverPage);

        // Method to remove the stored cover page and return whether it existed
        Task<bool> DeleteAsync();

        // Method to clear only the stored cover background image reference
        Task<CoverPage?> RemoveBackgroundImageAsync();
    }
}
