using Microsoft.EntityFrameworkCore;
using SpaceOfThoughts.API.Data;
using SpaceOfThoughts.API.Imaging;
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
        private readonly IImageUploadProcessor imageUploadProcessor;

        // Constructor to initialize dependencies
        public ImageRepository(
            IWebHostEnvironment webHostEnvironment,
            IHttpContextAccessor httpContextAccessor,
            ApplicationDbContext dbContext,
            IImageUploadProcessor imageUploadProcessor
        )
        {
            this.webHostEnvironment = webHostEnvironment;
            this.httpContextAccessor = httpContextAccessor;
            this.dbContext = dbContext;
            this.imageUploadProcessor = imageUploadProcessor;
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
            PublicImageCategory category,
            CancellationToken cancellationToken = default
        )
        {
            var categoryDirectory = ImageStoragePaths.GetPublicDirectory(
                webHostEnvironment.ContentRootPath,
                category
            );
            Directory.CreateDirectory(categoryDirectory);

            // Existing legacy files retain their extension. New uploads use one
            // canonical WebP URL so every consumer receives an optimized raster.
            blogImage.FileExtension = ImageUploadProcessor.OutputFileExtension;
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

            try
            {
                await imageUploadProcessor.ProcessAndStoreAsync(
                    file,
                    categoryDirectory,
                    blogImage.FileName,
                    ImageUploadPurpose.PublicLibrary,
                    cancellationToken
                );
            }
            catch (ImageUploadException) when (File.Exists(localPath))
            {
                // Atomic publication is the final guard against two uploads that
                // race after the metadata and directory checks above.
                return null;
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
                await dbContext.SaveChangesAsync(cancellationToken); // Save changes to the database
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
