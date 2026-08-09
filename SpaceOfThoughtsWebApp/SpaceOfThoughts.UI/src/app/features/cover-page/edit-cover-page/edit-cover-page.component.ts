import { ViewportScroller } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { ImageSelectorComponent } from '../../blog-post/shared/components/image-selector/image-selector.component';
import { ImageService } from '../../blog-post/shared/components/services/image.service';
import { CoverPageService } from '../services/cover-page.service';
import { UpdateCoverPage } from '../models/update-cover-page.model';
import {
  DEFAULT_IMAGE_FRAMING,
  formatImageFraming,
  parseImageFraming,
} from '../../../core/media/image-framing';
import { ImageFramingEditorComponent } from '../../../core/media/image-framing-editor.component';
import { CoverHeroComponent } from '../cover-hero/cover-hero.component';
import { AuthService } from '../../auth/services/auth.service';
import { BlogPost } from '../../blog-post/models/blog-post.model';
import { BlogPostService } from '../../blog-post/services/blog-post.service';

type EditableCoverPageField =
  'kicker' | 'welcomeTitle' | 'introduction' | 'backgroundImageUrl';

@Component({
  selector: 'app-edit-cover-page',
  imports: [
    FormsModule,
    RouterModule,
    ImageSelectorComponent,
    ImageFramingEditorComponent,
    CoverHeroComponent,
  ],
  templateUrl: './edit-cover-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './edit-cover-page.component.css',
})
export class EditCoverPageComponent implements OnInit {
  private readonly coverPageService = inject(CoverPageService);
  private readonly imageService = inject(ImageService);
  private readonly authService = inject(AuthService);
  private readonly blogPostService = inject(BlogPostService);
  private readonly viewportScroller = inject(ViewportScroller);
  private readonly destroyRef = inject(DestroyRef);

  // Signals notify the OnPush editor after API and image-library updates
  readonly model = signal<UpdateCoverPage | undefined>(undefined);
  readonly isCreatingNewPage = signal(false);
  readonly isSaving = signal(false);
  readonly isRemoving = signal(false);
  readonly isRemovingImage = signal(false);
  readonly isRemoveConfirmationOpen = signal(false);
  readonly errorMessage = signal<string | undefined>(undefined);
  readonly successMessage = signal<string | undefined>(undefined);
  readonly currentUser = this.authService.getUser();
  readonly blogPreviewPosts = signal<BlogPost[]>([]);
  readonly blogPreviewTotal = signal(0);
  readonly minimumBackgroundOverlayStrength = 0;
  readonly maximumBackgroundOverlayStrength = 100;
  readonly backgroundOverlayStrengthStep = 1;

  // The shared hero is rendered at the public page's logical viewport dimensions,
  // then the complete scene is uniformly scaled into the editor card.
  readonly previewViewportWidth = signal(Math.max(window.innerWidth, 1));
  readonly previewViewportHeight = signal(Math.max(window.innerHeight, 1));
  readonly previewAspectRatio = computed(
    () => `${this.previewViewportWidth()} / ${this.previewViewportHeight()}`,
  );
  readonly previewScale = signal(1);
  private readonly previewFrame = viewChild<
    ImageFramingEditorComponent,
    ElementRef<HTMLElement>
  >('previewFrame', { read: ElementRef });
  private readonly previewViewportProbe = viewChild<ElementRef<HTMLElement>>(
    'previewViewportProbe',
  );

  // The preview is conditional on the asynchronously loaded model. React to the
  // signal query so scaling is initialized when that DOM node actually appears,
  // rather than only during the earlier AfterViewInit hook.
  private readonly previewGeometryEffect = effect((onCleanup) => {
    const frame = this.previewFrame()?.nativeElement;
    const viewportProbe = this.previewViewportProbe()?.nativeElement;

    this.updatePreviewViewportSize(viewportProbe);
    this.updatePreviewScale(frame);

    if (!frame || typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(() => this.updatePreviewScale(frame));
    observer.observe(frame);
    onCleanup(() => observer.disconnect());
  });

  private updateCoverPageSubscription?: Subscription;
  private deleteCoverPageSubscription?: Subscription;
  private removeBackgroundImageSubscription?: Subscription;

  ngOnInit(): void {
    // Load the saved cover page content
    this.coverPageService
      .getCoverPage()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (coverPage) => {
          this.model.set({
            ...coverPage,
            backgroundOverlayStrength: this.normalizeBackgroundOverlayStrength(
              coverPage.backgroundOverlayStrength,
            ),
          });
          this.isCreatingNewPage.set(false);
        },
        error: (error: HttpErrorResponse) => {
          if (error.status === 404) {
            // Start with empty fields when no Cover page has been published yet
            this.model.set(this.createBlankCoverPage());
            this.isCreatingNewPage.set(true);
            return;
          }

          this.errorMessage.set('Unable to load the cover page.');
        },
      });

