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
        public required DbSet<BlogPost> BlogPosts { get; set; } // Table to store blog posts
        public required DbSet<Category> Categories { get; set; } // Table to store categories
        public required DbSet<BlogImage> BlogImages { get; set; } // Table to store blog images
        public required DbSet<BlogComment> BlogComments { get; set; } // Table to store blog comments
        public required DbSet<BlogCommentReaction> BlogCommentReactions { get; set; } // Table to store comment reactions
        public required DbSet<CoverPage> CoverPages { get; set; } // Table to store cover page content
        public required DbSet<AboutPage> AboutPages { get; set; } // Table to store about page content
        public required DbSet<BlogSummaryPage> BlogSummaryPages { get; set; } // Table to store blog summary page content

        // Configure comment relationships, cascade behavior, and reaction uniqueness constraints
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<BlogComment>(entity =>
            {
                // Prevent parent comment deletion from cascading to replies
                entity
                    .HasOne(comment => comment.ParentComment)
                    .WithMany(comment => comment.Replies)
                    .HasForeignKey(comment => comment.ParentCommentId)
                    .OnDelete(DeleteBehavior.NoAction);

                // Delete comments when their blog post is deleted
                entity
                    .HasOne(comment => comment.BlogPost)
                    .WithMany(blogPost => blogPost.Comments)
                    .HasForeignKey(comment => comment.BlogPostId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<BlogCommentReaction>(entity =>
            {
                // Allow each user to react only once to a comment
                entity
                    .HasIndex(reaction => new { reaction.BlogCommentId, reaction.UserId })
                    .IsUnique();

                // Delete reactions when their comment is deleted
                entity
                    .HasOne(reaction => reaction.BlogComment)
                    .WithMany(comment => comment.Reactions)
                    .HasForeignKey(reaction => reaction.BlogCommentId)
                    .OnDelete(DeleteBehavior.Cascade);
            });
        }
    }
}
