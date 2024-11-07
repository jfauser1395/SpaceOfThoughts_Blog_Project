import { Category } from '../../category/models/category.model';

// Interface representing a blog post
export interface BlogPost {
  id: string; // Unique identifier for the blog post
  title: string; // Title of the blog post
  shortDescription: string; // Brief description or summary of the blog post
  content: string; // Main content of the blog post
  featuredImageUrl: string; // URL of the featured image for the blog post
  urlHandle: string; // URL handle (slug) for the blog post
  author: string; // Author of the blog post
  publishedDate: Date; // Date when the blog post is published
  isVisible: boolean; // Flag to indicate if the blog post is visible to readers
  categories: Category[]; // Array of categories associated with the blog post
}
