using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SpaceOfThoughts.API.Models.Domain;
using SpaceOfThoughts.API.Models.DTOs;
using SpaceOfThoughts.API.Repositories.Interface;
using SpaceOfThoughts.API.Storage;

namespace SpaceOfThoughts.API.Controllers
{
    // The ImagesController handles CRUD operations for categorized public images
    [Route("api/[controller]")]
    [ApiController]
    public class ImagesController : ControllerBase
    {
        private readonly IImageRepository imageRepository;

        public ImagesController(IImageRepository imageRepository)
        {
            this.imageRepository = imageRepository;
        }

        // GET: {apiBaseUrl}/api/Images?category=Blog - Get a categorized public image library
        [HttpGet]
        [Authorize(Roles = "Writer")]
        public async Task<IActionResult> GetAllImages(
            [FromQuery] string? category,
            [FromQuery] string? sortBy,
            [FromQuery] string? sortDirection
        )
        {
            PublicImageCategory? parsedCategory = null;
            if (!string.IsNullOrWhiteSpace(category))
            {
                if (
                    !ImageStoragePaths.TryParsePublicCategory(
                        category,
                        out var requestedCategory
                    )
                )
                {
                    return BadRequest(
                        "Category must be Blog, CoverPage, or AboutPage."
                    );
                }

                parsedCategory = requestedCategory;
            }

            // Call image repository to get all images
            var images = await imageRepository.GetAll(
                parsedCategory,
                sortBy,
                sortDirection
            );

            // Convert Domain model to DTO
            var response = new List<BlogImageDto>();
            foreach (var image in images)
            {
                response.Add(
                    new BlogImageDto
                    {
                        Id = image.Id,
                        Title = image.Title,
                        DateCreated = image.DateCreated,
                        FileExtension = image.FileExtension,
                        FileName = image.FileName,
                        Url = image.Url
                    }
                );
            }
            return Ok(response);
        }

        // POST: {apiBaseUrl}/api/Images - Upload an image into a public category
        [HttpPost]
        [Authorize(Roles = "Writer")]
        public async Task<IActionResult> UploadImage(
            [FromForm] IFormFile? file,
            [FromForm] string? fileName,
            [FromForm] string? title,
            [FromForm] string? category
        )
        {
            // Validate both the file and the public storage category before writing
            ValidateFileUpload(file);
            var normalizedFileName = NormalizeFileName(fileName);
            if (
                !ImageStoragePaths.TryParsePublicCategory(
                    category,
                    out var parsedCategory
                )
            )
            {
                ModelState.AddModelError(
                    nameof(category),
                    "Category must be Blog, CoverPage, or AboutPage."
                );
            }

            if (string.IsNullOrWhiteSpace(title))
            {
                ModelState.AddModelError(nameof(title), "An image title is required.");
            }

            // Check if the ModelState is valid
            if (ModelState.IsValid)
            {
                // Create a new BlogImage object
                var blogImage = new BlogImage
                {
                    FileExtension = Path.GetExtension(file!.FileName).ToLowerInvariant(),
                    FileName = normalizedFileName!,
                    Title = title!.Trim(),
                    DateCreated = DateTime.UtcNow,
                };

                // Upload without silently renaming a duplicate administrator filename
                var uploadedImage = await imageRepository.Upload(
                    file,
                    blogImage,
                    parsedCategory
                );
                if (uploadedImage is null)
                {
                    var storedFileName =
                        $"{blogImage.FileName}{blogImage.FileExtension}";
                    ModelState.AddModelError(
                        nameof(fileName),
                        $"An image file named '{storedFileName}' already exists in the {parsedCategory} image library."
                    );

                    // A duplicate filename conflicts with the existing stored resource
                    return Conflict(
                        new ValidationProblemDetails(ModelState)
                        {
                            Status = StatusCodes.Status409Conflict,
                            Title = "Duplicate image filename"
                        }
                    );
                }

                // Convert Domain Model to DTO
                var response = new BlogImageDto
                {
                    Id = uploadedImage.Id,
                    Title = uploadedImage.Title,
                    DateCreated = uploadedImage.DateCreated,
                    FileExtension = uploadedImage.FileExtension,
                    FileName = uploadedImage.FileName,
                    Url = uploadedImage.Url
                };
                return Ok(response);
            }
            return BadRequest(ModelState);
        }

        // Validate the uploaded file before it reaches public storage
        private void ValidateFileUpload(IFormFile? file)
        {
            if (file is null || file.Length == 0)
            {
                ModelState.AddModelError("file", "An image file is required.");
                return;
            }

            var allowedExtension = new string[]
            {
                ".jpg",
                ".jpeg",
                ".png",
                ".svg",
                ".webp"
            };
            if (
                !allowedExtension.Contains(
                    Path.GetExtension(file.FileName).ToLowerInvariant()
                )
            )
            {
                ModelState.AddModelError("file", "Unsupported file format.");
            }
            if (file.Length > 10485760)
            {
                ModelState.AddModelError(
                    "file",
                    "File size cannot be more than 10MB."
                );
            }
        }

        // Normalize the admin filename while rejecting path and unsafe filename characters
        private string? NormalizeFileName(string? fileName)
        {
            var trimmedFileName = fileName?.Trim();
            if (string.IsNullOrWhiteSpace(trimmedFileName))
            {
                ModelState.AddModelError(
                    nameof(fileName),
                    "An image filename is required."
                );
                return null;
            }

            if (
                !string.Equals(
                    Path.GetFileName(trimmedFileName),
                    trimmedFileName,
                    StringComparison.Ordinal
                )
            )
            {
                ModelState.AddModelError(
                    nameof(fileName),
                    "The image filename cannot contain a path."
                );
                return null;
            }

            var normalizedFileName = Path.GetFileNameWithoutExtension(trimmedFileName);
            if (
                string.IsNullOrWhiteSpace(normalizedFileName)
                || normalizedFileName.Any(character =>
                    !char.IsLetterOrDigit(character)
                    && character != '-'
                    && character != '_'
                    && character != ' '
                )
            )
            {
                ModelState.AddModelError(
                    nameof(fileName),
                    "Use only letters, numbers, spaces, hyphens, or underscores in the filename."
                );
                return null;
            }

            // Use one casing so duplicate checks behave identically on Windows and Linux
            return normalizedFileName.ToLowerInvariant();
        }

        // DELETE: {apiBaseUrl}/api/Images/{id} - Endpoint to delete an image by its ID
        [HttpDelete]
        [Route("{id:guid}")]
        [Authorize(Roles = "Writer")]
        public async Task<IActionResult> DeleteImage([FromRoute] Guid id)
        {
            // Call repository to delete the image by its ID
            var deletedImage = await imageRepository.DeleteAsync(id);
            if (deletedImage is null)
            {
                return NotFound();
            }

            // Convert Domain model to DTO
            var response = new BlogImageDto
            {
                Id = deletedImage.Id,
                Title = deletedImage.Title,
                DateCreated = deletedImage.DateCreated,
                FileExtension = deletedImage.FileExtension,
                FileName = deletedImage.FileName,
                Url = deletedImage.Url
            };
            return Ok(response);
        }
    }
}
