using Microsoft.EntityFrameworkCore;
using SpaceOfThoughts.API.Data;
using SpaceOfThoughts.API.Models.Domain;
using SpaceOfThoughts.API.Repositories.Interface;
using SpaceOfThoughts.API.Storage;

namespace SpaceOfThoughts.API.Repositories.Implementation
{
    // ImageRepository handles CRUD operations for the categorized public image library
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
            PublicImageCategory? category = null,
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

            var images = await blogImages.ToListAsync();

            // A category-specific editor sees only its own image library
            return category.HasValue
                ? images.Where(image =>
                    ImageStoragePaths.GetCategoryFromUrl(image.Url) == category.Value
                )
                : images;
        }

        // Upload a new public image into the folder assigned to its page type
        public async Task<BlogImage?> Upload(
            IFormFile file,
            BlogImage blogImage,
            PublicImageCategory category
        )
        {
            var categoryDirectory = ImageStoragePaths.GetPublicDirectory(
                webHostEnvironment.ContentRootPath,
                category
            );
            Directory.CreateDirectory(categoryDirectory);

            var storedFileName = $"{blogImage.FileName}{blogImage.FileExtension}";
            var localPath = Path.Combine(
                categoryDirectory,
                storedFileName
            );

            // Reject matching metadata even when its physical file was removed externally
            var matchingImageUrls = await dbContext
                .BlogImages.AsNoTracking()
                .Where(image =>
                    image.FileName.ToLower() == blogImage.FileName.ToLower()
                    && image.FileExtension.ToLower()
                        == blogImage.FileExtension.ToLower()
                )
                .Select(image => image.Url)
                .ToListAsync();
            if (
                matchingImageUrls.Any(url =>
                    ImageStoragePaths.GetCategoryFromUrl(url) == category
                )
            )
            {
                return null;
            }

            // Compare existing files without relying on operating-system case rules
            var fileAlreadyExists = Directory
                .EnumerateFiles(categoryDirectory)
                .Select(Path.GetFileName)
                .Any(existingFileName =>
                    string.Equals(
                        existingFileName,
                        storedFileName,
                        StringComparison.OrdinalIgnoreCase
                    )
                );
            if (fileAlreadyExists)
            {
                return null;
            }

            FileStream stream;
            try
            {
                // CreateNew is the atomic final guard against simultaneous duplicate uploads
                stream = new FileStream(
                    localPath,
                    FileMode.CreateNew,
                    FileAccess.Write,
                    FileShare.None
                );
            }
            catch (IOException) when (File.Exists(localPath))
            {
                return null;
            }

            // Delete an incomplete file when copying the request body fails
            try
            {
                await using (stream)
                {
                    await file.CopyToAsync(stream);
                }
            }
            catch
            {
                File.Delete(localPath);
                throw;
            }

            // Construct the public URL using forwarded proxy scheme and host information
            var httpRequestImage = httpContextAccessor?.HttpContext?.Request;
            var urlPath =
                $"{httpRequestImage?.Scheme}://{httpRequestImage?.Host}{httpRequestImage?.PathBase}{ImageStoragePaths.GetPublicUrlPath(category, storedFileName)}";
            blogImage.Url = urlPath;

            // Keep disk and database state aligned if metadata persistence fails
            try
            {
                await dbContext.BlogImages.AddAsync(blogImage);
                await dbContext.SaveChangesAsync(); // Save changes to the database
            }
            catch
            {
                File.Delete(localPath);
                throw;
            }
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

            // Resolve both categorized URLs and legacy /Images/file.ext URLs safely
            var category = ImageStoragePaths.GetCategoryFromUrl(existingImage.Url);
            var storedFileName =
                $"{existingImage.FileName}{existingImage.FileExtension}";
            if (
                ImageStoragePaths.TryGetPublicFilePath(
                    webHostEnvironment.ContentRootPath,
                    category,
                    storedFileName,
                    out var filePath
                )
                && File.Exists(filePath)
            )
            {
                File.Delete(filePath); // Delete only a file contained by the category
            }

            // Remove the image details from the database
            dbContext.BlogImages.Remove(existingImage);
            await dbContext.SaveChangesAsync(); // Save changes to the database
            return existingImage; // Return the deleted image
        }
    }
}
