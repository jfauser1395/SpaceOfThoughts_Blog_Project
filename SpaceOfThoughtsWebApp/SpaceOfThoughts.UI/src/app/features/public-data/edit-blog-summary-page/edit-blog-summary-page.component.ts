import { CommonModule, ViewportScroller } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
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
  isCreatingNewPage = false;
  isSaving = false;
  isRemoving = false;
  isRemovingImage = false;
  isRemoveConfirmationOpen = false;
  errorMessage?: string;
  successMessage?: string;
  private blogSummaryPageSubscription?: Subscription;
  private imageSelectSubscription?: Subscription;
  private updateBlogSummaryPageSubscription?: Subscription;
  private deleteBlogSummaryPageSubscription?: Subscription;
  private removeBackgroundImageSubscription?: Subscription;

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
          this.isCreatingNewPage = false;
        },
        error: (error: HttpErrorResponse) => {
          if (error.status === 404) {
            // Start with a blank draft when no blogs page settings are stored
            this.model = this.createBlankBlogSummaryPage();
            this.isCreatingNewPage = true;
            return;
          }

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

  // Return the selected background URL or no image for a deliberately blank page
  get previewBackgroundImageUrl(): string | null {
    return this.model?.backgroundImageUrl?.trim() || null;
  }

  // Handle form submission to update the blogs summary page settings
  onFormSubmit(): void {
    if (this.isRemoving || this.isRemovingImage) {
      return;
    }

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
          this.isCreatingNewPage = false;
          this.isRemoveConfirmationOpen = false;
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

  // Show a second confirmation step before removing the blogs page settings
  openRemoveConfirmation(): void {
    this.errorMessage = undefined;
    this.successMessage = undefined;
    this.isRemoveConfirmationOpen = true;
  }

  // Cancel blogs page removal and return to normal editing
  closeRemoveConfirmation(): void {
    if (this.isRemoving) {
      return;
    }

    this.isRemoveConfirmationOpen = false;
  }

  // Remove page-level settings and restore the editor's initial blank draft
  onRemoveBlogSummaryPage(): void {
    if (this.isCreatingNewPage || this.isRemoving || this.isRemovingImage) {
      return;
    }

    this.errorMessage = undefined;
    this.successMessage = undefined;
    this.isRemoving = true;
    this.deleteBlogSummaryPageSubscription?.unsubscribe();

    this.deleteBlogSummaryPageSubscription = this.blogSummaryPageService
      .deleteBlogSummaryPage()
      .subscribe({
        next: () => {
          this.model = this.createBlankBlogSummaryPage();
          this.isCreatingNewPage = true;
          this.isRemoveConfirmationOpen = false;
          this.isRemoving = false;
          this.successMessage = 'Blogs page settings removed. A blank draft is ready.';
          this.viewportScroller.scrollToPosition([0, 0]);
        },
        error: () => {
          this.errorMessage = 'Unable to remove the blogs page settings.';
          this.isRemoving = false;
          this.viewportScroller.scrollToPosition([0, 0]);
        },
      });
  }

  // Remove only the current background reference while preserving the blogs page
  onRemoveBackgroundImage(): void {
    if (!this.model?.backgroundImageUrl || this.isRemovingImage || this.isRemoving) {
      return;
    }

    this.errorMessage = undefined;
    this.successMessage = undefined;

    if (this.isCreatingNewPage) {
      // A new draft has no persisted image reference to remove from the API
      this.model.backgroundImageUrl = null;
      this.successMessage = 'Picture removed from the draft.';
      return;
    }

    this.isRemovingImage = true;
    this.removeBackgroundImageSubscription?.unsubscribe();
    this.removeBackgroundImageSubscription = this.blogSummaryPageService
      .removeBackgroundImage()
      .subscribe({
        next: () => {
          if (this.model) {
            this.model.backgroundImageUrl = null;
          }
          this.successMessage = 'Blogs page picture removed.';
          this.isRemovingImage = false;
        },
        error: () => {
          this.errorMessage = 'Unable to remove the blogs page picture.';
          this.isRemovingImage = false;
        },
      });
  }

  ngOnDestroy(): void {
    // Unsubscribe from subscriptions to prevent memory leaks
    this.blogSummaryPageSubscription?.unsubscribe();
    this.imageSelectSubscription?.unsubscribe();
    this.updateBlogSummaryPageSubscription?.unsubscribe();
    this.deleteBlogSummaryPageSubscription?.unsubscribe();
    this.removeBackgroundImageSubscription?.unsubscribe();
  }

  // Create the empty editor state used before any blogs page settings are saved
  private createBlankBlogSummaryPage(): BlogSummaryPage {
    return {
      id: '',
      backgroundImageUrl: null,
      updatedAt: new Date().toISOString(),
    };
  }
}
