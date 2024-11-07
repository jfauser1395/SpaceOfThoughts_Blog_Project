using Microsoft.EntityFrameworkCore;
using SpaceOfThoughts.API.Data;
using SpaceOfThoughts.API.Models.Domain;
using SpaceOfThoughts.API.Repositories.Interface;

namespace SpaceOfThoughts.API.Repositories.Implementation
{
    // ImageRepository handles CRUD operations for BlogImage entities
    public class ImageRepository : IImageRepository
    {
        private readonly IWebHostEnvironment webHostEnvironment;
        private readonly IHttpContextAccessor httpContextAccessor;
        private readonly ApplicationDbContext dbContext;

        // Constructor to initialize dependencies
        public ImageRepository(
            IWebHostEnvironment webHostEnvironment,
            IHttpContextAccessor httpContextAccessor,
            ApplicationDbContext dbContext
        )
        {
            this.webHostEnvironment = webHostEnvironment;
            this.httpContextAccessor = httpContextAccessor;
            this.dbContext = dbContext;
        }

        // Get all images with optional sorting
        public async Task<IEnumerable<BlogImage>> GetAll(
            string? sortBy = null,
            string? sortDirection = null
        )
        {
            var blogImages = dbContext.BlogImages.AsQueryable();

            // Apply sorting
            if (!string.IsNullOrWhiteSpace(sortBy))
            {
                if (string.Equals(sortBy, "DateCreated", StringComparison.OrdinalIgnoreCase))
                {
                    var isAsc = string.Equals(
                        sortDirection,
                        "asc",
                        StringComparison.OrdinalIgnoreCase
                    );
                    blogImages = isAsc
                        ? blogImages.OrderBy(x => x.DateCreated)
                        : blogImages.OrderByDescending(x => x.DateCreated);
                }
            }

            return await blogImages.ToListAsync(); // Return the list of images
        }

        // Upload a new image
        public async Task<BlogImage> Upload(IFormFile file, BlogImage blogImage)
        {
            // Define the local path to save the image
            var localPath = Path.Combine(
                webHostEnvironment.ContentRootPath,
                "Images",
                $"{blogImage.FileName}{blogImage.FileExtension}"
            );

            // Save the image to the local path
            using var stream = new FileStream(localPath, FileMode.Create);
            await file.CopyToAsync(stream);

            // Construct the URL for accessing the image
            var httpRequestImage = httpContextAccessor?.HttpContext?.Request;
            var urlPath =
                $"https://{httpRequestImage?.Host}{httpRequestImage?.PathBase}/Images/{blogImage.FileName}{blogImage.FileExtension}";
            blogImage.Url = urlPath;

            // Add the image details to the database
            await dbContext.BlogImages.AddAsync(blogImage);
            await dbContext.SaveChangesAsync(); // Save changes to the database
            return blogImage; // Return the uploaded image
        }

        // Delete an image by ID
        public async Task<BlogImage?> DeleteAsync(Guid id)
        {
            var existingImage = await dbContext.BlogImages.FirstOrDefaultAsync(x => x.Id == id);
            if (existingImage is null)
            {
                return null; // Return null if the image was not found
            }

            // Define the file path of the image
            var filePath = Path.Combine(
                webHostEnvironment.ContentRootPath,
                "Images",
                $"{existingImage.FileName}{existingImage.FileExtension}"
            );

            // Check if the file exists and delete it
            if (File.Exists(filePath))
            {
                File.Delete(filePath); // Delete the file
            }

            // Remove the image details from the database
            dbContext.BlogImages.Remove(existingImage);
            await dbContext.SaveChangesAsync(); // Save changes to the database
            return existingImage; // Return the deleted image
        }
    }
}
