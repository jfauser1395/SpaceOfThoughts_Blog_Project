using SpaceOfThoughts.API.Models.Domain;

namespace SpaceOfThoughts.API.Repositories.Interface
{
    // Interface for managing blogs summary page settings
    public interface IBlogSummaryPageRepository
    {
        // Method to get blogs summary page settings
        Task<BlogSummaryPage?> GetAsync();

        // Method to update blogs summary page settings
        Task<BlogSummaryPage> UpdateAsync(BlogSummaryPage blogSummaryPage);

        // Method to remove stored blogs summary page settings and report whether they existed
        Task<bool> DeleteAsync();

        // Method to clear only the stored blogs page background image reference
        Task<BlogSummaryPage?> RemoveBackgroundImageAsync();
    }
}
