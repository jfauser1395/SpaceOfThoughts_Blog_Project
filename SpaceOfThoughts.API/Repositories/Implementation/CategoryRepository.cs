using Microsoft.EntityFrameworkCore;
using SpaceOfThoughts.API.Data;
using SpaceOfThoughts.API.Models.Domain;
using SpaceOfThoughts.API.Repositories.Interface;

namespace SpaceOfThoughts.API.Repositories.Implementation
{
    // CategoryRepository handles CRUD operations for Category entities
    public class CategoryRepository : ICategoryRepository
    {
        private readonly ApplicationDbContext dbContext;

        // Constructor to initialize ApplicationDbContext
        public CategoryRepository(ApplicationDbContext dbContext)
        {
            this.dbContext = dbContext;
        }

        // Create a new category
        public async Task<Category> CreateAsync(Category category)
        {
            await dbContext.Categories.AddAsync(category); // Add new category to the context
            await dbContext.SaveChangesAsync(); // Save changes to the database
            return category; // Return the created category
        }

        // Delete a category by ID
        public async Task<Category?> DeleteAsync(Guid id)
        {
            var existingCategory = await dbContext.Categories.FirstOrDefaultAsync(c => c.Id == id);
            if (existingCategory is null)
            {
                return null; // Return null if the category was not found
            }
            dbContext.Categories.Remove(existingCategory); // Remove the category from the context
            await dbContext.SaveChangesAsync(); // Save changes to the database
            return existingCategory; // Return the deleted category
        }

        // Get all categories with optional filtering, sorting, and pagination
        public async Task<IEnumerable<Category>> GetAllAsync(
            string? query = null,
            string? sortBy = null,
            string? sortDirection = null,
            int? pageNumber = 1,
            int? pageSize = 100
        )
        {
            var categories = dbContext.Categories.AsQueryable();

            // Apply filtering
            if (!string.IsNullOrWhiteSpace(query))
            {
                categories = categories.Where(x => x.Name.Contains(query));
            }

            // Apply sorting
            if (!string.IsNullOrWhiteSpace(sortBy))
            {
                if (string.Equals(sortBy, "Name", StringComparison.OrdinalIgnoreCase))
                {
                    var isAsc = string.Equals(
                        sortDirection,
                        "asc",
                        StringComparison.OrdinalIgnoreCase
                    );
                    categories = isAsc
                        ? categories.OrderBy(x => x.Name)
                        : categories.OrderByDescending(x => x.Name);
                }
            }
            else
            {
                // Default OrderBy if none provided
                categories = categories.OrderBy(c => c.Id);
            }

            // Apply pagination
            var skipResult = (pageNumber - 1) * pageSize;
            categories = categories.Skip(skipResult ?? 0).Take(pageSize ?? 100);

            // Return the list of categories
            return await categories.ToListAsync();
        }

        // Get a category by ID
        public async Task<Category?> GetById(Guid id)
        {
            return await dbContext.Categories.FirstOrDefaultAsync(c => c.Id == id); // Find the category by ID
        }

        // Get the total count of categories
        public async Task<int> GetCount()
        {
            return await dbContext.Categories.CountAsync(); // Count the number of categories
        }

        // Update an existing category
        public async Task<Category?> UpdateAsync(Category category)
        {
            var existingCategory = await dbContext.Categories.FirstOrDefaultAsync(c =>
                c.Id == category.Id
            );
            if (existingCategory != null)
            {
                dbContext.Entry(existingCategory).CurrentValues.SetValues(category); // Update category properties
                await dbContext.SaveChangesAsync(); // Save changes to the database
                return category; // Return the updated category
            }
            return null; // Return null if the category was not found
        }
    }
}
