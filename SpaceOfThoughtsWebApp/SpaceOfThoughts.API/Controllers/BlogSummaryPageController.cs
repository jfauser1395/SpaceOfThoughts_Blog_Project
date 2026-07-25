using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SpaceOfThoughts.API.Models.Domain;
using SpaceOfThoughts.API.Models.DTOs;
using SpaceOfThoughts.API.Repositories.Interface;

namespace SpaceOfThoughts.API.Controllers
{
    // The BlogSummaryPageController handles settings for the public blogs summary page
    [Route("api/[controller]")]
    [ApiController]
    public class BlogSummaryPageController : ControllerBase
    {
        private readonly IBlogSummaryPageRepository blogSummaryPageRepository;

        // Constructor to initialize the blog summary page repository
        public BlogSummaryPageController(IBlogSummaryPageRepository blogSummaryPageRepository)
        {
            this.blogSummaryPageRepository = blogSummaryPageRepository;
        }

        // GET: {apiBaseUrl}/api/BlogSummaryPage - Endpoint to get blogs page display settings
        [HttpGet]
        public async Task<IActionResult> GetBlogSummaryPage()
        {
            var blogSummaryPage = await blogSummaryPageRepository.GetAsync();
            if (blogSummaryPage is null)
            {
                return NotFound();
            }

            return Ok(MapToDto(blogSummaryPage));
        }

        // PUT: {apiBaseUrl}/api/BlogSummaryPage - Endpoint to update blogs page settings for writers
        [HttpPut]
        [Authorize(Roles = "Writer")]
        public async Task<IActionResult> UpdateBlogSummaryPage(
            [FromBody] UpdateBlogSummaryPageRequestDto request
        )
        {
            var blogSummaryPage = new BlogSummaryPage
            {
                BackgroundImageUrl = string.IsNullOrWhiteSpace(request.BackgroundImageUrl)
                    ? null
                    : request.BackgroundImageUrl.Trim(),
                UpdatedAt = DateTime.UtcNow
            };

            // Update the single persisted blogs page record
            var updatedBlogSummaryPage = await blogSummaryPageRepository.UpdateAsync(blogSummaryPage);
            return Ok(MapToDto(updatedBlogSummaryPage));
        }

        // DELETE: {apiBaseUrl}/api/BlogSummaryPage - Remove current blogs page settings for writers
        [HttpDelete]
        [Authorize(Roles = "Writer")]
        public async Task<IActionResult> DeleteBlogSummaryPage()
        {
            var wasDeleted = await blogSummaryPageRepository.DeleteAsync();
            if (!wasDeleted)
            {
                return NotFound();
            }

            return NoContent();
        }

        // DELETE: {apiBaseUrl}/api/BlogSummaryPage/background-image - Clear only its picture
        [HttpDelete("background-image")]
        [Authorize(Roles = "Writer")]
        public async Task<IActionResult> RemoveBlogSummaryBackgroundImage()
        {
            var blogSummaryPage = await blogSummaryPageRepository.RemoveBackgroundImageAsync();
            if (blogSummaryPage is null)
            {
                return NotFound();
            }

            return Ok(MapToDto(blogSummaryPage));
        }

        // Convert BlogSummaryPage domain model to DTO
        private static BlogSummaryPageDto MapToDto(BlogSummaryPage blogSummaryPage)
        {
            return new BlogSummaryPageDto
            {
                Id = blogSummaryPage.Id,
                BackgroundImageUrl = blogSummaryPage.BackgroundImageUrl,
                UpdatedAt = blogSummaryPage.UpdatedAt
            };
        }
    }
}
