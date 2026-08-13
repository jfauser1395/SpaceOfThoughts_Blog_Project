namespace SpaceOfThoughts.API.Models.Domain
{
    // Category represents a category for grouping blog posts in the application
    public class Category
    {
        // Unique identifier for the category
        public Guid Id { get; set; }

        // Name of the category
        public required string Name { get; set; }

        // URL handle (slug) for the category. Assigned by CategoryRepository from
        // the name on every save and never supplied by a caller, so it is not
        // `required`: that would only force each caller to write a dummy value.
        public string UrlHandle { get; set; } = string.Empty;

        // Collection of blog posts associated with the category (nullable as it may not be set initially)
        public ICollection<BlogPost>? BlogPosts { get; set; }
    }
}
