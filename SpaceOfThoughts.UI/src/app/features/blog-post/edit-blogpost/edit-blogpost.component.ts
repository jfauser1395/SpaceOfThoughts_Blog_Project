import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Observable, Subscription } from 'rxjs';
import { BlogPostService } from '../services/blog-post.service';
import { BlogPost } from '../models/blog-post.model';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { MarkdownComponent } from 'ngx-markdown';
import { CategoryService } from '../../category/services/category.service';
import { Category } from '../../category/models/category.model';
import { UpdateBlogPost } from '../models/update-blog-post.model';
import { ImageSelectorComponent } from '../shared/components/image-selector/image-selector.component';
import { ImageService } from '../shared/components/services/image.service';
import { ViewportScroller } from '@angular/common';

@Component({
  selector: 'app-edit-blogpost',
  standalone: true,
  templateUrl: './edit-blogpost.component.html',
  styleUrl: './edit-blogpost.component.css',
  imports: [
    CommonModule,
    FormsModule,
    MarkdownComponent,
    DatePipe,
    ImageSelectorComponent,
  ],
})
export class EditBlogpostComponent implements OnInit, OnDestroy {
  id: string | null = null; // ID of the blog post to be edited
  model?: BlogPost; // Model for the blog post data
  categories$?: Observable<Category[]>; // Observable for the list of categories
  selectedCategories?: string[]; // Array to hold selected categories IDs
  routeSubscribtion$?: Subscription; // Subscription for route parameters
  getBlogPostSubscribtion$?: Subscription; // Subscription for getting the blog post
  updateBlogPostSubscription$?: Subscription; // Subscription for updating the blog post
  deleteBlogPostSubscription$?: Subscription; // Subscription for deleting the blog post
  imageSelectSubscription$?: Subscription; // Subscription for image selection
  urlHandleWarning?: string; // Url handle field warning

  constructor(
    private route: ActivatedRoute, // Inject ActivatedRoute to access route parameters
    private blogPostService: BlogPostService, // Inject BlogPostService for blog post operations
    private categoryService: CategoryService, // Inject CategoryService for category operations
    private imageService: ImageService, // Inject ImageService for image operations
    private router: Router, // Inject Router for navigation
    private viewportScroller: ViewportScroller, // Inject viewportScroller for scroll control
  ) {}

  ngOnInit(): void {
    // Get the list of categories
    this.categories$ = this.categoryService.getAllCategories();

    // Subscribe to route parameters to get the blog post ID
    this.routeSubscribtion$ = this.route.paramMap.subscribe({
      next: (params) => {
        this.id = params.get('id');
        // Get the blog post from the API
        if (this.id) {
          this.getBlogPostSubscribtion$ = this.blogPostService
            .getBlogPostById(this.id)
            .subscribe({
              next: (response) => {
                this.model = response;
                this.selectedCategories = response.categories.map((x) => x.id);
              },
            });
        }

        // Subscribe to image selector to get the selected image URL
        this.imageSelectSubscription$ = this.imageService
          .onSelectImage()
          .subscribe({
            next: (response) => {
              if (this.model) {
                this.model.featuredImageUrl = response.url;
              }
            },
          });
      },
    });
  }

  // Handle form submission to update the blog post
  onFormSubmit(): void {
    if (this.model?.urlHandle != '') {
      // Convert this model to UpdateBlogPost request object
      if (this.model && this.id) {
        var updateBlogPost: UpdateBlogPost = {
          author: this.model.author,
          content: this.model.content,
          shortDescription: this.model.shortDescription,
          featuredImageUrl: this.model.featuredImageUrl,
          isVisible: this.model.isVisible,
          publishedDate: this.model.publishedDate,
          title: this.model.title,
          urlHandle: this.model.urlHandle,
          categories: this.selectedCategories ?? [],
        };
        this.updateBlogPostSubscription$ = this.blogPostService
          .updateBlogPost(this.id, updateBlogPost)
          .subscribe({
            next: () => {
              this.router.navigateByUrl('/admin/blogposts').then(() => {
                this.viewportScroller.scrollToPosition([0, 0]); // Redirect to blog posts admin page on success
              });
            },
          });
      }
    } else {
      this.viewportScroller.scrollToPosition([0, 0]); // Scroll up
      this.urlHandleWarning =
        '*Please make sure to at lease fill out this field!'; // Warning massage to fill out the urlHandleField
    }
  }

  // Handle deletion of the blog post
  onDelete(): void {
    if (this.id) {
      this.deleteBlogPostSubscription$ = this.blogPostService
        .deleteBlogPost(this.id)
        .subscribe({
          next: () => {
            this.router.navigateByUrl('/admin/blogposts').then(() => {
              this.viewportScroller.scrollToPosition([0, 0]); // Redirect and scroll up to blog posts admin page on success
            });
          },
        });
    }
  }

  // Unsubscribe from subscriptions to prevent memory leaks
  ngOnDestroy(): void {
    this.routeSubscribtion$?.unsubscribe();
    this.getBlogPostSubscribtion$?.unsubscribe();
    this.updateBlogPostSubscription$?.unsubscribe();
    this.deleteBlogPostSubscription$?.unsubscribe();
    this.imageSelectSubscription$?.unsubscribe();
  }
}
