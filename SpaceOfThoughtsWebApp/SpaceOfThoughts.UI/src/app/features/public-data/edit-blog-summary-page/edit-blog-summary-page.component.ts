import { CommonModule, ViewportScroller } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { ImageSelectorComponent } from '../../blog-post/shared/components/image-selector/image-selector.component';
import { ImageService } from '../../blog-post/shared/components/services/image.service';
import { BlogSummaryPage } from '../models/blog-summary-page.model';
import { BlogSummaryPageService } from '../services/blog-summary-page.service';

@Component({
  selector: 'app-edit-blog-summary-page',
  imports: [CommonModule, FormsModule, RouterModule, ImageSelectorComponent],
  templateUrl: './edit-blog-summary-page.component.html',
  styleUrl: './edit-blog-summary-page.component.css',
})
export class EditBlogSummaryPageComponent implements OnInit, OnDestroy {
  // Editable blogs summary page settings shown in the form and preview
  model?: BlogSummaryPage;
  isSaving = false;
  errorMessage?: string;
  successMessage?: string;
  private readonly defaultBackgroundImageUrl = 'assets/cover-default.png';
  private blogSummaryPageSubscription?: Subscription;
  private imageSelectSubscription?: Subscription;
  private updateBlogSummaryPageSubscription?: Subscription;

  constructor(
    private blogSummaryPageService: BlogSummaryPageService,
    private imageService: ImageService,
    private viewportScroller: ViewportScroller,
  ) {}

  ngOnInit(): void {
    // Load the saved blogs summary page settings
    this.blogSummaryPageSubscription = this.blogSummaryPageService
      .getBlogSummaryPage()
      .subscribe({
        next: (blogSummaryPage) => {
          this.model = blogSummaryPage;
        },
        error: () => {
          this.errorMessage = 'Unable to load the blogs page.';
        },
      });

    // Listen for image selections from the shared image selector modal
    this.imageSelectSubscription = this.imageService.onSelectImage().subscribe({
      next: (selectedImage) => {
        if (this.model && selectedImage.url) {
          this.model.backgroundImageUrl = selectedImage.url;
        }
      },
    });
  }

  // Get the preview background image with the bundled fallback
  get previewBackgroundImageUrl(): string {
    return this.model?.backgroundImageUrl || this.defaultBackgroundImageUrl;
  }

  // Handle form submission to update the blogs summary page settings
  onFormSubmit(): void {
    this.errorMessage = undefined;
    this.successMessage = undefined;
    this.isSaving = true;
    this.updateBlogSummaryPageSubscription?.unsubscribe();

    // Save the optional background image URL to the API
    this.updateBlogSummaryPageSubscription = this.blogSummaryPageService
      .updateBlogSummaryPage({
        backgroundImageUrl: this.model?.backgroundImageUrl?.trim() || null,
      })
      .subscribe({
        next: (blogSummaryPage) => {
          this.model = blogSummaryPage;
          this.successMessage = 'Blogs page updated.';
          this.isSaving = false;
          this.viewportScroller.scrollToPosition([0, 0]);
        },
        error: () => {
          this.errorMessage = 'Unable to update the blogs page.';
          this.isSaving = false;
          this.viewportScroller.scrollToPosition([0, 0]);
        },
      });
  }

  ngOnDestroy(): void {
    // Unsubscribe from subscriptions to prevent memory leaks
    this.blogSummaryPageSubscription?.unsubscribe();
    this.imageSelectSubscription?.unsubscribe();
    this.updateBlogSummaryPageSubscription?.unsubscribe();
  }
}
