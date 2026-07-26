import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize, forkJoin, map, of, switchMap } from 'rxjs';
import { PrivateImage } from '../models/private-image.model';
import { PrivateMediaService } from '../services/private-media.service';

interface PrivateImageView extends PrivateImage {
  previewUrl: string;
}

@Component({
  selector: 'app-private-media',
  imports: [DatePipe],
  templateUrl: './private-media.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './private-media.component.css',
})
export class PrivateMediaComponent implements OnInit, OnDestroy {
  private readonly privateMediaService = inject(PrivateMediaService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly fileInput =
    viewChild<ElementRef<HTMLInputElement>>('fileInput');

  // Protected API results and action progress are exposed as OnPush-safe signals
  readonly images = signal<readonly PrivateImageView[]>([]);
  readonly selectedImage = signal<PrivateImageView | undefined>(undefined);
  readonly selectedFile = signal<File | undefined>(undefined);
  readonly isLoading = signal(true);
  readonly isUploading = signal(false);
  readonly deletingFileName = signal<string | undefined>(undefined);
  readonly errorMessage = signal<string | undefined>(undefined);

  ngOnInit(): void {
    this.loadImages();
  }

  // Remember the selected file while leaving its bytes in the browser file input.
  onFileSelected(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    this.selectedFile.set(input.files?.[0]);
    this.errorMessage.set(undefined);
  }

  // Upload the chosen photo and refresh the protected gallery.
  uploadImage(): void {
    const selectedFile = this.selectedFile();
    if (!selectedFile || this.isUploading()) {
      return;
    }

    this.isUploading.set(true);
    this.errorMessage.set(undefined);

    this.privateMediaService
      .uploadImage(selectedFile)
      .pipe(
        finalize(() => this.isUploading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.selectedFile.set(undefined);
          const fileInput = this.fileInput();
          if (fileInput) {
            fileInput.nativeElement.value = '';
          }
          this.loadImages();
        },
        error: (error: HttpErrorResponse) => {
          this.errorMessage.set(
            this.getErrorMessage(
              error,
              'The photo could not be uploaded. Please try again.',
            ),
          );
        },
      });
  }

  // Ask for confirmation because deletion removes the only stored copy.
  deleteImage(image: PrivateImageView): void {
    if (
      this.deletingFileName() ||
      !window.confirm('Permanently delete this private photo?')
    ) {
      return;
    }

    this.deletingFileName.set(image.fileName);
    this.errorMessage.set(undefined);

    this.privateMediaService
      .deleteImage(image.fileName)
      .pipe(
        finalize(() => this.deletingFileName.set(undefined)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          if (this.selectedImage()?.fileName === image.fileName) {
            this.selectedImage.set(undefined);
          }
          this.loadImages();
        },
        error: (error: HttpErrorResponse) => {
          this.errorMessage.set(
            this.getErrorMessage(
              error,
              'The photo could not be deleted. Please try again.',
            ),
          );
        },
      });
  }

  // Open a larger in-page view without navigating to the protected API URL.
  viewImage(image: PrivateImageView): void {
    this.selectedImage.set(image);
  }

  closeImage(): void {
    this.selectedImage.set(undefined);
  }

  // Make file sizes readable in each gallery card.
  formatFileSize(sizeInBytes: number): string {
    if (sizeInBytes < 1024 * 1024) {
      return `${Math.max(1, Math.round(sizeInBytes / 1024))} KB`;
    }

    return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  @HostListener('document:keydown.escape')
  closeImageWithEscape(): void {
    this.closeImage();
  }

  ngOnDestroy(): void {
    // Release browser-generated blob URLs when the protected gallery closes
    this.revokePreviewUrls();
  }

  // Load metadata first, then request every protected photo using authenticated HTTP.
  private loadImages(): void {
    this.isLoading.set(true);
    this.errorMessage.set(undefined);

    this.privateMediaService
      .getImages()
      .pipe(
        switchMap((images) => {
          if (images.length === 0) {
            return of([]);
          }

          return forkJoin(
            images.map((image) =>
              this.privateMediaService.getImage(image.fileName).pipe(
                map((blob) => ({
                  ...image,
                  previewUrl: URL.createObjectURL(blob),
                })),
              ),
            ),
          );
        }),
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (images) => {
          this.selectedImage.set(undefined);
          this.revokePreviewUrls();
          this.images.set(images);
        },
        error: (error: HttpErrorResponse) => {
          this.errorMessage.set(
            this.getErrorMessage(
              error,
              'The private media library could not be loaded.',
            ),
          );
        },
      });
  }

  private revokePreviewUrls(): void {
    this.images().forEach((image) => URL.revokeObjectURL(image.previewUrl));
    this.images.set([]);
  }

  // Prefer API validation details while keeping errors useful for network failures.
  private getErrorMessage(
    error: HttpErrorResponse,
    fallbackMessage: string,
  ): string {
    const validationErrors = error.error?.errors as
      | Record<string, string[]>
      | undefined;

    return (
      validationErrors?.['file']?.[0] ??
      error.error?.detail ??
      (typeof error.error === 'string' ? error.error : fallbackMessage)
    );
  }
}
