using SpaceOfThoughts.API.Models.Domain;

namespace SpaceOfThoughts.API.Repositories.Interface
{
    // Interface for managing Category entities
    public interface ICategoryRepository
    {
        // Method to create a new category
        Task<Category> CreateAsync(Category category);

        // Method to get all categories with optional filtering, sorting, and pagination
        Task<IEnumerable<Category>> GetAllAsync(
            string? query = null,
            string? sortBy = null,
            string? sortDirection = null,
            int? pageNumber = 1,
            int? pageSize = 100
        );

        // Method to get the total count of categories
        Task<int> GetCount();

        // Method to get a category by ID
        Task<Category?> GetById(Guid id);

        // Method to update an existing category
        Task<Category?> UpdateAsync(Category category);

        // Method to delete a category by ID
        Task<Category?> DeleteAsync(Guid id);
    }
}
