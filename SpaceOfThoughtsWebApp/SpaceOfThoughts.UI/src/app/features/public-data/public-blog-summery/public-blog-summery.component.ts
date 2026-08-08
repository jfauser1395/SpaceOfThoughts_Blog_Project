import {
  Component,
  ElementRef,
  computed,
  effect,
  HostListener,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { BlogPostService } from '../../blog-post/services/blog-post.service';
import { catchError, Observable, of, Subscription, tap } from 'rxjs';
import { BlogPost } from '../../blog-post/models/blog-post.model';
import { AsyncPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { CategoryService } from '../../category/services/category.service';
import { Category } from '../../category/models/category.model';
import { BlogSummaryPageService } from '../services/blog-summary-page.service';
import { LoadingOverlayComponent } from '../../../core/loading-overlay/loading-overlay.component';
import { FramedImageComponent } from '../../../core/media/framed-image.component';
import {
  buildCenteredFramingTransform,
  buildFramingObjectPosition,
  framingRenderScale,
  parseImageFraming,
} from '../../../core/media/image-framing';

@Component({
  selector: 'app-home',
  imports: [
    RouterModule,
    LoadingOverlayComponent,
    AsyncPipe,
    DatePipe,
    FramedImageComponent,
  ],
  templateUrl: './public-blog-summery.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './public-blog-summery.component.css',
})
export class PublicBlogSummeryComponent implements OnInit, OnDestroy {
  private readonly blogPostService = inject(BlogPostService);
  private readonly categoryService = inject(CategoryService);
  private readonly route = inject(ActivatedRoute);
  private readonly blogSummaryPageService = inject(BlogSummaryPageService);

  categories$?: Observable<Category[]>; // Observable for the list of categories
  readonly blogs = signal<BlogPost[]>([]); // List of blog posts returned from the API
  readonly sortedBy = 'publishedDate'; // Field to sort the blog posts by
  readonly sortDirection = 'desc'; // Direction of sorting
  navBarSearch$?: Subscription; // Subscription for navbar search functionality
  routeSearch$?: Subscription; // Subscription for search query from navigation
  blogsSubscription$?: Subscription; // Subscription for loading blog posts
  blogSummaryPageSubscription$?: Subscription; // Subscription for loading page settings
  readonly selectedCategoryId = signal('all'); // Currently selected category filter
  readonly categoryResultsAnimationName = signal('category-results-enter-a');
  readonly categoryCardsAnimationName = signal('category-cards-enter-a');
  readonly isLoadingBlogs = signal(true); // Flag to indicate if blog posts are loading
  readonly isLoadingCategories = signal(true); // Flag for category options required by the filter bar
  readonly isLoadingPageSettings = signal(true); // Flag for the configurable public blogs background
  readonly backgroundImageUrl = signal<string | undefined>(undefined); // Optional configured background; undefined keeps the dark page blank
  readonly backgroundImagePosition = signal<string | undefined>(undefined); // Saved framing for that background

  // Render the framing an administrator saved in the blogs page editor. The same
  // helpers drive the editor preview, so both surfaces crop the picture alike.
  private readonly backgroundImagePlacement = computed(() =>
    parseImageFraming(this.backgroundImagePosition()),
  );
  readonly backgroundImageZoom = computed(() =>
    framingRenderScale(this.backgroundImagePlacement()),
  );
  readonly backgroundImageTransform = computed(() =>
    buildCenteredFramingTransform(this.backgroundImagePlacement()),
  );
  readonly backgroundImageObjectPosition = computed(() =>
    buildFramingObjectPosition(this.backgroundImagePlacement()),
  );
  readonly canScrollCategoriesBack = signal(false); // Show the previous-topics arrow only after the row has moved
  readonly canScrollCategoriesForward = signal(false); // Show the next-topics arrow only while topics remain off-screen

  // Computed state avoids rebuilding filtered results during unrelated checks
  readonly filteredBlogs = computed(() => {
    const visibleBlogs = this.blogs().filter((blog) => blog.isVisible);
    const selectedCategoryId = this.selectedCategoryId();

    if (selectedCategoryId === 'all') {
      return visibleBlogs;
    }

    return visibleBlogs.filter((blog) =>
      blog.categories.some((category) => category.id === selectedCategoryId),
    );
  });
  readonly isPageLoading = computed(
    () =>
      this.isLoadingBlogs() ||
      this.isLoadingCategories() ||
      this.isLoadingPageSettings(),
  );

  private blogRetryTimeoutId?: number; // Timer for retrying unavailable blog requests
  private categoryScrollFrameId?: number;
  private readonly categoryFilterBar =
    viewChild<ElementRef<HTMLElement>>('categoryFilterBar');

  // Re-measure category overflow whenever the conditional filter bar appears
  private readonly categoryFilterLayoutEffect = effect(() => {
    this.categoryFilterBar();
    this.queueCategoryScrollState();
  });

  constructor() {
    // Subscribe to search bar input from the nav component
    this.navBarSearch$ = this.blogPostService.navSort.subscribe(
      (query: string) => this.onSearch(query),
    );
  }

  ngOnInit(): void {
    // Scroll to the top of the page smoothly on component initialization
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'smooth',
    });

    // Load category options and include them in the initial page readiness state
    this.categories$ = this.categoryService
      .getAllCategories(undefined, 'name', 'asc')
      .pipe(
        tap(() => {
          this.isLoadingCategories.set(false);
        }),
        catchError(() => {
          // Keep the page usable without filters if the category request fails
          this.isLoadingCategories.set(false);
          return of([]);
        }),
      );

    // Load optional page styling and use the bundled background on failure
    this.blogSummaryPageSubscription$ = this.blogSummaryPageService
      .getBlogSummaryPage()
      .subscribe({
        next: (blogSummaryPage) => {
          this.backgroundImageUrl.set(
            blogSummaryPage.backgroundImageUrl?.trim() || undefined,
          );
          this.backgroundImagePosition.set(
            blogSummaryPage.backgroundImagePosition?.trim() || undefined,
          );
          this.isLoadingPageSettings.set(false);
        },
        error: () => {
          // Optional settings must not trap the page behind the loading overlay
          this.isLoadingPageSettings.set(false);
        },
      });

    // Get all blog posts, optionally filtered by the navbar search query
    this.routeSearch$ = this.route.queryParamMap.subscribe((params) => {
      this.onSearch(params.get('query') ?? '');
    });
  }

  // Keep edge controls synchronized when the available row width changes
  @HostListener('window:resize')
  onWindowResize(): void {
    this.queueCategoryScrollState();
  }

  // Move by most of the visible row while preserving enough context between steps
  scrollCategories(direction: 'back' | 'forward'): void {
    const categoryFilter = this.categoryFilterBar()?.nativeElement;

    if (!categoryFilter) {
      return;
    }

    const distance = Math.max(categoryFilter.clientWidth * 0.72, 180);
    categoryFilter.scrollBy({
      behavior: 'smooth',
      left: direction === 'forward' ? distance : -distance,
    });
  }

  // Update arrows as native touch, wheel, or button scrolling moves the row
  updateCategoryScrollState(): void {
    const categoryFilter = this.categoryFilterBar()?.nativeElement;

    if (!categoryFilter) {
      this.canScrollCategoriesBack.set(false);
      this.canScrollCategoriesForward.set(false);
      return;
    }

    const endPosition = categoryFilter.scrollWidth - categoryFilter.clientWidth;
    this.canScrollCategoriesBack.set(categoryFilter.scrollLeft > 3);
    this.canScrollCategoriesForward.set(
      endPosition > 3 && categoryFilter.scrollLeft < endPosition - 3,
    );
  }

  // Search for blog posts by query
  onSearch(query: string): void {
    const searchQuery = query.trim();
    this.selectedCategoryId.set('all');
    this.loadBlogs(searchQuery || undefined);
  }

  // Update the active category and filter the already-loaded posts
  selectCategory(categoryId: string): void {
    if (this.selectedCategoryId() === categoryId) {
      return;
    }

    this.selectedCategoryId.set(categoryId);
    this.categoryResultsAnimationName.update((animationName) =>
      animationName === 'category-results-enter-a'
        ? 'category-results-enter-b'
        : 'category-results-enter-a',
    );
    this.categoryCardsAnimationName.update((animationName) =>
      animationName === 'category-cards-enter-a'
        ? 'category-cards-enter-b'
        : 'category-cards-enter-a',
    );
  }

  // Load visible blog data and keep retrying temporary API failures
  private loadBlogs(query?: string): void {
    this.isLoadingBlogs.set(true);
    this.clearBlogRetry();
    this.blogsSubscription$?.unsubscribe();
    this.blogsSubscription$ = this.blogPostService
      .getAllBlogPosts(query, this.sortedBy, this.sortDirection)
      .subscribe({
        next: (blogs) => {
          this.blogs.set(blogs);
          this.isLoadingBlogs.set(false);
        },
        error: () => {
          this.blogRetryTimeoutId = window.setTimeout(() => {
            this.loadBlogs(query);
          }, 2500);
        },
      });
  }

  // Clear a scheduled retry before starting another blog request
  private clearBlogRetry(): void {
    if (this.blogRetryTimeoutId) {
      window.clearTimeout(this.blogRetryTimeoutId);
      this.blogRetryTimeoutId = undefined;
    }
  }

  // Wait for async category buttons to finish laying out before measuring overflow
  private queueCategoryScrollState(): void {
    if (this.categoryScrollFrameId !== undefined) {
      window.cancelAnimationFrame(this.categoryScrollFrameId);
    }

    this.categoryScrollFrameId = window.requestAnimationFrame(() => {
      this.categoryScrollFrameId = undefined;
      this.updateCategoryScrollState();
    });
  }

  // Unsubscribe from subscriptions to prevent memory leaks
  ngOnDestroy(): void {
    this.navBarSearch$?.unsubscribe();
    this.routeSearch$?.unsubscribe();
    this.blogsSubscription$?.unsubscribe();
    this.blogSummaryPageSubscription$?.unsubscribe();
    if (this.categoryScrollFrameId !== undefined) {
      window.cancelAnimationFrame(this.categoryScrollFrameId);
    }
    this.clearBlogRetry();
  }
}
