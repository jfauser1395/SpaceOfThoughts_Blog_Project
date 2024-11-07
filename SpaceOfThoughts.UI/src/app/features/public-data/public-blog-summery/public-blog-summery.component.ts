import { Component, OnDestroy, OnInit } from '@angular/core';
import { BlogPostService } from '../../blog-post/services/blog-post.service';
import { Observable, Subscription } from 'rxjs';
import { BlogPost } from '../../blog-post/models/blog-post.model';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { StyleService } from '../../../../services/style.service';
import { AuthService } from '../../auth/services/auth.service';
import { User } from '../../auth/models/user.model';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './public-blog-summery.component.html',
  styleUrl: './public-blog-summery.component.css',
})
export class PublicBlogSummeryComponent implements OnInit, OnDestroy {
  blogs$?: Observable<BlogPost[]>; // Observable for the list of blog posts
  imageLoaded = false; // Flag to indicate if the image is loaded
  user?: User; // Current user
  userSubscription$?: Subscription; // Subscription for user data
  sortedBy: string; // Field to sort the blog posts by
  sortDirection: string; // Direction of sorting
  navBarSearch$?: Subscription; // Subscription for navbar search functionality
  blogsEmptySubscribtion$?: Subscription; // Subscription for checking if there are blogs
  noBlogs: boolean = true;// Flag to indicate if there are no blogs

  constructor(
    private blogPostService: BlogPostService, // Inject BlogPostService for blog post operations
    private loadingIconService: StyleService, // Inject StyleService for styling
    private authService: AuthService, // Inject AuthService for authentication
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

    // Check if there are blogs in the database
    this.blogsEmptySubscribtion$ = this.blogPostService
    .checkIfImagesEmpty()
    .subscribe((isEmpty) => {
      this.noBlogs = isEmpty;
    });

    // Get the current user to validate access rights for blog details and redirect to login page if not authenticated
    this.userSubscription$ = this.authService.user().subscribe({
      next: (response) => {
        this.user = response;
      },
    });

    this.user = this.authService.getUser();

    // Get all blog posts
    this.blogs$ = this.blogPostService.getAllBlogPosts(
      undefined,
      this.sortedBy,
      this.sortDirection,
    );
  }

  // Search for blog posts by query
  onSearch(query: string) {
    this.blogs$ = this.blogPostService.getAllBlogPosts(query);
  }

  // Show loading icon
  loadImageOn() {
    this.loadingIconService.setBodyStyle('overflow', 'hidden');
  }

  // Hide loading icon
  loadImageOff() {
    this.loadingIconService.setBodyStyle('overflow', 'auto');
  }

  // Unsubscribe from subscriptions to prevent memory leaks
  ngOnDestroy(): void {
    this.navBarSearch$?.unsubscribe();
    this.userSubscription$?.unsubscribe();
    this.blogsEmptySubscribtion$?.unsubscribe();
  }
}
