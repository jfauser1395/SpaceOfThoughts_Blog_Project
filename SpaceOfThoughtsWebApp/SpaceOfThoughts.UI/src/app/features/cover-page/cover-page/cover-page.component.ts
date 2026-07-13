import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { StyleService } from '../../../../services/style.service';
import { AuthService } from '../../auth/services/auth.service';
import { User } from '../../auth/models/user.model';
import { BlogPost } from '../../blog-post/models/blog-post.model';
import { BlogPostService } from '../../blog-post/services/blog-post.service';
import { CoverPage } from '../models/cover-page.model';
import { CoverPageService } from '../services/cover-page.service';
import { LoadingOverlayComponent } from '../../../core/loading-overlay/loading-overlay.component';

@Component({
  selector: 'app-cover-page',
  imports: [CommonModule, RouterModule, LoadingOverlayComponent],
  templateUrl: './cover-page.component.html',
  styleUrl: './cover-page.component.css',
})
export class CoverPageComponent implements OnInit, OnDestroy {
  // Cover page content loaded from the API
  coverPage?: CoverPage;
  isLoading = true; // Flag for the required cover page API content
  isCoverImageLoading = true; // Flag for the hero image that must be ready before reveal
  user?: User;
  blogPreviewPosts: BlogPost[] = [];
  activeBlogPreviewIndex = 0;
  private readonly visibleBlogPreviewCount = 3;
  private readonly defaultBackgroundImageUrl = 'assets/cover-default.png';
  backgroundImageUrl = this.defaultBackgroundImageUrl;
  private backgroundImageLoadId = 0;
  private coverPageRetryTimeoutId?: number;
  private blogPreviewRetryTimeoutId?: number;
  private blogPreviewIntervalId?: number;
  private coverPageSubscription?: Subscription;
  private blogPreviewSubscription?: Subscription;
  private userSubscription?: Subscription;

  constructor(
    private coverPageService: CoverPageService,
    private blogPostService: BlogPostService,
    private styleService: StyleService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    // Set full-screen body styles for the immersive cover page
    this.styleService.setBodyStyle('box-sizing', 'border-box');
    this.styleService.setBodyStyle('height', '100svh');
    this.styleService.setBodyStyle('overflow', 'hidden');
    this.styleService.setBodyStyle('padding-top', '0');

    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    this.preloadBackgroundImage(this.defaultBackgroundImageUrl);

    // Get the current user so the cover page can show a personal greeting
    this.user = this.authService.getUser();
    this.userSubscription = this.authService.user().subscribe({
      next: (user) => {
        this.user = user ?? this.authService.getUser();
      },
    });

    this.loadCoverPage();
    this.loadBlogPreviews();
  }

  // Keep the shared loader visible until both required cover resources are ready
  get isPageLoading(): boolean {
    return this.isLoading || this.isCoverImageLoading;
  }

  // Current position text for the blog preview carousel
  get activeBlogPreviewPosition(): number {
    return this.blogPreviewPosts.length === 0
      ? 0
      : this.activeBlogPreviewIndex + 1;
  }

  // Get the visible window of blog preview cards from the shuffled list
  get visibleBlogPreviews(): BlogPost[] {
    if (this.blogPreviewPosts.length <= this.visibleBlogPreviewCount) {
      return this.blogPreviewPosts;
    }

    return Array.from({ length: this.visibleBlogPreviewCount }, (_, offset) => {
      const previewIndex =
        (this.activeBlogPreviewIndex + offset) % this.blogPreviewPosts.length;
      return this.blogPreviewPosts[previewIndex];
    });
  }

  ngOnDestroy(): void {
    // Remove body styles that only belong to the cover page
    this.styleService.removeBodyStyle('box-sizing');
    this.styleService.removeBodyStyle('height');
    this.styleService.removeBodyStyle('overflow');
    this.styleService.removeBodyStyle('padding-top');

    // Unsubscribe and clear timers to prevent memory leaks
    this.coverPageSubscription?.unsubscribe();
    this.blogPreviewSubscription?.unsubscribe();
    this.userSubscription?.unsubscribe();
    this.clearCoverPageRetry();
    this.clearBlogPreviewRetry();
    this.clearBlogPreviewCarousel();
  }

