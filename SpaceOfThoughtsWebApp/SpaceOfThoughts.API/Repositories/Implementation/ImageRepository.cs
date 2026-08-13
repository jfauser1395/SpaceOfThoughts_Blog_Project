using Microsoft.EntityFrameworkCore;
using SpaceOfThoughts.API.Data;
using SpaceOfThoughts.API.Imaging;
using SpaceOfThoughts.API.Models.Domain;
using SpaceOfThoughts.API.Repositories.Interface;
using SpaceOfThoughts.API.Storage;
using SpaceOfThoughts.API.Text;

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

            // The filename comes from the title rather than from the administrator,
            // so it can never carry spaces, path separators, or a taken name.
            blogImage.FileName = await GenerateUniqueFileNameAsync(
                blogImage.Title,
                blogImage.FileExtension,
                category,
                categoryDirectory
            );
            var storedFileName = $"{blogImage.FileName}{blogImage.FileExtension}";
            var localPath = Path.Combine(
                categoryDirectory,
                storedFileName
            );

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

        // Pick the first free filename for this category, checking both metadata and
        // disk because a stored file can outlive the row that described it
        private async Task<string> GenerateUniqueFileNameAsync(
            string title,
            string fileExtension,
            PublicImageCategory category,
            string categoryDirectory
        )
        {
            var baseFileName = Slug.Create(title);
            var fileName = baseFileName;

            for (var suffix = 2; ; suffix++)
            {
                var candidate = fileName;

                // Reject matching metadata even when its physical file was removed externally
                var matchingImageUrls = await dbContext
                    .BlogImages.AsNoTracking()
                    .Where(image =>
                        image.FileName.ToLower() == candidate.ToLower()
                        && image.FileExtension.ToLower() == fileExtension.ToLower()
                    )
                    .Select(image => image.Url)
                    .ToListAsync();

                var isTaken =
                    matchingImageUrls.Any(url =>
                        ImageStoragePaths.GetCategoryFromUrl(url) == category
                    )
                    // Compare existing files without relying on operating-system case rules
                    || Directory
                        .EnumerateFiles(categoryDirectory)
                        .Select(Path.GetFileName)
                        .Any(existingFileName =>
                            string.Equals(
                                existingFileName,
                                $"{candidate}{fileExtension}",
                                StringComparison.OrdinalIgnoreCase
                            )
                        );

                if (!isTaken)
                {
                    return fileName;
                }

                fileName = $"{baseFileName}-{suffix}";
            }
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
