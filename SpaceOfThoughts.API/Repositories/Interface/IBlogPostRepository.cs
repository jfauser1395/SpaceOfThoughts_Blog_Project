using SpaceOfThoughts.API.Models.Domain;

namespace SpaceOfThoughts.API.Repositories.Interface
{
    // Interface for managing BlogPost entities
    public interface IBlogPostRepository
    {
        // Method to create a new blog post
        Task<BlogPost> CreateAsync(BlogPost blogPost);

        // Method to get all blog posts with optional filtering, sorting, and pagination
        Task<IEnumerable<BlogPost>> GetAllAsync(
            string? query = null,
            string? sortBy = null,
            string? sortDirection = null,
            int? pageNumber = 1,
            int? pageSize = 100
        );

        // Method to get the total count of blog posts
        Task<int> GetCount();

        // Method to get a blog post by ID
        Task<BlogPost?> GetByIdAsync(Guid id);

        // Method to get a blog post by URL handle
        Task<BlogPost?> GetByUrlHandleAsync(string urlHandle);

        // Method to update an existing blog post
        Task<BlogPost?> UpdateAsync(BlogPost blogPost);

        // Method to delete a blog post by ID
        Task<BlogPost?> DeleteAsync(Guid id);
    }
}
