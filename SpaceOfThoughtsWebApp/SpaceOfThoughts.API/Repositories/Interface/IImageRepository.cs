using SpaceOfThoughts.API.Models.Domain;

using SpaceOfThoughts.API.Storage;

namespace SpaceOfThoughts.API.Repositories.Interface
{
    // Interface for managing BlogImage entities
    public interface IImageRepository
    {
        // Upload a new image or return null when its normalized filename already exists
        Task<BlogImage?> Upload(
            IFormFile file,
            BlogImage blogImage,
            PublicImageCategory category
        );

        // Method to get all images with optional sorting
        Task<IEnumerable<BlogImage>> GetAll(
            PublicImageCategory? category,
            string? sortBy,
            string? sortDirection
        );

        // Method to delete an image by ID
        Task<BlogImage?> DeleteAsync(Guid id);
    }
}
