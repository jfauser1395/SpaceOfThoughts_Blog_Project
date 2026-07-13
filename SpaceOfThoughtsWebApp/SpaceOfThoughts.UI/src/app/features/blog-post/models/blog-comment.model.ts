// Interface representing a comment on a blog post
export type BlogCommentReaction = 'like' | 'dislike' | null;

export interface BlogComment {
  id: string; // Unique identifier for the comment
  blogPostId: string; // Blog post the comment belongs to
  parentCommentId?: string | null; // Parent comment when this is a reply
  depth?: number; // Nesting depth in the current thread
  content: string; // Comment content
  authorId: string; // User ID of the comment author
  authorName: string; // Display name of the comment author
  authorProfileImageUrl?: string | null; // Optional profile picture URL of the author
  authorProfileImagePosition?: string | null; // Optional profile picture position and zoom
  createdAt: Date; // Date when the comment was created
  isDeleted: boolean; // Whether the comment content was removed while preserving replies
  isAuthorDeleted: boolean; // Whether the comment author's account no longer exists
  likeCount: number; // Number of likes
  dislikeCount: number; // Number of dislikes
  userReaction?: BlogCommentReaction; // Current user's reaction
  replies: BlogComment[]; // Replies to this comment
}
