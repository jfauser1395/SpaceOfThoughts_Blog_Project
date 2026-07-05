using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SpaceOfThoughts.API.Models.Domain;
using SpaceOfThoughts.API.Models.DTOs;
using SpaceOfThoughts.API.Repositories.Interface;

namespace SpaceOfThoughts.API.Controllers
{
    // The CoverPageController handles reading and editing the public cover page
    [Route("api/[controller]")]
    [ApiController]
    public class CoverPageController : ControllerBase
    {
        private readonly ICoverPageRepository coverPageRepository;

        // Constructor to initialize the cover page repository
        public CoverPageController(ICoverPageRepository coverPageRepository)
        {
            this.coverPageRepository = coverPageRepository;
        }

        // GET: {apiBaseUrl}/api/CoverPage - Endpoint to get the public cover page
        [HttpGet]
        public async Task<IActionResult> GetCoverPage()
        {
            var coverPage = await coverPageRepository.GetAsync();
            if (coverPage is null)
            {
                return NotFound();
            }

            return Ok(MapToDto(coverPage));
        }

        // PUT: {apiBaseUrl}/api/CoverPage - Endpoint to update the cover page for writers
        [HttpPut]
        [Authorize(Roles = "Writer")]
        public async Task<IActionResult> UpdateCoverPage([FromBody] UpdateCoverPageRequestDto request)
        {
            // Validate the editable cover page fields before saving
            ValidateCoverPageRequest(request);

            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var coverPage = new CoverPage
            {
                WelcomeTitle = request.WelcomeTitle.Trim(),
                Introduction = request.Introduction.Trim(),
                BackgroundImageUrl = string.IsNullOrWhiteSpace(request.BackgroundImageUrl)
                    ? null
                    : request.BackgroundImageUrl.Trim(),
                UpdatedAt = DateTime.UtcNow
            };

            // Update the single persisted cover page record
            var updatedCoverPage = await coverPageRepository.UpdateAsync(coverPage);
            return Ok(MapToDto(updatedCoverPage));
        }

        // Convert CoverPage domain model to DTO
        private static CoverPageDto MapToDto(CoverPage coverPage)
        {
            return new CoverPageDto
            {
                Id = coverPage.Id,
                WelcomeTitle = coverPage.WelcomeTitle,
                Introduction = coverPage.Introduction,
                BackgroundImageUrl = coverPage.BackgroundImageUrl,
                UpdatedAt = coverPage.UpdatedAt
            };
        }

        // Validate required cover page text
        private void ValidateCoverPageRequest(UpdateCoverPageRequestDto request)
        {
            if (string.IsNullOrWhiteSpace(request.WelcomeTitle))
            {
                ModelState.AddModelError(nameof(request.WelcomeTitle), "Welcome title is required.");
            }

            if (string.IsNullOrWhiteSpace(request.Introduction))
            {
                ModelState.AddModelError(nameof(request.Introduction), "Introduction is required.");
            }
        }
    }
}
