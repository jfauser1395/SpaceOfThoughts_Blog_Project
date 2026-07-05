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
    }
}
