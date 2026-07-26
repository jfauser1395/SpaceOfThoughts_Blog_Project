import {
  Component,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Observable, Subscription } from 'rxjs';
import { BlogPostService } from '../services/blog-post.service';
import { BlogPost } from '../models/blog-post.model';
import { AsyncPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { CategoryService } from '../../category/services/category.service';
import { Category } from '../../category/models/category.model';
import { UpdateBlogPost } from '../models/update-blog-post.model';
import { ImageSelectorComponent } from '../shared/components/image-selector/image-selector.component';
import { ImageService } from '../shared/components/services/image.service';
import { ViewportScroller } from '@angular/common';
import { MarkdownEditorComponent } from '../shared/components/markdown-editor/markdown-editor.component';

@Component({
  selector: 'app-edit-blogpost',
  templateUrl: './edit-blogpost.component.html',
  styleUrl: './edit-blogpost.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    DatePipe,
    ImageSelectorComponent,
    MarkdownEditorComponent,
    AsyncPipe,
  ],
})
export class EditBlogpostComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly blogPostService = inject(BlogPostService);
  private readonly categoryService = inject(CategoryService);
  private readonly imageService = inject(ImageService);
  private readonly router = inject(Router);
  private readonly viewportScroller = inject(ViewportScroller);

  id: string | null = null; // ID of the blog post to be edited
  readonly model = signal<BlogPost | undefined>(undefined); // Model for the blog post data
  categories$?: Observable<Category[]>; // Observable for the list of categories
  selectedCategories?: string[]; // Array to hold selected categories IDs
  routeSubscribtion$?: Subscription; // Subscription for route parameters
  getBlogPostSubscribtion$?: Subscription; // Subscription for getting the blog post
  updateBlogPostSubscription$?: Subscription; // Subscription for updating the blog post
  deleteBlogPostSubscription$?: Subscription; // Subscription for deleting the blog post
  imageSelectSubscription$?: Subscription; // Subscription for image selection
  readonly urlHandleWarning = signal<string | undefined>(undefined);

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
                this.model.set(response);
                this.selectedCategories = response.categories.map((x) => x.id);
              },
            });
        }

        // Subscribe to image selector to get the selected image URL
        this.imageSelectSubscription$ = this.imageService
          .onSelectImage()
          .subscribe({
            next: (response) => {
              this.model.update((model) =>
                model ? { ...model, featuredImageUrl: response.url } : model,
              );
            },
          });
      },
    });
  }

  // Handle form submission to update the blog post
  onFormSubmit(): void {
    const model = this.model();
    if (model?.urlHandle !== '') {
      // Convert this model to UpdateBlogPost request object
      if (model && this.id) {
        const updateBlogPost: UpdateBlogPost = {
          author: model.author,
          content: model.content,
          shortDescription: model.shortDescription,
          featuredImageUrl: model.featuredImageUrl,
          isVisible: model.isVisible,
          publishedDate: model.publishedDate,
          title: model.title,
          urlHandle: model.urlHandle,
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
      this.urlHandleWarning.set(
        '*Please make sure to at least fill out this field!',
      ); // Warning message to fill out the urlHandleField
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
