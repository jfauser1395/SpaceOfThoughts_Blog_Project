import { CommonModule, ViewportScroller } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { AboutPage } from '../models/about-page.model';
import { defaultAboutPage } from '../models/default-about-page';
import { AboutPageService } from '../services/about-page.service';
import { ImageSelectorComponent } from '../../blog-post/shared/components/image-selector/image-selector.component';
import { ImageService } from '../../blog-post/shared/components/services/image.service';

@Component({
  selector: 'app-edit-about-page',
  imports: [CommonModule, FormsModule, RouterModule, ImageSelectorComponent],
  templateUrl: './edit-about-page.component.html',
  styleUrl: './edit-about-page.component.css',
})
export class EditAboutPageComponent implements OnInit, OnDestroy {
  // Editable about page model shown in the form and preview
  model?: AboutPage;
  isSaving = false;
  errorMessage?: string;
  successMessage?: string;
  private aboutPageSubscription?: Subscription;
  private imageSelectSubscription?: Subscription;
  private updateAboutPageSubscription?: Subscription;

  constructor(
    private aboutPageService: AboutPageService,
    private imageService: ImageService,
    private viewportScroller: ViewportScroller,
  ) {}

  ngOnInit(): void {
    // Load the saved about page content
    this.aboutPageSubscription = this.aboutPageService
      .getAboutPage()
      .subscribe({
        next: (aboutPage) => {
          this.model = aboutPage;
        },
        error: () => {
          // Fall back to default copy so the writer can still edit and save
          this.model = { ...defaultAboutPage };
          this.errorMessage =
            'Unable to load the saved about page. You can edit the default copy and try saving again.';
        },
      });

    // Listen for image selections from the shared image selector modal
    this.imageSelectSubscription = this.imageService.onSelectImage().subscribe({
      next: (selectedImage) => {
        if (this.model && selectedImage.url) {
          this.model.profileImageUrl = selectedImage.url;
        }
      },
    });
  }

  // Get the fallback initial used in the preview when no profile image is selected
  get previewInitial(): string {
    return this.model?.authorName.trim().charAt(0).toUpperCase() || '?';
  }

  // Handle form submission to update the about page
  onFormSubmit(): void {
    this.errorMessage = undefined;
    this.successMessage = undefined;

    // Check required fields before sending the update request
    if (!this.model || !this.hasRequiredContent(this.model)) {
      this.errorMessage = 'All required about page fields must be filled in.';
      this.viewportScroller.scrollToPosition([0, 0]);
      return;
    }

    this.isSaving = true;
    this.updateAboutPageSubscription?.unsubscribe();

    // Trim editable fields before saving them to the API
    this.updateAboutPageSubscription = this.aboutPageService
      .updateAboutPage({
        authorName: this.model.authorName.trim(),
        authorRole: this.model.authorRole.trim(),
        signatureCaption: this.model.signatureCaption.trim(),
        profileImageUrl: this.model.profileImageUrl?.trim() || null,
        authorIntro: this.model.authorIntro.trim(),
        authorAside: this.model.authorAside.trim(),
        blogOverview: this.model.blogOverview.trim(),
        blogAudience: this.model.blogAudience.trim(),
        blogDifference: this.model.blogDifference.trim(),
        communityIntro: this.model.communityIntro.trim(),
        respectGuideline: this.model.respectGuideline.trim(),
        topicGuideline: this.model.topicGuideline.trim(),
        spamGuideline: this.model.spamGuideline.trim(),
        moderationGuideline: this.model.moderationGuideline.trim(),
        agreementGuideline: this.model.agreementGuideline.trim(),
        consequences: this.model.consequences.trim(),
        contactEmail: this.model.contactEmail.trim(),
      })
      .subscribe({
        next: (aboutPage) => {
          this.model = aboutPage;
          this.successMessage = 'About page updated.';
          this.isSaving = false;
          this.viewportScroller.scrollToPosition([0, 0]);
        },
        error: () => {
          this.errorMessage = 'Unable to update the about page.';
          this.isSaving = false;
          this.viewportScroller.scrollToPosition([0, 0]);
        },
      });
  }

  ngOnDestroy(): void {
    // Unsubscribe from subscriptions to prevent memory leaks
    this.aboutPageSubscription?.unsubscribe();
    this.imageSelectSubscription?.unsubscribe();
    this.updateAboutPageSubscription?.unsubscribe();
  }

  // Check if all required about page content fields contain text
  private hasRequiredContent(model: AboutPage): boolean {
    return [
      model.authorName,
      model.authorRole,
      model.signatureCaption,
      model.authorIntro,
      model.authorAside,
      model.blogOverview,
      model.blogAudience,
      model.blogDifference,
      model.communityIntro,
      model.respectGuideline,
      model.topicGuideline,
      model.spamGuideline,
      model.moderationGuideline,
      model.agreementGuideline,
      model.consequences,
      model.contactEmail,
    ].every((value) => value.trim().length > 0);
  }
}
