// Interface for updating an existing blog post
export interface UpdateBlogPost {
  title: string; // Title of the blog post
  shortDescription: string; // Brief description or summary of the blog post
  content: string; // Main content of the blog post
  featuredImageUrl: string; // URL of the featured image for the blog post
  urlHandle: string; // URL handle (slug) for the blog post
  author: string; // Author of the blog post
  publishedDate: Date; // Date when the blog post is published
  isVisible: boolean; // Flag to indicate if the blog post is visible to readers
  categories: string[]; // Array of category IDs associated with the blog post
}
