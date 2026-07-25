using Microsoft.EntityFrameworkCore;
using SpaceOfThoughts.API.Data;
using SpaceOfThoughts.API.Models.Domain;
using SpaceOfThoughts.API.Repositories.Interface;

namespace SpaceOfThoughts.API.Repositories.Implementation
{
    // CoverPageRepository handles operations for the single CoverPage entity
    public class CoverPageRepository : ICoverPageRepository
    {
        private readonly ApplicationDbContext dbContext;

        // Constructor to initialize ApplicationDbContext
        public CoverPageRepository(ApplicationDbContext dbContext)
        {
            this.dbContext = dbContext;
        }

        // Get the stored cover page
        public async Task<CoverPage?> GetAsync()
        {
            return await dbContext.CoverPages
                .OrderBy(coverPage => coverPage.Id)
                .FirstOrDefaultAsync();
        }

        // Update the stored cover page or create it if it does not exist yet
        public async Task<CoverPage> UpdateAsync(CoverPage coverPage)
        {
            var existingCoverPage = await dbContext.CoverPages
                .OrderBy(coverPage => coverPage.Id)
                .FirstOrDefaultAsync();

            if (existingCoverPage is null)
            {
                // Create the first stored cover page only when a writer saves it
                await dbContext.CoverPages.AddAsync(coverPage);
            }
            else
            {
                // Copy editable fields onto the tracked entity before saving
                existingCoverPage.Kicker = coverPage.Kicker;
                existingCoverPage.WelcomeTitle = coverPage.WelcomeTitle;
                existingCoverPage.Introduction = coverPage.Introduction;
                existingCoverPage.BackgroundImageUrl = coverPage.BackgroundImageUrl;
                existingCoverPage.BackgroundOverlayStrength = coverPage.BackgroundOverlayStrength;
                existingCoverPage.UpdatedAt = coverPage.UpdatedAt;
                coverPage = existingCoverPage;
            }

            await dbContext.SaveChangesAsync();
            return coverPage;
        }

        // Remove the persisted cover page without deleting its shared background image
        public async Task<bool> DeleteAsync()
        {
            var existingCoverPage = await dbContext.CoverPages
                .OrderBy(coverPage => coverPage.Id)
                .FirstOrDefaultAsync();
            if (existingCoverPage is null)
            {
                return false;
            }

            dbContext.CoverPages.Remove(existingCoverPage);
            await dbContext.SaveChangesAsync();
            return true;
        }

        // Clear only the page's image reference while preserving its published text
        public async Task<CoverPage?> RemoveBackgroundImageAsync()
        {
            var existingCoverPage = await dbContext.CoverPages
                .OrderBy(coverPage => coverPage.Id)
                .FirstOrDefaultAsync();
            if (existingCoverPage is null)
            {
                return null;
            }

            existingCoverPage.BackgroundImageUrl = null;
            existingCoverPage.UpdatedAt = DateTime.UtcNow;
            await dbContext.SaveChangesAsync();
            return existingCoverPage;
        }
    }
}
