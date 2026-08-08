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
import { ImageFramingEditorComponent } from '../../../core/media/image-framing-editor.component';
import { HostListener, viewChild } from '@angular/core';

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
    ImageFramingEditorComponent,
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

  // One picker serves every picture, so it has to be told which is being chosen
  readonly imageTarget = signal<'featured' | 'background' | 'content'>(
    'featured',
  );

  // Needed to drop a chosen picture at the cursor inside the body editor
  private readonly markdownEditor = viewChild(MarkdownEditorComponent);

  // The background fills the reader's viewport, so its preview is shaped like one
  readonly previewAspectRatio = signal(this.readViewportAspectRatio());

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
              // A picture chosen for the body goes in at the cursor, not on the model
              if (this.imageTarget() === 'content') {
                this.markdownEditor()?.insertImage(response.url);
                return;
              }

              // A different picture frames differently, so start its crops centred
              this.model.update((model) => {
                if (!model) {
                  return model;
                }

                return this.imageTarget() === 'background'
                  ? {
                      ...model,
                      backgroundImageUrl: response.url,
                      backgroundImagePosition: null,
                    }
                  : {
                      ...model,
                      featuredImageUrl: response.url,
                      featuredImageCardPosition: null,
                      featuredImageBannerPosition: null,
                    };
              });
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
          // Framing only means something alongside a picture
          featuredImageCardPosition: model.featuredImageUrl
            ? (model.featuredImageCardPosition ?? null)
            : null,
          featuredImageBannerPosition: model.featuredImageUrl
            ? (model.featuredImageBannerPosition ?? null)
            : null,
          backgroundImageUrl: model.backgroundImageUrl ?? null,
          backgroundImagePosition: model.backgroundImageUrl
            ? (model.backgroundImagePosition ?? null)
            : null,
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

  // Keep the preview shaped like the viewport the background will actually fill
  @HostListener('window:resize')
  onWindowResize(): void {
    this.previewAspectRatio.set(this.readViewportAspectRatio());
  }

  // Clear the chosen background picture and the framing that went with it
  onRemoveBackgroundImage(): void {
    this.model.update((model) =>
      model
        ? { ...model, backgroundImageUrl: null, backgroundImagePosition: null }
        : model,
    );
  }

  private readViewportAspectRatio(): string {
    const width = window.innerWidth;
    const height = window.innerHeight;

    return width && height ? `${width} / ${height}` : '16 / 9';
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