  // Load cover page content and retry if the API is temporarily unavailable
  private loadCoverPage(): void {
    this.isLoading = true;
    this.clearCoverPageRetry();
    this.coverPageSubscription?.unsubscribe();
    this.coverPageSubscription = this.coverPageService
      .getCoverPage()
      .subscribe({
        next: (coverPage) => {
          this.coverPage = coverPage;
          this.preloadBackgroundImage(
            this.getCoverBackgroundImageUrl(coverPage),
          );
          this.isLoading = false;
        },
        error: () => {
          // Keep retrying so the cover page can recover when the API comes back
          this.coverPageRetryTimeoutId = window.setTimeout(() => {
            this.loadCoverPage();
          }, 2500);
        },
      });
  }

  // Load visible blog posts for the rotating cover page preview
  private loadBlogPreviews(): void {
    this.clearBlogPreviewRetry();
    this.blogPreviewSubscription?.unsubscribe();
    this.blogPreviewSubscription = this.blogPostService
      .getAllBlogPosts(undefined, 'publishedDate', 'desc')
      .subscribe({
        next: (blogs) => {
          this.blogPreviewPosts = this.shuffleBlogs(
            blogs.filter((blog) => blog.isVisible),
          );
          this.activeBlogPreviewIndex = 0;
          this.startBlogPreviewCarousel();
        },
        error: () => {
          // Retry blog previews independently from the main cover page content
          this.blogPreviewRetryTimeoutId = window.setTimeout(() => {
            this.loadBlogPreviews();
          }, 5000);
        },
      });
  }

  // Use the saved background image when available, otherwise fall back to the bundled cover
  private getCoverBackgroundImageUrl(coverPage?: CoverPage): string {
    return coverPage?.backgroundImageUrl || this.defaultBackgroundImageUrl;
  }

  // Clear the pending cover page retry timer
  private clearCoverPageRetry(): void {
    if (this.coverPageRetryTimeoutId) {
      window.clearTimeout(this.coverPageRetryTimeoutId);
      this.coverPageRetryTimeoutId = undefined;
    }
  }

  // Start rotating the visible blog preview cards
  private startBlogPreviewCarousel(): void {
    this.clearBlogPreviewCarousel();

    if (this.blogPreviewPosts.length < 2) {
      return;
    }

    this.blogPreviewIntervalId = window.setInterval(() => {
      this.showRandomBlogPreview();
    }, 5200);
  }

  // Pick a new blog preview without repeating the currently active card
  private showRandomBlogPreview(): void {
    if (this.blogPreviewPosts.length < 2) {
      return;
    }

    const nextIndex = Math.floor(
      Math.random() * (this.blogPreviewPosts.length - 1),
    );
    this.activeBlogPreviewIndex =
      nextIndex >= this.activeBlogPreviewIndex ? nextIndex + 1 : nextIndex;
  }

  // Clear the blog preview carousel timer
  private clearBlogPreviewCarousel(): void {
    if (this.blogPreviewIntervalId) {
      window.clearInterval(this.blogPreviewIntervalId);
      this.blogPreviewIntervalId = undefined;
    }
  }

  // Clear the pending blog preview retry timer
  private clearBlogPreviewRetry(): void {
    if (this.blogPreviewRetryTimeoutId) {
      window.clearTimeout(this.blogPreviewRetryTimeoutId);
      this.blogPreviewRetryTimeoutId = undefined;
    }
  }

  // Shuffle blogs so the cover page preview feels fresh each visit
  private shuffleBlogs(blogs: BlogPost[]): BlogPost[] {
    const shuffledBlogs = [...blogs];

    for (let index = shuffledBlogs.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [shuffledBlogs[index], shuffledBlogs[randomIndex]] = [
        shuffledBlogs[randomIndex],
        shuffledBlogs[index],
      ];
    }

    return shuffledBlogs;
  }

  // Preload the background image before revealing it in the cover hero
  private preloadBackgroundImage(imageUrl: string): void {
    const loadId = ++this.backgroundImageLoadId;
    this.isCoverImageLoading = true;

    const image = new Image();
    image.onload = () => {
      // Ignore older image loads that finish after a newer image request
      if (loadId === this.backgroundImageLoadId) {
        this.backgroundImageUrl = imageUrl;
        this.isCoverImageLoading = false;
      }
    };
    image.onerror = () => {
      if (loadId === this.backgroundImageLoadId) {
        // Fall back to the bundled background if a saved custom image fails
        if (imageUrl !== this.defaultBackgroundImageUrl) {
          this.preloadBackgroundImage(this.defaultBackgroundImageUrl);
          return;
        }

        this.backgroundImageUrl = this.defaultBackgroundImageUrl;
        this.isCoverImageLoading = false;
      }
    };
    image.src = imageUrl;
  }
}
