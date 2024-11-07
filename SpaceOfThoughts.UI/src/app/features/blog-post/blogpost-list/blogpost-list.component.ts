import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { BlogPostService } from '../services/blog-post.service';
import { Observable, Subscription } from 'rxjs';
import { BlogPost } from '../models/blog-post.model';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-blogpost-list',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './blogpost-list.component.html',
  styleUrl: './blogpost-list.component.css',
})
export class BlogpostListComponent implements OnInit, OnDestroy {
  blogPost$?: Observable<BlogPost[]>; // Observable for the list of blog posts
  blogPostQuant$?: Subscription; // Subscription for getting the total blog post count
  totalCount!: number; // Total number of blog posts
  list: number[] = []; // Array for pagination
  pageNumber = 1; // Current page number
  pageSize = 4; // Number of blog posts per page

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
        this.totalCount = value;
        this.list = new Array(Math.ceil(value / this.pageSize));
        // Get all blog posts from the API
        this.blogPost$ = this.blogPostService.getAllBlogPosts(
          undefined,
          undefined,
          undefined,
          this.pageNumber,
          this.pageSize,
        );
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
    this.blogPost$ = this.blogPostService.getAllBlogPosts(query);
  }

  // Sort the blog post list
  sort(sortBy: string, sortDirection: string) {
    this.blogPost$ = this.blogPostService.getAllBlogPosts(
      undefined,
      sortBy,
      sortDirection,
    );
  }

  // Get a specific page of blog posts
  getPage(pageNumber: number) {
    this.pageNumber = pageNumber;
    this.blogPost$ = this.blogPostService.getAllBlogPosts(
      undefined,
      undefined,
      undefined,
      this.pageNumber,
      this.pageSize,
    );
  }

  // Get the next page of blog posts
  getNextPage() {
    if (this.pageNumber + 1 > this.list.length) {
      return;
    }
    this.pageNumber += 1;
    this.blogPost$ = this.blogPostService.getAllBlogPosts(
      undefined,
      undefined,
      undefined,
      this.pageNumber,
      this.pageSize,
    );
  }

  // Get the previous page of blog posts
  getPrevPage() {
    if (this.pageNumber - 1 < 1) {
      return;
    }
    this.pageNumber -= 1;
    this.blogPost$ = this.blogPostService.getAllBlogPosts(
      undefined,
      undefined,
      undefined,
      this.pageNumber,
      this.pageSize,
    );
  }

  // Unsubscribe from subscriptions to prevent memory leaks
  ngOnDestroy(): void {
    this.blogPostQuant$?.unsubscribe();
  }
}
