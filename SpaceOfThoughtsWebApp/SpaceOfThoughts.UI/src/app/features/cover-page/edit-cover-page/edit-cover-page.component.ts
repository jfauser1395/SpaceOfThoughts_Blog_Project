import { CommonModule, ViewportScroller } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { ImageSelectorComponent } from '../../blog-post/shared/components/image-selector/image-selector.component';
import { ImageService } from '../../blog-post/shared/components/services/image.service';
import { CoverPageService } from '../services/cover-page.service';
import { UpdateCoverPage } from '../models/update-cover-page.model';

@Component({
  selector: 'app-edit-cover-page',
  imports: [CommonModule, FormsModule, RouterModule, ImageSelectorComponent],
  templateUrl: './edit-cover-page.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './edit-cover-page.component.css',
})
export class EditCoverPageComponent implements OnInit, OnDestroy {
  // Editable cover page model shown in the form and preview
  model?: UpdateCoverPage;
  isCreatingNewPage = false;
  isSaving = false;
  isRemoving = false;
  isRemovingImage = false;
  isRemoveConfirmationOpen = false;
  errorMessage?: string;
  successMessage?: string;
  readonly minimumBackgroundOverlayStrength = 0;
  readonly maximumBackgroundOverlayStrength = 100;
  readonly backgroundOverlayStrengthStep = 1;
  private coverPageSubscription?: Subscription;
  private updateCoverPageSubscription?: Subscription;
  private deleteCoverPageSubscription?: Subscription;
  private removeBackgroundImageSubscription?: Subscription;
  private imageSelectSubscription?: Subscription;

  constructor(
    private coverPageService: CoverPageService,
    private imageService: ImageService,
    private viewportScroller: ViewportScroller,
  ) {}

