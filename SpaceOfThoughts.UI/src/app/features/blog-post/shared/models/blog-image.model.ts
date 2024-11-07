// Interface representing a blog image
export interface BlogImage {
  id: string; // Unique identifier for the image
  fileName: string; // Name of the image file
  title: string; // Title of the image
  fileExtension: string; // File extension of the image
  dateCreated: string; // Date when the image was created
  url: string; // URL where the image is stored
}
