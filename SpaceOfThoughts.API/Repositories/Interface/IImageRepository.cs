using SpaceOfThoughts.API.Models.Domain;

namespace SpaceOfThoughts.API.Repositories.Interface
{
    // Interface for managing BlogImage entities
    public interface IImageRepository
    {
        // Method to upload a new image
        Task<BlogImage> Upload(IFormFile file, BlogImage blogImage);

        // Method to get all images with optional sorting
        Task<IEnumerable<BlogImage>> GetAll(string? sortBy, string? sortDirection);

        // Method to delete an image by ID
        Task<BlogImage?> DeleteAsync(Guid id);
    }
}
