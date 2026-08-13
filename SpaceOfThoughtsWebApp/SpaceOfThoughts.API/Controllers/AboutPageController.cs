using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SpaceOfThoughts.API.Models.Domain;
using SpaceOfThoughts.API.Models.DTOs;
using SpaceOfThoughts.API.Repositories.Interface;
using SpaceOfThoughts.API.Validation;

namespace SpaceOfThoughts.API.Controllers
{
    // The AboutPageController handles reading and editing the public about page content
    [Route("api/[controller]")]
    [ApiController]
    public class AboutPageController : ControllerBase
    {
        private readonly IAboutPageRepository aboutPageRepository;

        // Constructor to initialize the about page repository
        public AboutPageController(IAboutPageRepository aboutPageRepository)
        {
            this.aboutPageRepository = aboutPageRepository;
        }

        // GET: {apiBaseUrl}/api/AboutPage - Endpoint to get the public about page
        [HttpGet]
        public async Task<IActionResult> GetAboutPage()
        {
            var aboutPage = await aboutPageRepository.GetAsync();
            if (aboutPage is null)
            {
                return NotFound();
            }

            return Ok(MapToDto(aboutPage));
        }

        // PUT: {apiBaseUrl}/api/AboutPage - Endpoint to update the about page for writers
        [HttpPut]
        [Authorize(Roles = "Writer")]
        public async Task<IActionResult> UpdateAboutPage([FromBody] UpdateAboutPageRequestDto request)
        {
            // Reject a framing string the about page editor could not have produced
            var framingFailure = ImageFramingValidator.Validate(
                request.ProfileImagePosition
            );
            if (framingFailure is not null)
            {
                ModelState.AddModelError(
                    nameof(request.ProfileImagePosition),
                    framingFailure
                );
                return BadRequest(ModelState);
            }

            var aboutPage = new AboutPage
            {
                AuthorName = request.AuthorName,
                AuthorRole = request.AuthorRole,
                SignatureCaption = request.SignatureCaption,
                ProfileImageUrl = request.ProfileImageUrl,
                ProfileImagePosition = string.IsNullOrWhiteSpace(
                    request.ProfileImagePosition
                )
                    ? null
                    : request.ProfileImagePosition.Trim(),
                AuthorIntro = request.AuthorIntro,
                AuthorAside = request.AuthorAside,
                BlogOverview = request.BlogOverview,
                BlogAudience = request.BlogAudience,
                BlogDifference = request.BlogDifference,
                CommunityIntro = request.CommunityIntro,
                RespectGuideline = request.RespectGuideline,
                TopicGuideline = request.TopicGuideline,
                SpamGuideline = request.SpamGuideline,
                ModerationGuideline = request.ModerationGuideline,
                AgreementGuideline = request.AgreementGuideline,
                Consequences = request.Consequences,
                ContactEmail = request.ContactEmail,
                UpdatedAt = DateTime.UtcNow
            };

            // Update the single persisted about page record
            var updatedAboutPage = await aboutPageRepository.UpdateAsync(aboutPage);
            return Ok(MapToDto(updatedAboutPage));
        }

        // Convert AboutPage domain model to DTO
        private static AboutPageDto MapToDto(AboutPage aboutPage)
        {
            return new AboutPageDto
            {
                Id = aboutPage.Id,
                AuthorName = aboutPage.AuthorName,
                AuthorRole = aboutPage.AuthorRole,
                SignatureCaption = aboutPage.SignatureCaption,
                ProfileImageUrl = aboutPage.ProfileImageUrl,
                ProfileImagePosition = aboutPage.ProfileImagePosition,
                AuthorIntro = aboutPage.AuthorIntro,
                AuthorAside = aboutPage.AuthorAside,
                BlogOverview = aboutPage.BlogOverview,
                BlogAudience = aboutPage.BlogAudience,
                BlogDifference = aboutPage.BlogDifference,
                CommunityIntro = aboutPage.CommunityIntro,
                RespectGuideline = aboutPage.RespectGuideline,
                TopicGuideline = aboutPage.TopicGuideline,
                SpamGuideline = aboutPage.SpamGuideline,
                ModerationGuideline = aboutPage.ModerationGuideline,
                AgreementGuideline = aboutPage.AgreementGuideline,
                Consequences = aboutPage.Consequences,
                ContactEmail = aboutPage.ContactEmail,
                UpdatedAt = aboutPage.UpdatedAt
            };
        }
    }
}