    // Listen for image selections from the shared image selector modal
    this.imageService
      .onSelectImage()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (selectedImage) => {
          if (selectedImage.url) {
            // Replace the model so the signal refreshes the live preview
            this.model.update((model) =>
              model
                ? {
                    ...model,
                    backgroundImageUrl: selectedImage.url,
                    backgroundImagePosition: DEFAULT_IMAGE_FRAMING,
                  }
                : model,
            );
          }
        },
      });

    // Use real public cards in the shared hero so its desktop composition and
    // mobile in-flow height match the published page as closely as possible.
    this.blogPostService
      .getAllBlogPosts(undefined, 'publishedDate', 'desc')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blogs) => {
          const visibleBlogs = blogs.filter((blog) => blog.isVisible);
          this.blogPreviewPosts.set(visibleBlogs.slice(0, 3));
          this.blogPreviewTotal.set(visibleBlogs.length);
        },
        error: () => {
          // Previewing the editable cover copy must remain possible if the
          // optional blog-card request is temporarily unavailable.
          this.blogPreviewPosts.set([]);
          this.blogPreviewTotal.set(0);
        },
      });
  }

  // Return the selected background URL or no image for a deliberately blank page
  get previewBackgroundImageUrl(): string | null {
    return this.model()?.backgroundImageUrl?.trim() || null;
  }

  // Replace the draft object on every edit so the OnPush shared hero receives a
  // new page input and refreshes immediately while the administrator is typing.
  onDraftFieldChange<Field extends EditableCoverPageField>(
    field: Field,
    value: UpdateCoverPage[Field],
  ): void {
    this.model.update((model) =>
      model ? { ...model, [field]: value } : model,
    );
  }

  // Keep the live preview and saved request inside the supported overlay range
  get previewBackgroundOverlayStrength(): number {
    return this.normalizeBackgroundOverlayStrength(
      this.model()?.backgroundOverlayStrength,
    );
  }

  // Convert the percentage into the opacity consumed by the preview scrim
  get previewBackgroundOverlayOpacity(): number {
    return this.previewBackgroundOverlayStrength / 100;
  }

  // The exact string persisted with the cover page
  get backgroundImagePositionValue(): string {
    return formatImageFraming(
      parseImageFraming(this.model()?.backgroundImagePosition),
    );
  }

  // The generic media control owns drag, zoom, and reset behavior. This editor
  // only stores its controlled output in the draft consumed by the real hero.
  onBackgroundImageFramingChange(framing: string): void {
    this.model.update((model) =>
      model ? { ...model, backgroundImagePosition: framing } : model,
    );
  }

  // Keep the preview shaped like the viewport the cover hero will actually fill
  @HostListener('window:resize')
  onWindowResize(): void {
    this.updatePreviewViewportSize(this.previewViewportProbe()?.nativeElement);
    this.updatePreviewScale(this.previewFrame()?.nativeElement);
  }

  // How much smaller the editor card is than the logical public viewport.
  private updatePreviewScale(frame?: HTMLElement): void {
    const frameWidth = frame?.clientWidth ?? 0;
    const viewportWidth = this.previewViewportWidth();

    if (frameWidth > 0 && viewportWidth > 0) {
      this.previewScale.set(Math.min(1, frameWidth / viewportWidth));
    }
  }

  // The hidden probe uses the public page's exact svh/vh sizing contract. Its
  // measured box therefore remains accurate on mobile browsers where innerHeight
  // and CSS viewport units can disagree while browser chrome expands or collapses.
  private updatePreviewViewportSize(viewportProbe?: HTMLElement): void {
    const bounds = viewportProbe?.getBoundingClientRect();
    const width = bounds?.width || window.innerWidth;
    const height = bounds?.height || window.innerHeight;

    if (width > 0 && height > 0) {
      this.previewViewportWidth.set(width);
      this.previewViewportHeight.set(height);
    }
  }

  // Update the draft immediately while the user moves the overlay scale
  onBackgroundOverlayStrengthChange(event: Event): void {
    if (!this.model()) {
      return;
    }

    const input = event.target as HTMLInputElement;
    this.model.update((model) =>
      model
        ? {
            ...model,
            backgroundOverlayStrength: this.normalizeBackgroundOverlayStrength(
              input.value,
            ),
          }
        : model,
    );
  }

  // Handle form submission to update the cover page
  onFormSubmit(): void {
    if (this.isRemoving() || this.isRemovingImage()) {
      return;
    }

    this.errorMessage.set(undefined);
    this.successMessage.set(undefined);
    const model = this.model();

    // Validate required cover page copy before saving
    if (
      !model?.kicker.trim() ||
      !model.welcomeTitle.trim() ||
      !model.introduction.trim()
    ) {
      this.errorMessage.set(
        'Cover kicker, welcome title, and introduction are required.',
      );
      this.viewportScroller.scrollToPosition([0, 0]);
      return;
    }

    this.isSaving.set(true);
    this.updateCoverPageSubscription?.unsubscribe();

    // Trim editable fields before sending them to the API
    this.updateCoverPageSubscription = this.coverPageService
      .updateCoverPage({
        kicker: model.kicker.trim(),
        welcomeTitle: model.welcomeTitle.trim(),
        introduction: model.introduction.trim(),
        backgroundImageUrl: model.backgroundImageUrl?.trim() || null,
        // Framing only means something alongside a picture
        backgroundImagePosition: model.backgroundImageUrl?.trim()
          ? this.backgroundImagePositionValue
          : null,
        backgroundOverlayStrength: this.previewBackgroundOverlayStrength,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (coverPage) => {
          this.model.set({
            ...coverPage,
            backgroundOverlayStrength: this.normalizeBackgroundOverlayStrength(
              coverPage.backgroundOverlayStrength,
            ),
          });
          this.isCreatingNewPage.set(false);
          this.isRemoveConfirmationOpen.set(false);
          this.successMessage.set('Cover page updated.');
          this.isSaving.set(false);
          this.viewportScroller.scrollToPosition([0, 0]);
        },
        error: () => {
          this.errorMessage.set('Unable to update the cover page.');
          this.isSaving.set(false);
          this.viewportScroller.scrollToPosition([0, 0]);
        },
      });
  }

  // Show a second confirmation step before removing the published cover page
  openRemoveConfirmation(): void {
    this.errorMessage.set(undefined);
    this.successMessage.set(undefined);
    this.isRemoveConfirmationOpen.set(true);
  }

  // Cancel cover page removal and return to normal editing
  closeRemoveConfirmation(): void {
    if (this.isRemoving()) {
      return;
    }

    this.isRemoveConfirmationOpen.set(false);
  }

  // Remove the persisted page and restore the editor's initial blank draft
  onRemoveCoverPage(): void {
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
    this.deleteCoverPageSubscription?.unsubscribe();

    this.deleteCoverPageSubscription = this.coverPageService
      .deleteCoverPage()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.model.set(this.createBlankCoverPage());
          this.isCreatingNewPage.set(true);
          this.isRemoveConfirmationOpen.set(false);
          this.isRemoving.set(false);
          this.successMessage.set(
            'Cover page removed. A blank draft is ready.',
          );
          this.viewportScroller.scrollToPosition([0, 0]);
        },
        error: () => {
          this.errorMessage.set('Unable to remove the cover page.');
          this.isRemoving.set(false);
          this.viewportScroller.scrollToPosition([0, 0]);
        },
      });
  }

  // Remove only the current background reference while keeping the page content
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
        model
          ? {
              ...model,
              backgroundImageUrl: null,
              backgroundImagePosition: null,
            }
          : model,
      );
      this.successMessage.set('Picture removed from the draft.');
      return;
    }

    this.isRemovingImage.set(true);
    this.removeBackgroundImageSubscription?.unsubscribe();
    this.removeBackgroundImageSubscription = this.coverPageService
      .removeBackgroundImage()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          // Keep any unsaved text edits while clearing the persisted image URL
          this.model.update((model) =>
            model
              ? {
                  ...model,
                  backgroundImageUrl: null,
                  backgroundImagePosition: null,
                }
              : model,
          );
          this.successMessage.set('Cover picture removed.');
          this.isRemovingImage.set(false);
        },
        error: () => {
          this.errorMessage.set('Unable to remove the cover picture.');
          this.isRemovingImage.set(false);
        },
      });
  }

  // Create a blank draft rather than filling the editor with static welcome copy
  private createBlankCoverPage(): UpdateCoverPage {
    return {
      kicker: '',
      welcomeTitle: '',
      introduction: '',
      backgroundImageUrl: null,
      backgroundImagePosition: null,
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
