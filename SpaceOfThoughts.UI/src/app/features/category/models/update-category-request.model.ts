// Interface for updating an existing category
export interface UpdateCategoryRequest {
  name: string; // Name of the category
  urlHandle: string; // URL handle (slug) for the category
}
