// Interface representing a new blog comment request
export interface AddBlogComment {
  content: string; // Comment content
  parentCommentId?: string | null; // Parent comment when adding a reply
}
