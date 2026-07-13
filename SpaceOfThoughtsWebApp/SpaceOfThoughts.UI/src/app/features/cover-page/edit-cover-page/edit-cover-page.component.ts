import { CommonModule, ViewportScroller } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { ImageSelectorComponent } from '../../blog-post/shared/components/image-selector/image-selector.component';
import { ImageService } from '../../blog-post/shared/components/services/image.service';
import { CoverPage } from '../models/cover-page.model';
import { CoverPageService } from '../services/cover-page.service';

@Component({
  selector: 'app-edit-cover-page',
  imports: [CommonModule, FormsModule, RouterModule, ImageSelectorComponent],
  templateUrl: './edit-cover-page.component.html',
  styleUrl: './edit-cover-page.component.css',
})
export class EditCoverPageComponent implements OnInit, OnDestroy {
  // Editable cover page model shown in the form and preview
  model?: CoverPage;
  isSaving = false;
  errorMessage?: string;
  successMessage?: string;
  private readonly defaultBackgroundImageUrl = 'assets/cover-default.png';
  private coverPageSubscription?: Subscription;
  private updateCoverPageSubscription?: Subscription;
  private imageSelectSubscription?: Subscription;

  constructor(
    private coverPageService: CoverPageService,
    private imageService: ImageService,
    private viewportScroller: ViewportScroller,
  ) {}

  ngOnInit(): void {
    // Load the saved cover page content
    this.coverPageSubscription = this.coverPageService.getCoverPage().subscribe({
      next: (coverPage) => {
        this.model = coverPage;
      },
      error: () => {
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

  // Get the preview background image with the bundled fallback
  get previewBackgroundImageUrl(): string {
    return this.model?.backgroundImageUrl || this.defaultBackgroundImageUrl;
  }

  // Handle form submission to update the cover page
  onFormSubmit(): void {
    this.errorMessage = undefined;
    this.successMessage = undefined;

    // Validate required cover page copy before saving
    if (!this.model?.welcomeTitle.trim() || !this.model.introduction.trim()) {
      this.errorMessage = 'Welcome title and introduction are required.';
      this.viewportScroller.scrollToPosition([0, 0]);
      return;
    }

    this.isSaving = true;
    this.updateCoverPageSubscription?.unsubscribe();

    // Trim editable fields before sending them to the API
    this.updateCoverPageSubscription = this.coverPageService
      .updateCoverPage({
        welcomeTitle: this.model.welcomeTitle.trim(),
        introduction: this.model.introduction.trim(),
        backgroundImageUrl: this.model.backgroundImageUrl?.trim() || null,
      })
      .subscribe({
        next: (coverPage) => {
          this.model = coverPage;
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

  ngOnDestroy(): void {
    // Unsubscribe from subscriptions to prevent memory leaks
    this.coverPageSubscription?.unsubscribe();
    this.updateCoverPageSubscription?.unsubscribe();
    this.imageSelectSubscription?.unsubscribe();
  }
}
