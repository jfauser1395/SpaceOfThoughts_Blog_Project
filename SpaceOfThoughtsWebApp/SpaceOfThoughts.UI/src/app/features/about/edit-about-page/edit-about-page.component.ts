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
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { UpdateAboutPage } from '../models/update-about-page.model';
import { AboutPageService } from '../services/about-page.service';
import { ImageSelectorComponent } from '../../blog-post/shared/components/image-selector/image-selector.component';
import { ImageService } from '../../blog-post/shared/components/services/image.service';

@Component({
  selector: 'app-edit-about-page',
  imports: [FormsModule, RouterModule, ImageSelectorComponent],
  templateUrl: './edit-about-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './edit-about-page.component.css',
})
export class EditAboutPageComponent implements OnInit {
  private readonly aboutPageService = inject(AboutPageService);
  private readonly imageService = inject(ImageService);
  private readonly viewportScroller = inject(ViewportScroller);
  private readonly destroyRef = inject(DestroyRef);

  // Signal state keeps API responses and image selections visible with OnPush
  readonly model = signal<UpdateAboutPage | undefined>(undefined);
  readonly isCreatingNewPage = signal(false);
  readonly isSaving = signal(false);
  readonly errorMessage = signal<string | undefined>(undefined);
  readonly successMessage = signal<string | undefined>(undefined);
  private updateAboutPageSubscription?: Subscription;

  ngOnInit(): void {
    // Load the saved about page content
    this.aboutPageService
      .getAboutPage()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (aboutPage) => {
          this.model.set(aboutPage);
          this.isCreatingNewPage.set(false);
        },
        error: (error: HttpErrorResponse) => {
          if (error.status === 404) {
            // A missing record starts a blank draft instead of publishing fallback copy
            this.model.set(this.createBlankAboutPage());
            this.isCreatingNewPage.set(true);
            return;
          }

          this.errorMessage.set('Unable to load the saved about page.');
        },
      });

    // Listen for image selections from the shared image selector modal
    this.imageService
      .onSelectImage()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (selectedImage) => {
          if (selectedImage.url) {
            // Replace the object so the signal notifies the OnPush preview
            this.model.update((model) =>
              model ? { ...model, profileImageUrl: selectedImage.url } : model,
            );
          }
        },
      });
  }

  // Remove the selected picture without deleting it from the shared image library
  removeProfileImage(): void {
    this.model.update((model) =>
      model ? { ...model, profileImageUrl: null } : model,
    );
  }

  // Handle form submission to update the about page
  onFormSubmit(): void {
    this.errorMessage.set(undefined);
    this.successMessage.set(undefined);
    const model = this.model();

    // Check required fields before sending the update request
    if (!model || !this.hasRequiredContent(model)) {
      this.errorMessage.set(
        'All required about page fields must be filled in.',
      );
      this.viewportScroller.scrollToPosition([0, 0]);
      return;
    }

    this.isSaving.set(true);
    this.updateAboutPageSubscription?.unsubscribe();

    // Trim editable fields before saving them to the API
    this.updateAboutPageSubscription = this.aboutPageService
      .updateAboutPage({
        authorName: model.authorName.trim(),
        authorRole: model.authorRole.trim(),
        signatureCaption: model.signatureCaption.trim(),
        profileImageUrl: model.profileImageUrl?.trim() || null,
        authorIntro: model.authorIntro.trim(),
        authorAside: model.authorAside.trim(),
        blogOverview: model.blogOverview.trim(),
        blogAudience: model.blogAudience.trim(),
        blogDifference: model.blogDifference.trim(),
        communityIntro: model.communityIntro.trim(),
        respectGuideline: model.respectGuideline.trim(),
        topicGuideline: model.topicGuideline.trim(),
        spamGuideline: model.spamGuideline.trim(),
        moderationGuideline: model.moderationGuideline.trim(),
        agreementGuideline: model.agreementGuideline.trim(),
        consequences: model.consequences.trim(),
        contactEmail: model.contactEmail.trim(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (aboutPage) => {
          this.model.set(aboutPage);
          this.isCreatingNewPage.set(false);
          this.successMessage.set('About page updated.');
          this.isSaving.set(false);
          this.viewportScroller.scrollToPosition([0, 0]);
        },
        error: () => {
          this.errorMessage.set('Unable to update the about page.');
          this.isSaving.set(false);
          this.viewportScroller.scrollToPosition([0, 0]);
        },
      });
  }

  // Check if all required about page content fields contain text
  private hasRequiredContent(model: UpdateAboutPage): boolean {
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

  // Create an empty editor model when the About page has not been published yet
  private createBlankAboutPage(): UpdateAboutPage {
    return {
      authorName: '',
      authorRole: '',
      signatureCaption: '',
      profileImageUrl: null,
      authorIntro: '',
      authorAside: '',
      blogOverview: '',
      blogAudience: '',
      blogDifference: '',
      communityIntro: '',
      respectGuideline: '',
      topicGuideline: '',
      spamGuideline: '',
      moderationGuideline: '',
      agreementGuideline: '',
      consequences: '',
      contactEmail: '',
    };
  }
}
