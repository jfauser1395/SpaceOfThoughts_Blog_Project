using Microsoft.EntityFrameworkCore;
using SpaceOfThoughts.API.Models.Domain;

namespace SpaceOfThoughts.API.Data
{
    // ApplicationDbContext is the main class that coordinates Entity Framework functionality for the data model
    public class ApplicationDbContext : DbContext
    {
        // Constructor to pass options to the base DbContext class
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options) { }

        // DbSet properties represent collections of the specified entity types in the database
        public DbSet<BlogPost> BlogPosts { get; set; } // Table to store blog posts
        public DbSet<Category> Categories { get; set; } // Table to store categories
        public DbSet<BlogImage> BlogImages { get; set; } // Table to store blog images
    }
}
