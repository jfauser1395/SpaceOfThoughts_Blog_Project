import { Component, OnDestroy, OnInit } from '@angular/core';
import { AddBlogPost } from '../models/add-blog-post.model';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { BlogPostService } from '../services/blog-post.service';
import { Router } from '@angular/router';
import { CategoryService } from '../../category/services/category.service';
import { Observable, Subscription } from 'rxjs';
import { Category } from '../../category/models/category.model';
import { CommonModule } from '@angular/common';
import { MarkdownComponent } from 'ngx-markdown';
import { ImageSelectorComponent } from '../shared/components/image-selector/image-selector.component';
import { ImageService } from '../shared/components/services/image.service';
import { ViewportScroller } from '@angular/common';

@Component({
  selector: 'app-add-blogpost',
  standalone: true,
  templateUrl: './add-blogpost.component.html',
  styleUrls: ['./add-blogpost.component.css'],
  imports: [
    FormsModule,
    DatePipe,
    MarkdownComponent,
    CommonModule,
    ImageSelectorComponent,
  ],
})
export class AddBlogpostComponent implements OnInit, OnDestroy {
  model: AddBlogPost; // Model for the blog post data
  categories$?: Observable<Category[]>; // Observable for the list of categories
  imageSelectorSubscription?: Subscription; // Subscription for the image selector
  urlHandleWarning?: string; // Url handle field warning 

  constructor(
    private blogpostService: BlogPostService, // Inject BlogPostService for blog post operations
    private categoryService: CategoryService, // Inject CategoryService for category operations
    private imageService: ImageService, // Inject ImageService for image operations
    private router: Router, // Inject Router for navigation
    private viewportScroller: ViewportScroller, // Inject viewportScroller for scroll control
  ) {
    // Initialize the model with default values
    this.model = {
      title: '',
      shortDescription: '',
      urlHandle: '',
      content: '',
      featuredImageUrl: '',
      author: '',
      isVisible: true,
      publishedDate: new Date(),
      categories: [],
    };
  }

  ngOnInit(): void {
    // Get the list of categories
    this.categories$ = this.categoryService.getAllCategories();

    // Subscribe to the image selector to get the selected image URL
    this.imageSelectorSubscription = this.imageService
      .onSelectImage()
      .subscribe({
        next: (selectedImage) =>
          (this.model.featuredImageUrl = selectedImage.url),
      });
  }

  // Handle form submission to create a new blog post
  onFormSubmit(): void {
    if (this.model.urlHandle != '') {
      this.blogpostService.createBlogPost(this.model).subscribe({
        next: () => {
          this.router.navigateByUrl('/admin/blogposts').then(() => {
            this.viewportScroller.scrollToPosition([0, 0]); // Redirect and scroll up to blog posts admin page on success
          });
        },
      });
    } else {
      this.viewportScroller.scrollToPosition([0, 0]); // Scroll up
      this.urlHandleWarning =
        '*Please make sure to at lease fill out this field!'; // Warning massage to fill out the urlHandleField
    }
  }

  // Unsubscribe from the image selector to prevent memory leaks
  ngOnDestroy(): void {
    this.imageSelectorSubscription?.unsubscribe();
  }
}
