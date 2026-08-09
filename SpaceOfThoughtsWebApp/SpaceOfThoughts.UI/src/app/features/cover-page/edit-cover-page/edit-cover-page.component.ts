import { ViewportScroller } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  AfterViewInit,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
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
  ImageFraming,
  IMAGE_ZOOM_STEP,
  MAXIMUM_IMAGE_ZOOM,
  MINIMUM_IMAGE_ZOOM,
  buildCenteredFramingTransform,
  buildFramingObjectPosition,
  clampFramingPercent,
  clampImageZoom,
  formatImageFraming,
  framingRenderScale,
  parseImageFraming,
} from '../../../core/media/image-framing';

@Component({
  selector: 'app-edit-cover-page',
  imports: [FormsModule, RouterModule, ImageSelectorComponent],
  templateUrl: './edit-cover-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './edit-cover-page.component.css',
})
export class EditCoverPageComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly coverPageService = inject(CoverPageService);
  private readonly imageService = inject(ImageService);
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
  readonly minimumBackgroundOverlayStrength = 0;
  readonly maximumBackgroundOverlayStrength = 100;
  readonly backgroundOverlayStrengthStep = 1;

  // Framing controls, matching the profile picture editor's zoom and drag model
  readonly minimumBackgroundImageZoom = MINIMUM_IMAGE_ZOOM;
  readonly maximumBackgroundImageZoom = MAXIMUM_IMAGE_ZOOM;
  readonly backgroundImageZoomStep = IMAGE_ZOOM_STEP;
  readonly backgroundImagePositionX = signal(50);
  readonly backgroundImagePositionY = signal(50);
  readonly backgroundImageZoom = signal(MINIMUM_IMAGE_ZOOM);
  readonly isDraggingBackgroundImage = signal(false);

  // The public hero fills the whole viewport, so the preview only tells the truth
  // when it is shaped like the viewport. `background-size: cover` crops purely by
  // container shape, which is why the old fixed 4/5 preview could never match.
  readonly previewAspectRatio = signal(this.readViewportAspectRatio());

  // The preview frame is a scaled-down viewport. The copy inside it is laid out
  // at real viewport size and shrunk by this factor, so every clamp() and vw in
  // the published hero resolves here exactly as it will on the page. Sizing the
  // copy to the small frame directly could never do that: its type would keep a
  // fixed size while the frame changed.
  readonly previewScale = signal(1);
  private readonly previewFrame =
    viewChild<ElementRef<HTMLElement>>('previewFrame');
  private previewFrameObserver?: ResizeObserver;

  // Active pointer and incremental drag values used for smooth two-axis movement
  private activeBackgroundPointerId?: number;
  private backgroundDragTarget?: HTMLElement;
  private dragLastClientX = 0;
  private dragLastClientY = 0;
  private dragPositionX = 50;
  private dragPositionY = 50;

  private updateCoverPageSubscription?: Subscription;
  private deleteCoverPageSubscription?: Subscription;
  private removeBackgroundImageSubscription?: Subscription;

  ngAfterViewInit(): void {
    const frame = this.previewFrame()?.nativeElement;
    if (!frame || typeof ResizeObserver === 'undefined') {
      return;
    }

    this.previewFrameObserver = new ResizeObserver(() =>
      this.updatePreviewScale(),
    );
    this.previewFrameObserver.observe(frame);
    this.destroyRef.onDestroy(() => this.previewFrameObserver?.disconnect());
    this.updatePreviewScale();
  }

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
          this.applyBackgroundImagePosition(coverPage.backgroundImagePosition);
          this.isCreatingNewPage.set(false);
        },
        error: (error: HttpErrorResponse) => {
          if (error.status === 404) {
            // Start with empty fields when no Cover page has been published yet
            this.model.set(this.createBlankCoverPage());
            this.applyBackgroundImagePosition(null);
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
                ? { ...model, backgroundImageUrl: selectedImage.url }
                : model,
            );
            // A different picture frames differently, so start it centred rather
            // than inheriting the previous image's zoom and offset.
            this.applyBackgroundImagePosition(null);
          }
        },
      });
  }

  // Return the selected background URL or no image for a deliberately blank page
  get previewBackgroundImageUrl(): string | null {
    return this.model()?.backgroundImageUrl?.trim() || null;
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

  // Framing may only be adjusted while a picture is actually selected
  get canFrameBackgroundImage(): boolean {
    return (
      !!this.previewBackgroundImageUrl &&
      !this.isRemovingImage() &&
      !this.isRemoving()
    );
  }

  // Transform that centres the preview layer and pans the overflow zoom created
  get backgroundImageTransform(): string {
    return buildCenteredFramingTransform(this.currentBackgroundImagePlacement);
  }

  // Size the preview layer is drawn at. The slider still reports the saved zoom,
  // but the picture carries the same overscan the public cover renders with.
  get backgroundImageRenderScale(): number {
    return framingRenderScale(this.currentBackgroundImagePlacement);
  }

  // Which part of the picture fills the frame at the current zoom
  get backgroundImageObjectPosition(): string {
    return buildFramingObjectPosition(this.currentBackgroundImagePlacement);
  }

  // The exact string persisted with the cover page
  get backgroundImagePositionValue(): string {
    return formatImageFraming(this.currentBackgroundImagePlacement);
  }

  // True once the administrator has moved away from the centred default
  get isBackgroundImageFramed(): boolean {
    return this.backgroundImagePositionValue !== DEFAULT_IMAGE_FRAMING;
  }

  // Start dragging the cover preview
  onBackgroundImagePointerDown(event: PointerEvent): void {
    if (
      !this.canFrameBackgroundImage ||
      (event.pointerType === 'mouse' && event.button !== 0)
    ) {
      return;
    }

    event.preventDefault();
    const frame = event.currentTarget as HTMLElement;
    this.activeBackgroundPointerId = event.pointerId;
    this.backgroundDragTarget = frame;
    this.isDraggingBackgroundImage.set(true);
    this.dragLastClientX = event.clientX;
    this.dragLastClientY = event.clientY;
    this.dragPositionX = this.backgroundImagePositionX();
    this.dragPositionY = this.backgroundImagePositionY();
    frame.setPointerCapture(event.pointerId);
  }

  // Track pointer movement on the window so a drag is not lost outside the frame
  @HostListener('window:pointermove', ['$event'])
  onBackgroundImagePointerMove(event: PointerEvent): void {
    if (
      !this.isDraggingBackgroundImage() ||
      event.pointerId !== this.activeBackgroundPointerId
    ) {
      return;
    }

    if (event.cancelable) {
      event.preventDefault();
    }

    this.updateBackgroundPositionFromDrag(event);
  }

  // Finish dragging the cover preview
  @HostListener('window:pointerup', ['$event'])
  onBackgroundImagePointerUp(event: PointerEvent): void {
    if (
      !this.isDraggingBackgroundImage() ||
      event.pointerId !== this.activeBackgroundPointerId
    ) {
      return;
    }

    this.updateBackgroundPositionFromDrag(event);
    this.finishBackgroundDrag(event.pointerId);
  }

  // Cancel an interrupted drag without applying an unreliable final position
  @HostListener('window:pointercancel', ['$event'])
  onBackgroundImagePointerCancel(event: PointerEvent): void {
    if (event.pointerId === this.activeBackgroundPointerId) {
      this.finishBackgroundDrag(event.pointerId);
    }
  }

  // Keep the preview shaped like the viewport the cover hero will actually fill
  @HostListener('window:resize')
  onWindowResize(): void {
    this.previewAspectRatio.set(this.readViewportAspectRatio());
    this.updatePreviewScale();
  }

  // How much smaller the preview frame is than the screen it stands in for.
  private updatePreviewScale(): void {
    const frameWidth = this.previewFrame()?.nativeElement.clientWidth ?? 0;
    const viewportWidth = window.innerWidth;

    if (frameWidth > 0 && viewportWidth > 0) {
      this.previewScale.set(frameWidth / viewportWidth);
    }
  }

  // Update background zoom from the range input
  onBackgroundImageZoomChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.backgroundImageZoom.set(clampImageZoom(Number(input.value)));
  }

  // Return the picture to its centred, unzoomed framing
  resetBackgroundImageFraming(): void {
    this.applyBackgroundImagePosition(null);
  }

  ngOnDestroy(): void {
    // Release any pointer capture still held by an interrupted drag
    this.finishBackgroundDrag(this.activeBackgroundPointerId);
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
          this.applyBackgroundImagePosition(coverPage.backgroundImagePosition);
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
        model ? { ...model, backgroundImageUrl: null } : model,
      );
      this.applyBackgroundImagePosition(null);
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
            model ? { ...model, backgroundImageUrl: null } : model,
          );
          this.applyBackgroundImagePosition(null);
          this.successMessage.set('Cover picture removed.');
          this.isRemovingImage.set(false);
        },
        error: () => {
          this.errorMessage.set('Unable to remove the cover picture.');
          this.isRemovingImage.set(false);
        },
      });
  }

  // Current framing expressed for the shared placement helpers
  private get currentBackgroundImagePlacement(): ImageFraming {
    return {
      x: this.backgroundImagePositionX(),
      y: this.backgroundImagePositionY(),
      zoom: this.backgroundImageZoom(),
    };
  }

  // Apply a saved framing string, falling back to the centred default
  private applyBackgroundImagePosition(position?: string | null): void {
    const placement = parseImageFraming(position);
    this.backgroundImagePositionX.set(placement.x);
    this.backgroundImagePositionY.set(placement.y);
    this.backgroundImageZoom.set(placement.zoom);
  }

  // Convert pointer movement into percentage-based framing. Dragging moves the
  // picture with the pointer, so the stored position moves the opposite way.
  private updateBackgroundPositionFromDrag(event: PointerEvent): void {
    const frame = this.backgroundDragTarget;
    if (!frame) {
      return;
    }

    const bounds = frame.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) {
      return;
    }

    const deltaX =
      ((event.clientX - this.dragLastClientX) / bounds.width) * 100;
    const deltaY =
      ((event.clientY - this.dragLastClientY) / bounds.height) * 100;

    this.dragPositionX = clampFramingPercent(this.dragPositionX - deltaX);
    this.dragPositionY = clampFramingPercent(this.dragPositionY - deltaY);
    this.backgroundImagePositionX.set(Math.round(this.dragPositionX));
    this.backgroundImagePositionY.set(Math.round(this.dragPositionY));
    this.dragLastClientX = event.clientX;
    this.dragLastClientY = event.clientY;
  }

  // Release pointer capture and clear all state associated with the current drag
  private finishBackgroundDrag(pointerId?: number): void {
    if (
      pointerId !== undefined &&
      this.backgroundDragTarget?.hasPointerCapture(pointerId)
    ) {
      this.backgroundDragTarget.releasePointerCapture(pointerId);
    }

    this.isDraggingBackgroundImage.set(false);
    this.activeBackgroundPointerId = undefined;
    this.backgroundDragTarget = undefined;
  }

  // Shape the preview like the browser viewport the public cover hero will fill
  private readViewportAspectRatio(): string {
    const width = window.innerWidth;
    const height = window.innerHeight;

    if (!width || !height) {
      return '16 / 9';
    }

    return `${width} / ${height}`;
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
