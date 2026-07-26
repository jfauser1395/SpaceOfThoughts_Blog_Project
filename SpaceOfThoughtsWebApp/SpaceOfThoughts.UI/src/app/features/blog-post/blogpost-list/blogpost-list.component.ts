import {
  Component,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { BlogPostService } from '../services/blog-post.service';
import { Subscription } from 'rxjs';
import { BlogPost } from '../models/blog-post.model';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-blogpost-list',
  imports: [RouterModule, DatePipe],
  templateUrl: './blogpost-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './blogpost-list.component.css',
})
export class BlogpostListComponent implements OnInit, OnDestroy {
  private readonly blogPostService = inject(BlogPostService);
  private readonly router = inject(Router);

  blogPostQuant$?: Subscription; // Subscription for getting the total blog post count
  blogPostsSubscription$?: Subscription; // Subscription for getting blog post rows
  readonly pageNumber = signal(1); // Current page number
  readonly pageSize = 8; // Number of blog posts per page
  readonly query = signal(''); // Current search query
  readonly sortedBy = signal(''); // Current sorted column
  readonly sortDirection = signal<'asc' | 'desc'>('asc'); // Current sort direction
  private readonly allBlogPosts = signal<BlogPost[]>([]);

  // Derive search, sort, and pagination without rebuilding rows on every view check
  private readonly matchingBlogPosts = computed(() => {
    const normalizedQuery = this.query().toLowerCase();
    const sortedBy = this.sortedBy();
    const sortDirection = this.sortDirection();
    let blogPosts = [...this.allBlogPosts()];

    if (normalizedQuery) {
      blogPosts = blogPosts.filter((blogPost) =>
        blogPost.title.toLowerCase().includes(normalizedQuery),
      );
    }

    if (sortedBy) {
      blogPosts.sort((first, second) => {
        const firstValue = this.getSortValue(first, sortedBy);
        const secondValue = this.getSortValue(second, sortedBy);
        const result =
          typeof firstValue === 'string' && typeof secondValue === 'string'
            ? firstValue.localeCompare(secondValue)
            : Number(firstValue) - Number(secondValue);
        return sortDirection === 'asc' ? result : -result;
      });
    }

    return blogPosts;
  });
  readonly totalCount = computed(() => this.matchingBlogPosts().length);
  readonly list = computed(
    () => new Array(Math.ceil(this.totalCount() / this.pageSize)),
  );
  readonly blogPosts = computed(() => {
    const skip = (this.pageNumber() - 1) * this.pageSize;
    return this.matchingBlogPosts().slice(skip, skip + this.pageSize);
  });

  ngOnInit(): void {
    // Scroll to the top of the page smoothly on component initialization
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'smooth',
    });

    // Get the total blog post count
    this.blogPostQuant$ = this.blogPostService.getBlogPostCount().subscribe({
      next: (value) => {
        this.blogPostsSubscription$ = this.blogPostService
          .getAllBlogPosts(
            undefined,
            undefined,
            undefined,
            1,
            Math.max(value, this.pageSize),
          )
          .subscribe({
            next: (blogPosts) => {
              this.allBlogPosts.set(blogPosts);
            },
          });
      },
    });
  }

  // Navigate within the SPA without forcing all Angular bundles to reload
  navigateToAddBlogPost(): void {
    void this.router.navigateByUrl('/admin/blogposts/add');
  }

  // Open the selected editor while preserving the current application shell
  navigateToEditBlogPost(blogpost: string): void {
    void this.router.navigateByUrl(`/admin/blogposts/${blogpost}`);
  }

  // Search for blog posts by query
  onSearch(query: string): void {
    this.query.set(query.trim());
    this.pageNumber.set(1);
  }

  // Sort the blog post list
  sort(sortBy: string): void {
    if (this.sortedBy() === sortBy) {
      this.sortDirection.update((direction) =>
        direction === 'asc' ? 'desc' : 'asc',
      );
    } else {
      this.sortedBy.set(sortBy);
      this.sortDirection.set('asc');
    }

    this.pageNumber.set(1);
  }

  // Check whether a table column owns the active sort state
  isSortedBy(sortBy: string): boolean {
    return this.sortedBy() === sortBy;
  }

  // Expose the active direction for accessible sortable table headers
  getSortAria(sortBy: string): 'ascending' | 'descending' | null {
    if (!this.isSortedBy(sortBy)) {
      return null;
    }

    return this.sortDirection() === 'asc' ? 'ascending' : 'descending';
  }

  // Describe the direction that clicking a sortable header will apply next
  getSortLabel(label: string, sortBy: string): string {
    const nextDirection =
      this.isSortedBy(sortBy) && this.sortDirection() === 'asc'
        ? 'descending'
        : 'ascending';

    return `Sort ${label} ${nextDirection}`;
  }

  // Get a specific page of blog posts
  getPage(pageNumber: number): void {
    this.pageNumber.set(pageNumber);
  }

  // Get the next page of blog posts
  getNextPage(): void {
    if (this.pageNumber() + 1 > this.list().length) {
      return;
    }
    this.pageNumber.update((pageNumber) => pageNumber + 1);
  }

  // Get the previous page of blog posts
  getPrevPage(): void {
    if (this.pageNumber() - 1 < 1) {
      return;
    }
    this.pageNumber.update((pageNumber) => pageNumber - 1);
  }

  // Normalize text and date fields before comparing the active sort column
  private getSortValue(blogPost: BlogPost, sortBy: string): string | number {
    if (sortBy === 'publishedDate') {
      return new Date(blogPost.publishedDate).getTime();
    }

    if (sortBy === 'isVisible') {
      return blogPost.isVisible ? 1 : 0;
    }

    if (sortBy === 'category') {
      return (
        blogPost.categories
          ?.map((category) => category.name.toLowerCase())
          .sort()[0] ?? ''
      );
    }

    return blogPost.title.toLowerCase();
  }

  // Unsubscribe from subscriptions to prevent memory leaks
  ngOnDestroy(): void {
    this.blogPostQuant$?.unsubscribe();
    this.blogPostsSubscription$?.unsubscribe();
  }
}