  ngOnInit(): void {
    // Load the saved cover page content
    this.coverPageSubscription = this.coverPageService
      .getCoverPage()
      .subscribe({
        next: (coverPage) => {
          this.model = {
            ...coverPage,
            backgroundOverlayStrength: this.normalizeBackgroundOverlayStrength(
              coverPage.backgroundOverlayStrength,
            ),
          };
          this.isCreatingNewPage = false;
        },
        error: (error: HttpErrorResponse) => {
          if (error.status === 404) {
            // Start with empty fields when no Cover page has been published yet
            this.model = this.createBlankCoverPage();
            this.isCreatingNewPage = true;
            return;
          }

          this.errorMessage = 'Unable to load the cover page.';
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

  // Keep the live preview and saved request inside the supported overlay range
  get previewBackgroundOverlayStrength(): number {
    return this.normalizeBackgroundOverlayStrength(
      this.model?.backgroundOverlayStrength,
    );
  }

  // Convert the percentage into the opacity consumed by the preview scrim
  get previewBackgroundOverlayOpacity(): number {
    return this.previewBackgroundOverlayStrength / 100;
  }

  // Update the draft immediately while the user moves the overlay scale
  onBackgroundOverlayStrengthChange(event: Event): void {
    if (!this.model) {
      return;
    }

    const input = event.target as HTMLInputElement;
    this.model.backgroundOverlayStrength =
      this.normalizeBackgroundOverlayStrength(input.value);
  }

  // Handle form submission to update the cover page
  onFormSubmit(): void {
    if (this.isRemoving || this.isRemovingImage) {
      return;
    }

    this.errorMessage = undefined;
    this.successMessage = undefined;

    // Validate required cover page copy before saving
    if (
      !this.model?.kicker.trim() ||
      !this.model.welcomeTitle.trim() ||
      !this.model.introduction.trim()
    ) {
      this.errorMessage =
        'Cover kicker, welcome title, and introduction are required.';
      this.viewportScroller.scrollToPosition([0, 0]);
      return;
    }

    this.isSaving = true;
    this.updateCoverPageSubscription?.unsubscribe();

    // Trim editable fields before sending them to the API
    this.updateCoverPageSubscription = this.coverPageService
      .updateCoverPage({
        kicker: this.model.kicker.trim(),
        welcomeTitle: this.model.welcomeTitle.trim(),
        introduction: this.model.introduction.trim(),
        backgroundImageUrl: this.model.backgroundImageUrl?.trim() || null,
        backgroundOverlayStrength: this.previewBackgroundOverlayStrength,
      })
      .subscribe({
        next: (coverPage) => {
          this.model = {
            ...coverPage,
            backgroundOverlayStrength: this.normalizeBackgroundOverlayStrength(
              coverPage.backgroundOverlayStrength,
            ),
          };
          this.isCreatingNewPage = false;
          this.isRemoveConfirmationOpen = false;
          this.successMessage = 'Cover page updated.';
          this.isSaving = false;
          this.viewportScroller.scrollToPosition([0, 0]);
        },
        error: () => {
          this.errorMessage = 'Unable to update the cover page.';
          this.isSaving = false;
          this.viewportScroller.scrollToPosition([0, 0]);
        },
      });
  }

  // Show a second confirmation step before removing the published cover page
  openRemoveConfirmation(): void {
    this.errorMessage = undefined;
    this.successMessage = undefined;
    this.isRemoveConfirmationOpen = true;
  }

  // Cancel cover page removal and return to normal editing
  closeRemoveConfirmation(): void {
    if (this.isRemoving) {
      return;
    }

    this.isRemoveConfirmationOpen = false;
  }

  // Remove the persisted page and restore the editor's initial blank draft
  onRemoveCoverPage(): void {
    if (this.isCreatingNewPage || this.isRemoving || this.isRemovingImage) {
      return;
    }

    this.errorMessage = undefined;
    this.successMessage = undefined;
    this.isRemoving = true;
    this.deleteCoverPageSubscription?.unsubscribe();

    this.deleteCoverPageSubscription = this.coverPageService
      .deleteCoverPage()
      .subscribe({
        next: () => {
          this.model = this.createBlankCoverPage();
          this.isCreatingNewPage = true;
          this.isRemoveConfirmationOpen = false;
          this.isRemoving = false;
          this.successMessage = 'Cover page removed. A blank draft is ready.';
          this.viewportScroller.scrollToPosition([0, 0]);
        },
        error: () => {
          this.errorMessage = 'Unable to remove the cover page.';
          this.isRemoving = false;
          this.viewportScroller.scrollToPosition([0, 0]);
        },
      });
  }

  // Remove only the current background reference while keeping the page content
  onRemoveBackgroundImage(): void {
    if (
      !this.model?.backgroundImageUrl ||
      this.isRemovingImage ||
      this.isRemoving
    ) {
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
    this.removeBackgroundImageSubscription = this.coverPageService
      .removeBackgroundImage()
      .subscribe({
        next: () => {
          if (this.model) {
            // Keep any unsaved text edits while clearing the persisted image URL
            this.model.backgroundImageUrl = null;
          }
          this.successMessage = 'Cover picture removed.';
          this.isRemovingImage = false;
        },
        error: () => {
          this.errorMessage = 'Unable to remove the cover picture.';
          this.isRemovingImage = false;
        },
      });
  }

  ngOnDestroy(): void {
    // Unsubscribe from subscriptions to prevent memory leaks
    this.coverPageSubscription?.unsubscribe();
    this.updateCoverPageSubscription?.unsubscribe();
    this.deleteCoverPageSubscription?.unsubscribe();
    this.removeBackgroundImageSubscription?.unsubscribe();
    this.imageSelectSubscription?.unsubscribe();
  }

  // Create a blank draft rather than filling the editor with static welcome copy
  private createBlankCoverPage(): UpdateCoverPage {
    return {
      kicker: '',
      welcomeTitle: '',
      introduction: '',
      backgroundImageUrl: null,
      backgroundOverlayStrength: this.maximumBackgroundOverlayStrength,
    };
  }

  // Convert API and range-input values into a predictable whole percentage
  private normalizeBackgroundOverlayStrength(
    value?: number | string | null,
  ): number {
    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
      return this.maximumBackgroundOverlayStrength;
    }

    return Math.min(
      this.maximumBackgroundOverlayStrength,
      Math.max(this.minimumBackgroundOverlayStrength, Math.round(parsed)),
    );
  }
}
