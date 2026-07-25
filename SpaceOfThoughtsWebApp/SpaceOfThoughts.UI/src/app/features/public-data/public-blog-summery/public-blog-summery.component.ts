import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { BlogPostService } from '../../blog-post/services/blog-post.service';
import { catchError, Observable, of, Subscription, tap } from 'rxjs';
import { BlogPost } from '../../blog-post/models/blog-post.model';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from '../../auth/services/auth.service';
import { User } from '../../auth/models/user.model';
import { CategoryService } from '../../category/services/category.service';
import { Category } from '../../category/models/category.model';
import { BlogSummaryPageService } from '../services/blog-summary-page.service';
import { LoadingOverlayComponent } from '../../../core/loading-overlay/loading-overlay.component';

@Component({
  selector: 'app-home',
  imports: [CommonModule, RouterModule, LoadingOverlayComponent],
  templateUrl: './public-blog-summery.component.html',
  styleUrl: './public-blog-summery.component.css',
})
export class PublicBlogSummeryComponent implements OnInit, OnDestroy {
  categories$?: Observable<Category[]>; // Observable for the list of categories
  blogs: BlogPost[] = []; // List of blog posts returned from the API
  filteredBlogs: BlogPost[] = []; // List of blog posts after category filtering
  imageLoaded = false; // Flag to indicate if the image is loaded
  user?: User; // Current user
  userSubscription$?: Subscription; // Subscription for user data
  sortedBy: string; // Field to sort the blog posts by
  sortDirection: string; // Direction of sorting
  navBarSearch$?: Subscription; // Subscription for navbar search functionality
  routeSearch$?: Subscription; // Subscription for search query from navigation
  blogsSubscription$?: Subscription; // Subscription for loading blog posts
  blogSummaryPageSubscription$?: Subscription; // Subscription for loading page settings
  selectedCategoryId = 'all'; // Currently selected category filter
  categoryResultsAnimationName = 'category-results-enter-a';
  categoryCardsAnimationName = 'category-cards-enter-a';
  isLoadingBlogs = true; // Flag to indicate if blog posts are loading
  isLoadingCategories = true; // Flag for category options required by the filter bar
  isLoadingPageSettings = true; // Flag for the configurable public blogs background
  backgroundImageUrl?: string; // Optional configured background; undefined keeps the dark page blank
  canScrollCategoriesBack = false; // Show the previous-topics arrow only after the row has moved
  canScrollCategoriesForward = false; // Show the next-topics arrow only while topics remain off-screen
  private blogRetryTimeoutId?: number; // Timer for retrying unavailable blog requests
  private categoryFilterElement?: HTMLElement;
  private categoryScrollFrameId?: number;

  @ViewChild('categoryFilterBar')
  set categoryFilterBar(element: ElementRef<HTMLElement> | undefined) {
    this.categoryFilterElement = element?.nativeElement;
    this.queueCategoryScrollState();
  }

  constructor(
    private blogPostService: BlogPostService, // Inject BlogPostService for blog post operations
    private categoryService: CategoryService, // Inject CategoryService for category filter bar
    private authService: AuthService, // Inject AuthService for authentication
    private route: ActivatedRoute, // Inject ActivatedRoute for search query params
    private blogSummaryPageService: BlogSummaryPageService, // Inject BlogSummaryPageService for page settings
  ) {
    this.sortedBy = 'publishedDate'; // Default sorting by published date
    this.sortDirection = 'desc'; // Default sorting direction

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

    // Get the current user to validate access rights for blog details and redirect to login page if not authenticated
    this.userSubscription$ = this.authService.user().subscribe({
      next: (response) => {
        this.user = response;
      },
    });

    this.user = this.authService.getUser();

    // Load category options and include them in the initial page readiness state
    this.categories$ = this.categoryService
      .getAllCategories(undefined, 'name', 'asc')
      .pipe(
        tap((categories) => {
          this.isLoadingCategories = false;
        }),
        catchError(() => {
          // Keep the page usable without filters if the category request fails
          this.isLoadingCategories = false;
          return of([]);
        }),
      );

    // Load optional page styling and use the bundled background on failure
    this.blogSummaryPageSubscription$ = this.blogSummaryPageService
      .getBlogSummaryPage()
      .subscribe({
        next: (blogSummaryPage) => {
          this.backgroundImageUrl =
            blogSummaryPage.backgroundImageUrl?.trim() || undefined;
          this.isLoadingPageSettings = false;
        },
        error: () => {
          // Optional settings must not trap the page behind the loading overlay
          this.isLoadingPageSettings = false;
        },
      });

    // Get all blog posts, optionally filtered by the navbar search query
    this.routeSearch$ = this.route.queryParamMap.subscribe((params) => {
      this.onSearch(params.get('query') ?? '');
    });
  }

