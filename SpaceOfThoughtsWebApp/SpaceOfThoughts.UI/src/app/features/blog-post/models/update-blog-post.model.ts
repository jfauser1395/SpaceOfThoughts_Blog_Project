// Interface for updating an existing blog post
export interface UpdateBlogPost {
  title: string; // Title of the blog post
  shortDescription: string; // Brief description or summary of the blog post
  content: string; // Main content of the blog post
  featuredImageUrl: string; // URL of the featured image for the blog post
  featuredImageCardPosition?: string | null; // Saved "x% y% zoom%" framing for the picture cropped into a blog card
  featuredImageBannerPosition?: string | null; // Saved "x% y% zoom%" framing for the picture cropped into the article banner
  backgroundImageUrl?: string | null; // Optional background picture shown behind the article
  backgroundImagePosition?: string | null; // Saved "x% y% zoom%" framing for the background picture
  author: string; // Author of the blog post
  publishedDate: Date; // Date when the blog post is published
  isVisible: boolean; // Flag to indicate if the blog post is visible to readers
  categories: string[]; // Array of category IDs associated with the blog post
}
