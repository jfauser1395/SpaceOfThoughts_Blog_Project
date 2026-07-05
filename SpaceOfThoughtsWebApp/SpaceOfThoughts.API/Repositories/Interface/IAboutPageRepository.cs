using SpaceOfThoughts.API.Models.Domain;

namespace SpaceOfThoughts.API.Repositories.Interface
{
    // Interface for managing the about page entity
    public interface IAboutPageRepository
    {
        // Method to get the stored about page
        Task<AboutPage?> GetAsync();

        // Method to update the stored about page
        Task<AboutPage> UpdateAsync(AboutPage aboutPage);
    }
}
