using Microsoft.EntityFrameworkCore;
using SpaceOfThoughts.API.Data;
using SpaceOfThoughts.API.Models.Domain;
using SpaceOfThoughts.API.Repositories.Interface;

namespace SpaceOfThoughts.API.Repositories.Implementation
{
    // AboutPageRepository handles operations for the single AboutPage entity
    public class AboutPageRepository : IAboutPageRepository
    {
        private readonly ApplicationDbContext dbContext;

        // Constructor to initialize ApplicationDbContext
        public AboutPageRepository(ApplicationDbContext dbContext)
        {
            this.dbContext = dbContext;
        }

        // Get the stored about page
        public async Task<AboutPage?> GetAsync()
        {
            return await dbContext.AboutPages
                .OrderBy(aboutPage => aboutPage.Id)
                .FirstOrDefaultAsync();
        }

        // Update the stored about page or create it if it does not exist yet
        public async Task<AboutPage> UpdateAsync(AboutPage aboutPage)
        {
            var existingAboutPage = await dbContext.AboutPages
                .OrderBy(aboutPage => aboutPage.Id)
                .FirstOrDefaultAsync();

            if (existingAboutPage is null)
            {
                // Create the first stored about page only when a writer saves it
                await dbContext.AboutPages.AddAsync(aboutPage);
            }
            else
            {
                // Copy editable fields onto the tracked entity before saving
                existingAboutPage.AuthorName = aboutPage.AuthorName;
                existingAboutPage.AuthorRole = aboutPage.AuthorRole;
                existingAboutPage.SignatureCaption = aboutPage.SignatureCaption;
                existingAboutPage.ProfileImageUrl = aboutPage.ProfileImageUrl;
                existingAboutPage.ProfileImagePosition = aboutPage.ProfileImagePosition;
                existingAboutPage.AuthorIntro = aboutPage.AuthorIntro;
                existingAboutPage.AuthorAside = aboutPage.AuthorAside;
                existingAboutPage.BlogOverview = aboutPage.BlogOverview;
                existingAboutPage.BlogAudience = aboutPage.BlogAudience;
                existingAboutPage.BlogDifference = aboutPage.BlogDifference;
                existingAboutPage.CommunityIntro = aboutPage.CommunityIntro;
                existingAboutPage.RespectGuideline = aboutPage.RespectGuideline;
                existingAboutPage.TopicGuideline = aboutPage.TopicGuideline;
                existingAboutPage.SpamGuideline = aboutPage.SpamGuideline;
                existingAboutPage.ModerationGuideline = aboutPage.ModerationGuideline;
                existingAboutPage.AgreementGuideline = aboutPage.AgreementGuideline;
                existingAboutPage.Consequences = aboutPage.Consequences;
                existingAboutPage.ContactEmail = aboutPage.ContactEmail;
                existingAboutPage.UpdatedAt = aboutPage.UpdatedAt;
                aboutPage = existingAboutPage;
            }

            await dbContext.SaveChangesAsync();
            return aboutPage;
        }
    }
}
