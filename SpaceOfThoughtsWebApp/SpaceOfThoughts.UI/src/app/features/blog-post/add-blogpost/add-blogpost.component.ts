import {
  Component,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';
import { AddBlogPost } from '../models/add-blog-post.model';
import { FormsModule } from '@angular/forms';
import { DatePipe, AsyncPipe } from '@angular/common';
import { BlogPostService } from '../services/blog-post.service';
import { Router } from '@angular/router';
import { CategoryService } from '../../category/services/category.service';
import { Observable, Subscription } from 'rxjs';
import { Category } from '../../category/models/category.model';

import { ImageSelectorComponent } from '../shared/components/image-selector/image-selector.component';
import { ImageService } from '../shared/components/services/image.service';
import { ViewportScroller } from '@angular/common';
import { MarkdownEditorComponent } from '../shared/components/markdown-editor/markdown-editor.component';
import { ImageFramingEditorComponent } from '../../../core/media/image-framing-editor.component';
import { HostListener, viewChild } from '@angular/core';

@Component({
  selector: 'app-add-blogpost',
  templateUrl: './add-blogpost.component.html',
  styleUrls: ['./add-blogpost.component.css'],
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
export class AddBlogpostComponent implements OnInit, OnDestroy {
  private readonly blogpostService = inject(BlogPostService);
  private readonly categoryService = inject(CategoryService);
  private readonly imageService = inject(ImageService);
  private readonly router = inject(Router);
  private readonly viewportScroller = inject(ViewportScroller);

  readonly model = signal<AddBlogPost>({
    title: '',
    shortDescription: '',
    urlHandle: '',
    content: '',
    featuredImageUrl: '',
    author: '',
    isVisible: true,
    publishedDate: new Date(),
    categories: [],
  }); // Model for the blog post data
  categories$?: Observable<Category[]>; // Observable for the list of categories
  imageSelectorSubscription?: Subscription; // Subscription for the image selector
  readonly urlHandleWarning = signal<string | undefined>(undefined); // Url handle field warning

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

    // Subscribe to the image selector to get the selected image URL
    this.imageSelectorSubscription = this.imageService
      .onSelectImage()
      .subscribe({
        next: (selectedImage) => {
          // A picture chosen for the body goes in at the cursor, not on the model
          if (this.imageTarget() === 'content') {
            this.markdownEditor()?.insertImage(selectedImage.url);
            return;
          }

          // A different picture frames differently, so start its crops centred
          this.model.update((model) =>
            this.imageTarget() === 'background'
              ? {
                  ...model,
                  backgroundImageUrl: selectedImage.url,
                  backgroundImagePosition: null,
                }
              : {
                  ...model,
                  featuredImageUrl: selectedImage.url,
                  featuredImageCardPosition: null,
                  featuredImageBannerPosition: null,
                },
          );
        },
      });
  }

  // Handle form submission to create a new blog post
  onFormSubmit(): void {
    const model = this.model();
    if (model.urlHandle !== '') {
      this.blogpostService.createBlogPost(model).subscribe({
        next: () => {
          this.router.navigateByUrl('/admin/blogposts').then(() => {
            this.viewportScroller.scrollToPosition([0, 0]); // Redirect and scroll up to blog posts admin page on success
          });
        },
      });
    } else {
      this.viewportScroller.scrollToPosition([0, 0]); // Scroll up
      this.urlHandleWarning.set(
        '*Please make sure to at least fill out this field!',
      ); // Warning message to fill out the urlHandleField
    }
  }

  // Keep the preview shaped like the viewport the background will actually fill
  @HostListener('window:resize')
  onWindowResize(): void {
    this.previewAspectRatio.set(this.readViewportAspectRatio());
  }

  // Clear the chosen background picture and the framing that went with it
  onRemoveBackgroundImage(): void {
    this.model.update((model) => ({
      ...model,
      backgroundImageUrl: null,
      backgroundImagePosition: null,
    }));
  }

  private readViewportAspectRatio(): string {
    const width = window.innerWidth;
    const height = window.innerHeight;

    return width && height ? `${width} / ${height}` : '16 / 9';
  }

  // Unsubscribe from the image selector to prevent memory leaks
  ngOnDestroy(): void {
    this.imageSelectorSubscription?.unsubscribe();
  }
}
