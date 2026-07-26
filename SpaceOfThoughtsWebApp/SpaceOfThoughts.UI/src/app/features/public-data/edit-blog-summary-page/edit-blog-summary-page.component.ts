import { ViewportScroller } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { ImageSelectorComponent } from '../../blog-post/shared/components/image-selector/image-selector.component';
import { ImageService } from '../../blog-post/shared/components/services/image.service';
import { BlogSummaryPage } from '../models/blog-summary-page.model';
import { BlogSummaryPageService } from '../services/blog-summary-page.service';

@Component({
  selector: 'app-edit-blog-summary-page',
  imports: [FormsModule, RouterModule, ImageSelectorComponent],
  templateUrl: './edit-blog-summary-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './edit-blog-summary-page.component.css',
})
export class EditBlogSummaryPageComponent implements OnInit {
  private readonly blogSummaryPageService = inject(BlogSummaryPageService);
  private readonly imageService = inject(ImageService);
  private readonly viewportScroller = inject(ViewportScroller);
  private readonly destroyRef = inject(DestroyRef);

  // Signals keep API and image-library changes synchronized with the OnPush view
  readonly model = signal<BlogSummaryPage | undefined>(undefined);
  readonly isCreatingNewPage = signal(false);
  readonly isSaving = signal(false);
  readonly isRemoving = signal(false);
  readonly isRemovingImage = signal(false);
  readonly isRemoveConfirmationOpen = signal(false);
  readonly errorMessage = signal<string | undefined>(undefined);
  readonly successMessage = signal<string | undefined>(undefined);
  private updateBlogSummaryPageSubscription?: Subscription;
  private deleteBlogSummaryPageSubscription?: Subscription;
  private removeBackgroundImageSubscription?: Subscription;

  ngOnInit(): void {
    // Load the saved blogs summary page settings
    this.blogSummaryPageService
      .getBlogSummaryPage()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blogSummaryPage) => {
          this.model.set(blogSummaryPage);
          this.isCreatingNewPage.set(false);
        },
        error: (error: HttpErrorResponse) => {
          if (error.status === 404) {
            // Start with a blank draft when no blogs page settings are stored
            this.model.set(this.createBlankBlogSummaryPage());
            this.isCreatingNewPage.set(true);
            return;
          }

          this.errorMessage.set('Unable to load the blogs page.');
        },
      });

    // Listen for image selections from the shared image selector modal
    this.imageService
      .onSelectImage()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (selectedImage) => {
          if (selectedImage.url) {
            // Replace the object so the signal refreshes the preview
            this.model.update((model) =>
              model
                ? { ...model, backgroundImageUrl: selectedImage.url }
                : model,
            );
          }
        },
      });
  }

  // Return the selected background URL or no image for a deliberately blank page
  get previewBackgroundImageUrl(): string | null {
    return this.model()?.backgroundImageUrl?.trim() || null;
  }

  // Handle form submission to update the blogs summary page settings
  onFormSubmit(): void {
    if (this.isRemoving() || this.isRemovingImage()) {
      return;
    }

    this.errorMessage.set(undefined);
    this.successMessage.set(undefined);
    this.isSaving.set(true);
    this.updateBlogSummaryPageSubscription?.unsubscribe();

    // Save the optional background image URL to the API
    this.updateBlogSummaryPageSubscription = this.blogSummaryPageService
      .updateBlogSummaryPage({
        backgroundImageUrl: this.model()?.backgroundImageUrl?.trim() || null,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blogSummaryPage) => {
          this.model.set(blogSummaryPage);
          this.isCreatingNewPage.set(false);
          this.isRemoveConfirmationOpen.set(false);
          this.successMessage.set('Blogs page updated.');
          this.isSaving.set(false);
          this.viewportScroller.scrollToPosition([0, 0]);
        },
        error: () => {
          this.errorMessage.set('Unable to update the blogs page.');
          this.isSaving.set(false);
          this.viewportScroller.scrollToPosition([0, 0]);
        },
      });
  }

  // Show a second confirmation step before removing the blogs page settings
  openRemoveConfirmation(): void {
    this.errorMessage.set(undefined);
    this.successMessage.set(undefined);
    this.isRemoveConfirmationOpen.set(true);
  }

  // Cancel blogs page removal and return to normal editing
  closeRemoveConfirmation(): void {
    if (this.isRemoving()) {
      return;
    }

    this.isRemoveConfirmationOpen.set(false);
  }

  // Remove page-level settings and restore the editor's initial blank draft
  onRemoveBlogSummaryPage(): void {
    if (
      this.isCreatingNewPage() ||
      this.isRemoving() ||
      this.isRemovingImage()
    ) {
      return;
    }

    this.errorMessage.set(undefined);
    this.successMessage.set(undefined);
    this.isRemoving.set(true);
    this.deleteBlogSummaryPageSubscription?.unsubscribe();

    this.deleteBlogSummaryPageSubscription = this.blogSummaryPageService
      .deleteBlogSummaryPage()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.model.set(this.createBlankBlogSummaryPage());
          this.isCreatingNewPage.set(true);
          this.isRemoveConfirmationOpen.set(false);
          this.isRemoving.set(false);
          this.successMessage.set(
            'Blogs page settings removed. A blank draft is ready.',
          );
          this.viewportScroller.scrollToPosition([0, 0]);
        },
        error: () => {
          this.errorMessage.set('Unable to remove the blogs page settings.');
          this.isRemoving.set(false);
          this.viewportScroller.scrollToPosition([0, 0]);
        },
      });
  }

  // Remove only the current background reference while preserving the blogs page
  onRemoveBackgroundImage(): void {
    if (
      !this.model()?.backgroundImageUrl ||
      this.isRemovingImage() ||
      this.isRemoving()
    ) {
      return;
    }

    this.errorMessage.set(undefined);
    this.successMessage.set(undefined);

    if (this.isCreatingNewPage()) {
      // A new draft has no persisted image reference to remove from the API
      this.model.update((model) =>
        model ? { ...model, backgroundImageUrl: null } : model,
      );
      this.successMessage.set('Picture removed from the draft.');
      return;
    }

    this.isRemovingImage.set(true);
    this.removeBackgroundImageSubscription?.unsubscribe();
    this.removeBackgroundImageSubscription = this.blogSummaryPageService
      .removeBackgroundImage()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.model.update((model) =>
            model ? { ...model, backgroundImageUrl: null } : model,
          );
          this.successMessage.set('Blogs page picture removed.');
          this.isRemovingImage.set(false);
        },
        error: () => {
          this.errorMessage.set('Unable to remove the blogs page picture.');
          this.isRemovingImage.set(false);
        },
      });
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
