using Microsoft.EntityFrameworkCore;
using SpaceOfThoughts.API.Data;
using SpaceOfThoughts.API.Models.Domain;
using SpaceOfThoughts.API.Repositories.Interface;

namespace SpaceOfThoughts.API.Repositories.Implementation
{
    // BlogSummaryPageRepository handles operations for the blogs summary page settings
    public class BlogSummaryPageRepository : IBlogSummaryPageRepository
    {
        private readonly ApplicationDbContext dbContext;

        // Constructor to initialize ApplicationDbContext
        public BlogSummaryPageRepository(ApplicationDbContext dbContext)
        {
            this.dbContext = dbContext;
        }

        // Get the stored blogs summary page settings
        public async Task<BlogSummaryPage?> GetAsync()
        {
            return await dbContext.BlogSummaryPages
                .OrderBy(page => page.Id)
                .FirstOrDefaultAsync();
        }

        // Update the stored blogs summary page settings or create them if needed
        public async Task<BlogSummaryPage> UpdateAsync(BlogSummaryPage blogSummaryPage)
        {
            var existingBlogSummaryPage = await dbContext.BlogSummaryPages
                .OrderBy(page => page.Id)
                .FirstOrDefaultAsync();

            if (existingBlogSummaryPage is null)
            {
                // Create the first stored blogs page settings only when a writer saves them
                await dbContext.BlogSummaryPages.AddAsync(blogSummaryPage);
            }
            else
            {
                // Copy editable fields onto the tracked entity before saving
                existingBlogSummaryPage.BackgroundImageUrl = blogSummaryPage.BackgroundImageUrl;
                existingBlogSummaryPage.UpdatedAt = blogSummaryPage.UpdatedAt;
                blogSummaryPage = existingBlogSummaryPage;
            }

            await dbContext.SaveChangesAsync();
            return blogSummaryPage;
        }

        // Remove page-level display settings without deleting blog posts or shared images
        public async Task<bool> DeleteAsync()
        {
            var existingBlogSummaryPage = await dbContext.BlogSummaryPages
                .OrderBy(page => page.Id)
                .FirstOrDefaultAsync();
            if (existingBlogSummaryPage is null)
            {
                return false;
            }

            dbContext.BlogSummaryPages.Remove(existingBlogSummaryPage);
            await dbContext.SaveChangesAsync();
            return true;
        }

        // Clear only the page's image reference while preserving all blog content
        public async Task<BlogSummaryPage?> RemoveBackgroundImageAsync()
        {
            var existingBlogSummaryPage = await dbContext.BlogSummaryPages
                .OrderBy(page => page.Id)
                .FirstOrDefaultAsync();
            if (existingBlogSummaryPage is null)
            {
                return null;
            }

            existingBlogSummaryPage.BackgroundImageUrl = null;
            existingBlogSummaryPage.UpdatedAt = DateTime.UtcNow;
            await dbContext.SaveChangesAsync();
            return existingBlogSummaryPage;
        }
    }
}
