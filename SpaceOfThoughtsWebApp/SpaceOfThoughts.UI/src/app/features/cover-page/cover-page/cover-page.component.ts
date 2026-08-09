import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { StyleService } from '../../../../services/style.service';
import { AuthService } from '../../auth/services/auth.service';
import { User } from '../../auth/models/user.model';
import { BlogPost } from '../../blog-post/models/blog-post.model';
import { BlogPostService } from '../../blog-post/services/blog-post.service';
import { CoverPage } from '../models/cover-page.model';
import { CoverPageService } from '../services/cover-page.service';
import { LoadingOverlayComponent } from '../../../core/loading-overlay/loading-overlay.component';
import { ThemeService } from '../../../core/theme/theme.service';
import { CoverHeroComponent } from '../cover-hero/cover-hero.component';

@Component({
  selector: 'app-cover-page',
  imports: [LoadingOverlayComponent, CoverHeroComponent],
  templateUrl: './cover-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './cover-page.component.css',
})
export class CoverPageComponent implements OnInit, OnDestroy {
  private readonly coverPageService = inject(CoverPageService);
  private readonly blogPostService = inject(BlogPostService);
  private readonly styleService = inject(StyleService);
  private readonly authService = inject(AuthService);
  readonly themeService = inject(ThemeService);

  // Signals keep API, image, authentication, and carousel updates visible to OnPush
  readonly coverPage = signal<CoverPage | undefined>(undefined);
  readonly isLoading = signal(true); // Flag for the required cover page API content
  readonly isNotPublished = signal(false); // Flag for a missing persisted Cover page
  readonly isCoverImageLoading = signal(false); // Flag for an optional hero image that must be ready before reveal
  readonly user = signal<User | undefined>(undefined);
  readonly blogPreviewPosts = signal<BlogPost[]>([]);
  readonly activeBlogPreviewIndex = signal(0);
  private readonly visibleBlogPreviewCount = 3;
  readonly backgroundImageUrl = signal<string | undefined>(undefined);

  // Derived signals recalculate only when their source state changes
  readonly isPageLoading = computed(
    () => this.isLoading() || this.isCoverImageLoading(),
  );

  readonly activeBlogPreviewPosition = computed(() => {
    const blogPreviewPosts = this.blogPreviewPosts();
    return blogPreviewPosts.length === 0
      ? 0
      : this.activeBlogPreviewIndex() + 1;
  });
  readonly visibleBlogPreviews = computed(() => {
    const blogPreviewPosts = this.blogPreviewPosts();

    if (blogPreviewPosts.length <= this.visibleBlogPreviewCount) {
      return blogPreviewPosts;
    }

    return Array.from({ length: this.visibleBlogPreviewCount }, (_, offset) => {
      const previewIndex =
        (this.activeBlogPreviewIndex() + offset) % blogPreviewPosts.length;
      return blogPreviewPosts[previewIndex];
    });
  });

  private backgroundImageLoadId = 0;
  private coverPageRetryTimeoutId?: number;
  private blogPreviewRetryTimeoutId?: number;
  private blogPreviewIntervalId?: number;
  private coverPageSubscription?: Subscription;
  private blogPreviewSubscription?: Subscription;
  private userSubscription?: Subscription;

  ngOnInit(): void {
    // Set full-screen body styles for the immersive cover page
    this.styleService.setBodyStyle('box-sizing', 'border-box');
    this.styleService.setBodyStyle('height', '100svh');
    this.styleService.setBodyStyle('overflow', 'hidden');
    this.styleService.setBodyStyle('padding-top', '0');

    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    // Get the current user so the cover page can show a personal greeting
    this.user.set(this.authService.getUser());
    this.userSubscription = this.authService.user().subscribe({
      next: (user) => {
        this.user.set(user ?? this.authService.getUser());
      },
    });

    this.loadCoverPage();
    this.loadBlogPreviews();
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
    this.isLoading.set(true);
    this.isNotPublished.set(false);
    this.clearCoverPageRetry();
    this.coverPageSubscription?.unsubscribe();
    this.coverPageSubscription = this.coverPageService
      .getCoverPage()
      .subscribe({
        next: (coverPage) => {
          this.coverPage.set(coverPage);
          const backgroundImageUrl = coverPage.backgroundImageUrl?.trim();
          if (backgroundImageUrl) {
            this.preloadBackgroundImage(backgroundImageUrl);
          } else {
            // A removed image intentionally leaves the dark cover background blank
            this.clearBackgroundImage();
          }
          this.isLoading.set(false);
        },
        error: (error: HttpErrorResponse) => {
          if (error.status === 404) {
            // Stop loading when the administrator has not published Cover content yet
            this.coverPage.set(undefined);
            this.isNotPublished.set(true);
            this.clearBackgroundImage();
            this.isLoading.set(false);
            return;
          }

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
          this.blogPreviewPosts.set(
            this.shuffleBlogs(blogs.filter((blog) => blog.isVisible)),
          );
          this.activeBlogPreviewIndex.set(0);
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

    if (this.blogPreviewPosts().length < 2) {
      return;
    }

    this.blogPreviewIntervalId = window.setInterval(() => {
      this.showRandomBlogPreview();
    }, 5200);
  }

  // Pick a new blog preview without repeating the currently active card
  private showRandomBlogPreview(): void {
    const blogPreviewPosts = this.blogPreviewPosts();
    if (blogPreviewPosts.length < 2) {
      return;
    }

    const nextIndex = Math.floor(Math.random() * (blogPreviewPosts.length - 1));
    this.activeBlogPreviewIndex.update((activeIndex) =>
      nextIndex >= activeIndex ? nextIndex + 1 : nextIndex,
    );
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
    this.isCoverImageLoading.set(true);

    const image = new Image();
    image.onload = () => {
      // Ignore older image loads that finish after a newer image request
      if (loadId === this.backgroundImageLoadId) {
        this.backgroundImageUrl.set(imageUrl);
        this.isCoverImageLoading.set(false);
      }
    };
    image.onerror = () => {
      if (loadId === this.backgroundImageLoadId) {
        // Keep the cover usable with its solid background if the saved image fails
        this.clearBackgroundImage();
      }
    };
    image.src = imageUrl;
  }

  // Clear the optional cover image and invalidate any older image preload
  private clearBackgroundImage(): void {
    this.backgroundImageLoadId++;
    this.backgroundImageUrl.set(undefined);
    this.isCoverImageLoading.set(false);
  }
}