  // Wait for every resource needed to present the public blogs page coherently
  get isPageLoading(): boolean {
    return (
      this.isLoadingBlogs ||
      this.isLoadingCategories ||
      this.isLoadingPageSettings
    );
  }

  // Keep edge controls synchronized when the available row width changes
  @HostListener('window:resize')
  onWindowResize(): void {
    this.queueCategoryScrollState();
  }

  // Move by most of the visible row while preserving enough context between steps
  scrollCategories(direction: 'back' | 'forward'): void {
    const categoryFilter = this.categoryFilterElement;

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
    const categoryFilter = this.categoryFilterElement;

    if (!categoryFilter) {
      this.canScrollCategoriesBack = false;
      this.canScrollCategoriesForward = false;
      return;
    }

    const endPosition = categoryFilter.scrollWidth - categoryFilter.clientWidth;
    this.canScrollCategoriesBack = categoryFilter.scrollLeft > 3;
    this.canScrollCategoriesForward =
      endPosition > 3 && categoryFilter.scrollLeft < endPosition - 3;
  }

  // Search for blog posts by query
  onSearch(query: string) {
    const searchQuery = query.trim();
    this.selectedCategoryId = 'all';
    this.loadBlogs(searchQuery || undefined);
  }

  // Update the active category and filter the already-loaded posts
  selectCategory(categoryId: string): void {
    if (this.selectedCategoryId === categoryId) {
      return;
    }

    this.selectedCategoryId = categoryId;
    this.categoryResultsAnimationName =
      this.categoryResultsAnimationName === 'category-results-enter-a'
        ? 'category-results-enter-b'
        : 'category-results-enter-a';
    this.categoryCardsAnimationName =
      this.categoryCardsAnimationName === 'category-cards-enter-a'
        ? 'category-cards-enter-b'
        : 'category-cards-enter-a';
    this.applyCategoryFilter();
  }

  // Load visible blog data and keep retrying temporary API failures
  private loadBlogs(query?: string): void {
    this.isLoadingBlogs = true;
    this.clearBlogRetry();
    this.blogsSubscription$?.unsubscribe();
    this.blogsSubscription$ = this.blogPostService
      .getAllBlogPosts(query, this.sortedBy, this.sortDirection)
      .subscribe({
        next: (blogs) => {
          this.isLoadingBlogs = false;
          this.blogs = blogs;
          this.applyCategoryFilter();
        },
        error: () => {
          this.blogRetryTimeoutId = window.setTimeout(() => {
            this.loadBlogs(query);
          }, 2500);
        },
      });
  }

  // Apply the selected category without requesting the loaded blogs again
  private applyCategoryFilter(): void {
    const visibleBlogs = this.blogs.filter((blog) => blog.isVisible);

    if (this.selectedCategoryId === 'all') {
      this.filteredBlogs = visibleBlogs;
      return;
    }

    this.filteredBlogs = visibleBlogs.filter((blog) =>
      blog.categories.some(
        (category) => category.id === this.selectedCategoryId,
      ),
    );
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
    this.userSubscription$?.unsubscribe();
    this.blogsSubscription$?.unsubscribe();
    this.blogSummaryPageSubscription$?.unsubscribe();
    if (this.categoryScrollFrameId !== undefined) {
      window.cancelAnimationFrame(this.categoryScrollFrameId);
    }
    this.clearBlogRetry();
  }
}
