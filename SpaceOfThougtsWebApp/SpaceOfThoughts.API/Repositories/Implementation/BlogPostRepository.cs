using Microsoft.EntityFrameworkCore;
using SpaceOfThoughts.API.Data;
using SpaceOfThoughts.API.Models.Domain;
using SpaceOfThoughts.API.Repositories.Interface;

namespace SpaceOfThoughts.API.Repositories.Implementation
{
    // BlogPostRepository handles CRUD operations for BlogPost entities
    public class BlogPostRepository : IBlogPostRepository
    {
        private readonly ApplicationDbContext dbContext;

        // Constructor to initialize ApplicationDbContext
        public BlogPostRepository(ApplicationDbContext dbContext)
        {
            this.dbContext = dbContext;
        }

        // Create a new blog post
        public async Task<BlogPost> CreateAsync(BlogPost blogPost)
        {
            await dbContext.BlogPosts.AddAsync(blogPost); // Add new blog post to the context
            await dbContext.SaveChangesAsync(); // Save changes to the database
            return blogPost; // Return the created blog post
        }

        // Delete a blog post by ID
        public async Task<BlogPost?> DeleteAsync(Guid id)
        {
            var existingBlogPost = await dbContext.BlogPosts.FirstOrDefaultAsync(x => x.Id == id);
            if (existingBlogPost != null)
            {
                dbContext.BlogPosts.Remove(existingBlogPost); // Remove the blog post from the context
                await dbContext.SaveChangesAsync(); // Save changes to the database
                return existingBlogPost; // Return the deleted blog post
            }
            return null; // Return null if the blog post was not found
        }

        // Get all blog posts with optional filtering, sorting, and pagination
        public async Task<IEnumerable<BlogPost>> GetAllAsync(
            string? query = null,
            string? sortBy = null,
            string? sortDirection = null,
            int? pageNumber = 1,
            int? pageSize = 100
        )
        {
            var blogPosts = dbContext.BlogPosts.AsQueryable();

            // Apply filtering
            if (!string.IsNullOrWhiteSpace(query))
            {
                blogPosts = blogPosts.Where(x => x.Title.Contains(query));
            }

            // Apply sorting
            if (!string.IsNullOrWhiteSpace(sortBy))
            {
                if (string.Equals(sortBy, "PublishedDate", StringComparison.OrdinalIgnoreCase))
                {
                    var isAsc = string.Equals(
                        sortDirection,
                        "asc",
                        StringComparison.OrdinalIgnoreCase
                    );
                    blogPosts = isAsc
                        ? blogPosts.OrderBy(x => x.PublishedDate)
                        : blogPosts.OrderByDescending(x => x.PublishedDate);
                }
            }
            else
            {
                // Default OrderBy if none provided
                blogPosts = blogPosts.OrderBy(bp => bp.Id);
            }

            // Apply pagination
            var skipResults = (pageNumber - 1) * pageSize;
            blogPosts = blogPosts.Skip(skipResults ?? 0).Take(pageSize ?? 100);

            // Include related categories and return the list of blog posts
            return await blogPosts.Include(x => x.Categories).ToListAsync();
        }

        // Get a blog post by ID
        public async Task<BlogPost?> GetByIdAsync(Guid id)
        {
            return await dbContext
                .BlogPosts.Include(x => x.Categories) // Include related categories
                .FirstOrDefaultAsync(x => x.Id == id); // Find the blog post by ID
        }

        // Get a blog post by URL handle
        public async Task<BlogPost?> GetByUrlHandleAsync(string urlHandle)
        {
            return await dbContext
                .BlogPosts.Include(x => x.Categories) // Include related categories
                .FirstOrDefaultAsync(x => x.UrlHandle == urlHandle); // Find the blog post by URL handle
        }

        // Get the total count of blog posts
        public async Task<int> GetCount()
        {
            return await dbContext.BlogPosts.CountAsync(); // Count the number of blog posts
        }

        // Update an existing blog post
        public async Task<BlogPost?> UpdateAsync(BlogPost blogPost)
        {
            var existingBlogPost = await dbContext
                .BlogPosts.Include(x => x.Categories) // Include related categories
                .FirstOrDefaultAsync(x => x.Id == blogPost.Id);

            if (existingBlogPost == null)
            {
                return null; // Return null if the blog post was not found
            }

            // Update blog post properties
            dbContext.Entry(existingBlogPost).CurrentValues.SetValues(blogPost);
            existingBlogPost.Categories = blogPost.Categories; // Update related categories

            await dbContext.SaveChangesAsync(); // Save changes to the database
            return blogPost; // Return the updated blog post
        }
    }
}
