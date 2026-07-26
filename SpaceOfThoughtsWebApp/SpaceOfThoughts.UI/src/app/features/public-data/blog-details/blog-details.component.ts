import {
  Component,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { BlogPostService } from '../../blog-post/services/blog-post.service';
import { Subscription } from 'rxjs';
import { BlogPost } from '../../blog-post/models/blog-post.model';
import { CommonModule } from '@angular/common';
import { DatePipe } from '@angular/common';
import { MarkdownComponent } from 'ngx-markdown';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  BlogComment,
  BlogCommentReaction,
} from '../../blog-post/models/blog-comment.model';
import { AuthService } from '../../auth/services/auth.service';
import { User } from '../../auth/models/user.model';
import { LoadingOverlayComponent } from '../../../core/loading-overlay/loading-overlay.component';

@Component({
  selector: 'app-blog-details',
  imports: [
    CommonModule,
    DatePipe,
    MarkdownComponent,
    RouterModule,
    ReactiveFormsModule,
    LoadingOverlayComponent,
  ],
  templateUrl: './blog-details.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './blog-details.component.css',
})
export class BlogDetailsComponent implements OnInit, OnDestroy {
  readonly maxThreadDepth = 10;
  private readonly defaultAvatarPosition = '50% 50% 100%';
  private readonly defaultAvatarZoom = 100;
  private readonly minimumAvatarZoom = 85;
  private readonly maximumAvatarZoom = 170;
  url: string | null = null; // URL handle of the blog post
  blogPost?: BlogPost; // Loaded blog post
  comments: BlogComment[] = []; // Comments for the blog post
  currentUser?: User; // Currently logged-in user
  isUp = false; // Flag to indicate if the view is scrolled up
  isBlogPostLoading = true; // Flag to indicate if the blog post is loading
  isCommentsLoading = false; // Flag to indicate if comments are loading
  isSubmittingComment = false; // Flag to indicate if a comment is being submitted
  isSubmittingReply = false; // Flag to indicate if a reply is being submitted
  activeReplyCommentId?: string; // Comment currently being replied to
  expandedThreadCommentIds = new Set<string>(); // Comments with expanded reply threads
  reactingCommentIds = new Set<string>(); // Comments with a pending reaction request
  deletingCommentIds = new Set<string>(); // Comments with a pending delete request
  commentError?: string; // Error message for comment actions
  commentSuccess?: string; // Success message for comment actions
  commentControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(2000)],
  });
  commentForm = new FormGroup({
    comment: this.commentControl,
  });
  replyControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(2000)],
  });
  replyForm = new FormGroup({
    reply: this.replyControl,
  });

  private routeSubscription?: Subscription; // Subscription for route changes
  private blogPostSubscription?: Subscription; // Subscription for blog post loading
  private commentsSubscription?: Subscription; // Subscription for comments loading
  private createCommentSubscription?: Subscription; // Subscription for comment creation
  private createReplySubscription?: Subscription; // Subscription for reply creation
  private reactionSubscriptions: Subscription[] = []; // Subscriptions for comment reactions
  private deleteCommentSubscriptions: Subscription[] = []; // Subscriptions for comment deletion

  constructor(
    private route: ActivatedRoute, // Inject ActivatedRoute to access route parameters
    private router: Router, // Inject Router for login navigation
    private blogPostService: BlogPostService, // Inject BlogPostService for blog post operations
    private authService: AuthService, // Inject AuthService for current user data
  ) {}

  ngOnInit(): void {
    // Scroll to the top of the page smoothly on component initialization
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'smooth',
    });

    this.currentUser = this.authService.getUser();

    // Subscribe to route parameters to get the URL handle of the blog post
    this.routeSubscription = this.route.paramMap.subscribe({
      next: (params) => {
        this.url = params.get('url');

        if (this.url) {
          this.loadBlogPost(this.url);
        }
      },
    });
  }

  // Submit a new comment for the blog post
  onSubmitComment(): void {
    this.commentError = undefined;
    this.commentSuccess = undefined;

    if (!this.currentUser) {
      this.router.navigate(['/login']);
      return;
    }

    if (!this.blogPost) {
      return;
    }

    const content = this.commentControl.value.trim();
    if (!content) {
      this.commentControl.setValue('');
      this.commentControl.setErrors({ required: true });
      this.commentControl.markAsTouched();
      return;
    }

    if (this.commentControl.invalid) {
      this.commentControl.markAsTouched();
      return;
    }

    this.isSubmittingComment = true;
    this.createCommentSubscription?.unsubscribe();
    this.createCommentSubscription = this.blogPostService
      .createBlogComment(this.blogPost.id, { content })
      .subscribe({
        next: (comment) => {
          this.comments = this.sortCommentsByPriority([
            ...this.comments,
            this.normalizeComment(comment, 1),
          ]);
          this.commentControl.reset('');
          this.commentSuccess = 'Your comment was posted.';
          this.isSubmittingComment = false;
          this.loadComments(this.blogPost!.id);
        },
        error: () => {
          this.commentError = 'Unable to post your comment right now.';
          this.isSubmittingComment = false;
        },
      });
  }

  // Report remaining characters for the top-level comment form
  get remainingCommentCharacters(): number {
    return 2000 - this.commentControl.value.length;
  }

  // Report remaining characters for the active reply form
  get remainingReplyCharacters(): number {
    return 2000 - this.replyControl.value.length;
  }

  // Count top-level comments and every nested reply shown for the article
  get totalCommentCount(): number {
    return this.countComments(this.comments);
  }

  // Count every reply nested below the selected comment
  getReplyCount(comment: BlogComment): number {
    return this.countComments(comment.replies ?? []);
  }

  // Flatten and prioritize all descendants for the expanded thread view
  getThreadReplies(comment: BlogComment): BlogComment[] {
    const replies: BlogComment[] = [];
    this.collectThreadReplies(comment.replies ?? [], replies);
    return this.sortCommentsByPriority(replies);
  }

  onToggleReaction(
    comment: BlogComment,
    reaction: Exclude<BlogCommentReaction, null>,
  ): void {
    this.commentError = undefined;
    this.commentSuccess = undefined;

    if (!this.currentUser) {
      this.router.navigate(['/login']);
      return;
    }

    if (!this.blogPost || this.reactingCommentIds.has(comment.id)) {
      return;
    }

    this.reactingCommentIds.add(comment.id);
    const subscription = this.blogPostService
      .toggleBlogCommentReaction(this.blogPost.id, comment.id, reaction)
      .subscribe({
        next: (updatedComment) => {
          this.comments = this.sortCommentsByPriority(
            this.updateCommentInTree(
              this.comments,
              this.normalizeComment(updatedComment, comment.depth ?? 1),
            ),
          );
          this.reactingCommentIds.delete(comment.id);
        },
        error: () => {
          this.commentError = 'Unable to update your reaction right now.';
          this.reactingCommentIds.delete(comment.id);
        },
      });

    this.reactionSubscriptions.push(subscription);
  }

  // Open one reply form at a time and reset stale reply feedback
  onToggleReplyForm(commentId: string): void {
    this.commentError = undefined;
    this.commentSuccess = undefined;

    if (!this.currentUser) {
      this.router.navigate(['/login']);
      return;
    }

    if (this.activeReplyCommentId === commentId) {
      this.onCancelReply();
      return;
    }

    const parentComment = this.findCommentById(this.comments, commentId);
    if (!parentComment || !this.canReplyToComment(parentComment)) {
      this.commentError = `Replies can go up to ${this.maxThreadDepth} comments in a thread.`;
      return;
    }

    this.activeReplyCommentId = commentId;
    this.replyControl.reset('');
  }

  // Close the active reply form and discard its unsent content
  onCancelReply(): void {
    this.activeReplyCommentId = undefined;
    this.replyControl.reset('');
    this.replyControl.setErrors(null);
  }

  // Submit a nested reply while enforcing authentication and depth limits
  onSubmitReply(parentComment: BlogComment): void {
    this.commentError = undefined;
    this.commentSuccess = undefined;

    if (!this.currentUser) {
      this.router.navigate(['/login']);
      return;
    }

    if (!this.blogPost) {
      return;
    }

    if (!this.canReplyToComment(parentComment)) {
      this.commentError = `Replies can go up to ${this.maxThreadDepth} comments in a thread.`;
      return;
    }

    const content = this.replyControl.value.trim();
    if (!content) {
      this.replyControl.setValue('');
      this.replyControl.setErrors({ required: true });
      this.replyControl.markAsTouched();
      return;
    }

    if (this.replyControl.invalid) {
      this.replyControl.markAsTouched();
      return;
    }

    this.isSubmittingReply = true;
    this.createReplySubscription?.unsubscribe();
    this.createReplySubscription = this.blogPostService
      .createBlogComment(this.blogPost.id, {
        content,
        parentCommentId: parentComment.id,
      })
      .subscribe({
        next: (reply) => {
          const nextDepth = (parentComment.depth ?? 1) + 1;
          this.comments = this.sortCommentsByPriority(
            this.appendReplyToComment(
              this.comments,
              parentComment.id,
              this.normalizeComment(reply, nextDepth),
            ),
          );
          const topLevelCommentId =
            this.findTopLevelCommentId(this.comments, parentComment.id) ??
            parentComment.id;
          this.expandedThreadCommentIds.add(topLevelCommentId);
          this.commentSuccess = 'Your reply was posted.';
          this.isSubmittingReply = false;
          this.onCancelReply();
          this.loadComments(this.blogPost!.id);
        },
        error: () => {
          this.commentError = 'Unable to post your reply right now.';
          this.isSubmittingReply = false;
        },
      });
  }

  // Disable reaction controls while that comment's request is in flight
  isReacting(commentId: string): boolean {
    return this.reactingCommentIds.has(commentId);
  }

  // Soft-delete the selected comment without removing its replies
  onDeleteComment(comment: BlogComment): void {
    this.commentError = undefined;
    this.commentSuccess = undefined;

    if (
      !this.currentUser ||
      !this.blogPost ||
      !this.canDeleteComment(comment)
    ) {
      return;
    }

    if (
      !window.confirm('Delete this comment? Its replies will remain visible.')
    ) {
      return;
    }

    this.deletingCommentIds.add(comment.id);
    const subscription = this.blogPostService
      .deleteBlogComment(this.blogPost.id, comment.id)
      .subscribe({
        next: (deletedComment) => {
          this.comments = this.sortCommentsByPriority(
            this.updateCommentInTree(
              this.comments,
              this.normalizeComment(deletedComment, comment.depth ?? 1),
            ),
          );
          this.deletingCommentIds.delete(comment.id);
          this.commentSuccess =
            'Your comment was deleted. Replies remain visible.';
        },
        error: () => {
          this.deletingCommentIds.delete(comment.id);
          this.commentError = 'Unable to delete this comment right now.';
        },
      });

    this.deleteCommentSubscriptions.push(subscription);
  }

  // Disable delete controls while that comment's request is in flight
  isDeletingComment(commentId: string): boolean {
    return this.deletingCommentIds.has(commentId);
  }

  // Expand or collapse the flattened reply thread for a top-level comment
  onToggleThread(commentId: string): void {
    if (this.expandedThreadCommentIds.has(commentId)) {
      this.expandedThreadCommentIds.delete(commentId);
      return;
    }

    this.expandedThreadCommentIds.add(commentId);
  }

  // Check whether the selected top-level thread is currently expanded
  isThreadExpanded(commentId: string): boolean {
    return this.expandedThreadCommentIds.has(commentId);
  }

  // Prevent replies that would exceed the supported nesting depth
  canReplyToComment(comment: BlogComment): boolean {
    return (comment.depth ?? 1) < this.maxThreadDepth;
  }

  // Allow deletion by the author or a writer while protecting deleted entries
  canDeleteComment(comment: BlogComment): boolean {
    return (
      !comment.isDeleted &&
      !!this.currentUser &&
      (comment.authorId === this.currentUser.id ||
        this.currentUser.roles.includes('Writer'))
    );
  }

  // Resolve the parent author's name for nested reply context
  getReplyTargetName(comment: BlogComment): string | undefined {
    if (!comment.parentCommentId) {
      return undefined;
    }

    return this.findCommentById(this.comments, comment.parentCommentId)
      ?.authorName;
  }

  // Return a stable fallback initial when a commenter has no profile image
  getAvatarInitial(name?: string | null): string {
    const trimmedName = name?.trim();
    return trimmedName ? trimmedName.charAt(0).toUpperCase() : '?';
  }

  // Convert stored avatar framing into a CSS object-position
  getAvatarImagePosition(position?: string | null): string {
    const avatarPosition = this.parseAvatarPosition(position);
    return `${avatarPosition.x}% ${avatarPosition.y}%`;
  }

  // Expose normalized avatar zoom for template sizing
  getAvatarImageZoom(position?: string | null): number {
    return this.parseAvatarPosition(position).zoom;
  }

  // Translate a zoomed avatar so its selected focal point remains centered
  getAvatarImageTransform(position?: string | null): string {
    const avatarPosition = this.parseAvatarPosition(position);
    const maxOffset = Math.max(
      0,
      ((avatarPosition.zoom - 100) / (2 * avatarPosition.zoom)) * 100,
    );
    const offsetX = (((50 - avatarPosition.x) / 50) * maxOffset).toFixed(2);
    const offsetY = (((50 - avatarPosition.y) / 50) * maxOffset).toFixed(2);

    return `translate(${offsetX}%, ${offsetY}%)`;
  }

  // Load the route's article and drive the shared overlay from the request state
  private loadBlogPost(url: string): void {
    this.isBlogPostLoading = true;
    this.commentError = undefined;
    this.commentSuccess = undefined;
    this.blogPostSubscription?.unsubscribe();

    this.blogPostSubscription = this.blogPostService
      .getBlogPostByUrlHandle(url)
      .subscribe({
        next: (blogPost) => {
          this.blogPost = blogPost;
          this.isBlogPostLoading = false;

          if (blogPost.isVisible) {
            this.loadComments(blogPost.id);
          } else {
            this.comments = [];
          }
        },
        error: () => {
          // Replace the blocking loader with a readable page-level error
          this.isBlogPostLoading = false;
          this.commentError = 'Unable to load this blog post.';
        },
      });
  }

  // Load comments inline after the article itself is already available to read
  private loadComments(blogPostId: string): void {
    this.isCommentsLoading = true;
    this.commentsSubscription?.unsubscribe();

    this.commentsSubscription = this.blogPostService
      .getCommentsForBlogPost(blogPostId)
      .subscribe({
        next: (comments) => {
          this.comments = this.sortCommentsByPriority(
            comments.map((comment) => this.normalizeComment(comment, 1)),
          );
          this.isCommentsLoading = false;
          this.trimExpandedThreadIds(this.comments);
        },
        error: () => {
          this.commentError = 'Unable to load comments right now.';
          this.isCommentsLoading = false;
        },
      });
  }

  // Unsubscribe from subscriptions to prevent memory leaks
  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
    this.blogPostSubscription?.unsubscribe();
    this.commentsSubscription?.unsubscribe();
    this.createCommentSubscription?.unsubscribe();
    this.createReplySubscription?.unsubscribe();
    this.reactionSubscriptions.forEach((subscription) =>
      subscription.unsubscribe(),
    );
    this.deleteCommentSubscriptions.forEach((subscription) =>
      subscription.unsubscribe(),
    );
  }

  // Recursively count comments without mutating the nested discussion tree
  private countComments(comments: BlogComment[]): number {
    return comments.reduce(
      (count, comment) => count + 1 + this.countComments(comment.replies ?? []),
      0,
    );
  }

  // Rank comments by engagement and use newest-first order as the tie breaker
  private sortCommentsByPriority(comments: BlogComment[]): BlogComment[] {
    return [...comments].sort((leftComment, rightComment) => {
      const engagementDifference =
        this.getCommentEngagementScore(rightComment) -
        this.getCommentEngagementScore(leftComment);
      if (engagementDifference !== 0) {
        return engagementDifference;
      }

      return (
        this.getCommentCreatedAt(rightComment) -
        this.getCommentCreatedAt(leftComment)
      );
    });
  }

  // Treat reactions and nested replies as engagement when ranking comments
  private getCommentEngagementScore(comment: BlogComment): number {
    return (
      (comment.likeCount ?? 0) +
      (comment.dislikeCount ?? 0) +
      this.countComments(comment.replies ?? [])
    );
  }

  // Convert comment timestamps into safe numeric values for sorting
  private getCommentCreatedAt(comment: BlogComment): number {
    const createdAt = new Date(comment.createdAt).getTime();
    return Number.isNaN(createdAt) ? 0 : createdAt;
  }

  // Fill optional API fields and assign depth throughout the recursive reply tree
  private normalizeComment(comment: BlogComment, depth: number): BlogComment {
    return {
      ...comment,
      depth,
      likeCount: comment.likeCount ?? 0,
      dislikeCount: comment.dislikeCount ?? 0,
      userReaction: comment.userReaction ?? null,
      isDeleted: comment.isDeleted ?? false,
      isAuthorDeleted: comment.isAuthorDeleted ?? false,
      authorProfileImageUrl: comment.authorProfileImageUrl ?? null,
      authorProfileImagePosition:
        comment.authorProfileImagePosition ?? this.defaultAvatarPosition,
      replies: (comment.replies ?? []).map((reply) =>
        this.normalizeComment(reply, depth + 1),
      ),
    };
  }

  // Replace one comment while preserving its current depth and loaded replies
  private updateCommentInTree(
    comments: BlogComment[],
    updatedComment: BlogComment,
  ): BlogComment[] {
    return comments.map((comment) => {
      if (comment.id === updatedComment.id) {
        return {
          ...updatedComment,
          depth: comment.depth ?? updatedComment.depth ?? 1,
          replies: comment.replies ?? [],
        };
      }

      return {
        ...comment,
        replies: this.updateCommentInTree(
          comment.replies ?? [],
          updatedComment,
        ),
      };
    });
  }

  // Append a reply to its parent without mutating the existing discussion tree
  private appendReplyToComment(
    comments: BlogComment[],
    parentCommentId: string,
    reply: BlogComment,
  ): BlogComment[] {
    return comments.map((comment) => {
      if (comment.id === parentCommentId) {
        return {
          ...comment,
          replies: [...(comment.replies ?? []), reply],
        };
      }

      return {
        ...comment,
        replies: this.appendReplyToComment(
          comment.replies ?? [],
          parentCommentId,
          reply,
        ),
      };
    });
  }

  // Remove expansion state for top-level comments that are no longer present
  private trimExpandedThreadIds(comments: BlogComment[]): void {
    const validIds = new Set<string>(comments.map((comment) => comment.id));

    this.expandedThreadCommentIds.forEach((commentId) => {
      if (!validIds.has(commentId)) {
        this.expandedThreadCommentIds.delete(commentId);
      }
    });
  }

  // Resolve the top-level owner of any nested comment for thread expansion
  private findTopLevelCommentId(
    comments: BlogComment[],
    commentId: string,
    topLevelCommentId?: string,
  ): string | undefined {
    for (const comment of comments) {
      const currentTopLevelId = topLevelCommentId ?? comment.id;
      if (comment.id === commentId) {
        return currentTopLevelId;
      }

      const nestedMatch = this.findTopLevelCommentId(
        comment.replies ?? [],
        commentId,
        currentTopLevelId,
      );
      if (nestedMatch) {
        return nestedMatch;
      }
    }

    return undefined;
  }

  // Flatten nested replies into the provided thread result in traversal order
  private collectThreadReplies(
    comments: BlogComment[],
    result: BlogComment[],
  ): void {
    comments.forEach((comment) => {
      result.push(comment);
      this.collectThreadReplies(comment.replies ?? [], result);
    });
  }

  // Recursively locate a comment anywhere in the discussion tree
  private findCommentById(
    comments: BlogComment[],
    commentId: string,
  ): BlogComment | undefined {
    for (const comment of comments) {
      if (comment.id === commentId) {
        return comment;
      }

      const match = this.findCommentById(comment.replies ?? [], commentId);
      if (match) {
        return match;
      }
    }

    return undefined;
  }

  // Parse persisted avatar framing and apply safe defaults for malformed values
  private parseAvatarPosition(position?: string | null): {
    x: number;
    y: number;
    zoom: number;
  } {
    const [xText, yText, zoomText] = (
      position ?? this.defaultAvatarPosition
    ).split(' ');
    const x = this.parsePercent(xText);
    const y = this.parsePercent(yText);
    const zoom = this.parseZoom(zoomText);

    return { x, y, zoom };
  }

  // Clamp avatar focal-point coordinates to the visible percentage range
  private parsePercent(value?: string): number {
    const parsed = Number((value ?? '').replace('%', ''));

    if (Number.isNaN(parsed)) {
      return 50;
    }

    return Math.min(100, Math.max(0, parsed));
  }

  // Clamp avatar zoom to the range supported by profile image controls
  private parseZoom(value?: string): number {
    const parsed = Number((value ?? '').replace('%', ''));

    if (Number.isNaN(parsed)) {
      return this.defaultAvatarZoom;
    }

    return Math.min(
      this.maximumAvatarZoom,
      Math.max(this.minimumAvatarZoom, Math.round(parsed)),
    );
  }
}
