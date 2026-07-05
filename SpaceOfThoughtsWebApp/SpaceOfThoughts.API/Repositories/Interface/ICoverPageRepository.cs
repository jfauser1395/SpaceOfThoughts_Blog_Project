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
    }
}
