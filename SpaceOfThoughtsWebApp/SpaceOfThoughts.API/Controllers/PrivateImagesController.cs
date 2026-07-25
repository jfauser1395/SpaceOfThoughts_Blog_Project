using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SpaceOfThoughts.API.Models.DTOs;
using SpaceOfThoughts.API.Storage;

namespace SpaceOfThoughts.API.Controllers
{
    // PrivateImagesController streams protected files without exposing the Private folder
    [Route("api/Images/private")]
    [ApiController]
    [Authorize]
    public class PrivateImagesController : ControllerBase
    {
        private const long MaximumFileSizeInBytes = 10 * 1024 * 1024;
        private static readonly IReadOnlyDictionary<string, string> AllowedContentTypes =
            new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                [".jpg"] = "image/jpeg",
                [".jpeg"] = "image/jpeg",
                [".png"] = "image/png",
                [".webp"] = "image/webp"
            };

        private readonly IWebHostEnvironment webHostEnvironment;

        public PrivateImagesController(IWebHostEnvironment webHostEnvironment)
        {
            this.webHostEnvironment = webHostEnvironment;
        }

        // GET: {apiBaseUrl}/api/Images/private - List private images for writers
        [HttpGet]
        [Authorize(Roles = "Writer")]
        public IActionResult GetAll()
        {
            var privateDirectory = ImageStoragePaths.GetPrivateDirectory(
                webHostEnvironment.ContentRootPath
            );
            Directory.CreateDirectory(privateDirectory);

            var response = Directory
                .EnumerateFiles(privateDirectory)
                .Where(filePath => TryGetContentType(filePath, out _))
                .Select(BuildResponse)
                .OrderByDescending(image => image.LastModifiedAt)
                .ToList();

            return Ok(response);
        }

        // GET: {apiBaseUrl}/api/Images/private/{fileName} - Stream one authorized image
        [HttpGet("{fileName}")]
        public IActionResult GetByFileName([FromRoute] string fileName)
        {
            if (
                !ImageStoragePaths.TryGetPrivateFilePath(
                    webHostEnvironment.ContentRootPath,
                    fileName,
                    out var filePath
                )
                || !TryGetContentType(filePath, out var contentType)
            )
            {
                return BadRequest("The private image filename is invalid.");
            }

            if (!System.IO.File.Exists(filePath))
            {
                return NotFound();
            }

            // Prevent shared caches from retaining responses protected by the auth cookie
            Response.Headers.CacheControl = "private, no-store";

            // PhysicalFile streams the image without loading the complete file into memory
            return PhysicalFile(filePath, contentType, enableRangeProcessing: true);
        }

        // POST: {apiBaseUrl}/api/Images/private - Store an image behind authorization
        [HttpPost]
        [Authorize(Roles = "Writer")]
        public async Task<IActionResult> Upload([FromForm] IFormFile? file)
        {
            ValidateUpload(file);
            if (!ModelState.IsValid)
            {
                return ValidationProblem(ModelState);
            }

            var extension = Path.GetExtension(file!.FileName).ToLowerInvariant();
            var fileName = $"{Guid.NewGuid():N}{extension}";
            var privateDirectory = ImageStoragePaths.GetPrivateDirectory(
                webHostEnvironment.ContentRootPath
            );
            Directory.CreateDirectory(privateDirectory);

            var filePath = Path.Combine(privateDirectory, fileName);
            await using (var stream = new FileStream(
                filePath,
                FileMode.CreateNew,
                FileAccess.Write,
                FileShare.None
            ))
            {
                await file.CopyToAsync(stream);
            }

            var response = BuildResponse(filePath);
            return CreatedAtAction(
                nameof(GetByFileName),
                new { fileName = response.FileName },
                response
            );
        }

        // DELETE: {apiBaseUrl}/api/Images/private/{fileName} - Remove a protected image
        [HttpDelete("{fileName}")]
        [Authorize(Roles = "Writer")]
        public IActionResult Delete([FromRoute] string fileName)
        {
            if (
                !ImageStoragePaths.TryGetPrivateFilePath(
                    webHostEnvironment.ContentRootPath,
                    fileName,
                    out var filePath
                )
                || !TryGetContentType(filePath, out _)
            )
            {
                return BadRequest("The private image filename is invalid.");
            }

            if (!System.IO.File.Exists(filePath))
            {
                return NotFound();
            }

            System.IO.File.Delete(filePath);
            return NoContent();
        }

        // Reject empty, unsupported, and oversized files before writing to disk
        private void ValidateUpload(IFormFile? file)
        {
            if (file is null || file.Length == 0)
            {
                ModelState.AddModelError("file", "An image file is required.");
                return;
            }

            if (!TryGetContentType(file.FileName, out _))
            {
                ModelState.AddModelError(
                    "file",
                    "Supported private image formats are JPG, PNG, and WEBP."
                );
            }

            if (file.Length > MaximumFileSizeInBytes)
            {
                ModelState.AddModelError(
                    "file",
                    "File size cannot be more than 10MB."
                );
            }
        }

        // Return the configured MIME type for an allowed image extension
        private static bool TryGetContentType(
            string fileName,
            out string contentType
        )
        {
            return AllowedContentTypes.TryGetValue(
                Path.GetExtension(fileName),
                out contentType!
            );
        }

        // Build the API-facing metadata and authorized download URL for a private file
        private PrivateImageDto BuildResponse(string filePath)
        {
            var fileInfo = new FileInfo(filePath);
            TryGetContentType(fileInfo.Name, out var contentType);

            return new PrivateImageDto
            {
                FileName = fileInfo.Name,
                Url =
                    $"{Request.Scheme}://{Request.Host}{Request.PathBase}/api/Images/private/{Uri.EscapeDataString(fileInfo.Name)}",
                ContentType = contentType,
                SizeInBytes = fileInfo.Length,
                LastModifiedAt = fileInfo.LastWriteTimeUtc
            };
        }
    }
}
