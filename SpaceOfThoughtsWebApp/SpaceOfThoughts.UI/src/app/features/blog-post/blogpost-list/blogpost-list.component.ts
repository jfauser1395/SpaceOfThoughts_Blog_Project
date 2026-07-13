import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { BlogPostService } from '../services/blog-post.service';
import { Observable, of, Subscription } from 'rxjs';
import { BlogPost } from '../models/blog-post.model';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-blogpost-list',
  imports: [RouterModule, CommonModule],
  templateUrl: './blogpost-list.component.html',
  styleUrl: './blogpost-list.component.css',
})
export class BlogpostListComponent implements OnInit, OnDestroy {
  blogPost$?: Observable<BlogPost[]>; // Observable for the list of blog posts
  blogPostQuant$?: Subscription; // Subscription for getting the total blog post count
  blogPostsSubscription$?: Subscription; // Subscription for getting blog post rows
  totalCount!: number; // Total number of blog posts
  list: number[] = []; // Array for pagination
  pageNumber = 1; // Current page number
  pageSize = 8; // Number of blog posts per page
  query = ''; // Current search query
  sortedBy = ''; // Current sorted column
  sortDirection: 'asc' | 'desc' = 'asc'; // Current sort direction
  private allBlogPosts: BlogPost[] = [];

  constructor(
    private blogPostService: BlogPostService,
    private router: Router,
  ) {}

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
              this.allBlogPosts = blogPosts;
              this.loadBlogPosts();
            },
          });
      },
    });
  }

  // Navigate to the add blogpost page and reload
  navigateToAddBlogPost() {
    this.router.navigateByUrl('/admin/blogposts/add').then(() => {
      window.location.reload();
    });
  }

  // Navigate to the edit blogpost page and reload
  navigateToEditBlogPost(blogpost: string) {
    this.router.navigateByUrl(`/admin/blogposts/${blogpost}`).then(() => {
      window.location.reload();
    });
  }

  // Search for blog posts by query
  onSearch(query: string) {
    this.query = query.trim();
    this.pageNumber = 1;
    this.loadBlogPosts();
  }

  // Sort the blog post list
  sort(sortBy: string) {
    if (this.sortedBy === sortBy) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortedBy = sortBy;
      this.sortDirection = 'asc';
    }

    this.pageNumber = 1;
    this.loadBlogPosts();
  }

  // Check whether a table column owns the active sort state
  isSortedBy(sortBy: string): boolean {
    return this.sortedBy === sortBy;
  }

  // Expose the active direction for accessible sortable table headers
  getSortAria(sortBy: string): 'ascending' | 'descending' | null {
    if (!this.isSortedBy(sortBy)) {
      return null;
    }

    return this.sortDirection === 'asc' ? 'ascending' : 'descending';
  }

  // Describe the direction that clicking a sortable header will apply next
  getSortLabel(label: string, sortBy: string): string {
    const nextDirection =
      this.isSortedBy(sortBy) && this.sortDirection === 'asc'
        ? 'descending'
        : 'ascending';

    return `Sort ${label} ${nextDirection}`;
  }

  // Get a specific page of blog posts
  getPage(pageNumber: number) {
    this.pageNumber = pageNumber;
    this.loadBlogPosts();
  }

  // Get the next page of blog posts
  getNextPage() {
    if (this.pageNumber + 1 > this.list.length) {
      return;
    }
    this.pageNumber += 1;
    this.loadBlogPosts();
  }

  // Get the previous page of blog posts
  getPrevPage() {
    if (this.pageNumber - 1 < 1) {
      return;
    }
    this.pageNumber -= 1;
    this.loadBlogPosts();
  }

  // Apply search, sorting, and pagination to the cached blog post collection
  private loadBlogPosts(): void {
    let blogPosts = [...this.allBlogPosts];
    const normalizedQuery = this.query.toLowerCase();

    if (normalizedQuery) {
      blogPosts = blogPosts.filter((blogPost) =>
        blogPost.title.toLowerCase().includes(normalizedQuery),
      );
    }

    if (this.sortedBy) {
      blogPosts.sort((first, second) => {
        const firstValue = this.getSortValue(first, this.sortedBy);
        const secondValue = this.getSortValue(second, this.sortedBy);
        const result =
          typeof firstValue === 'string' && typeof secondValue === 'string'
            ? firstValue.localeCompare(secondValue)
            : Number(firstValue) - Number(secondValue);

        return this.sortDirection === 'asc' ? result : -result;
      });
    }

    this.totalCount = blogPosts.length;
    this.list = new Array(Math.ceil(this.totalCount / this.pageSize));

    if (this.pageNumber > this.list.length && this.list.length > 0) {
      this.pageNumber = this.list.length;
    }

    const skip = (this.pageNumber - 1) * this.pageSize;
    this.blogPost$ = of(blogPosts.slice(skip, skip + this.pageSize));
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
