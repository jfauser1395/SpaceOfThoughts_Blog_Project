import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize, forkJoin, map, of, Subscription, switchMap } from 'rxjs';
import { PrivateImage } from '../models/private-image.model';
import { PrivateMediaService } from '../services/private-media.service';

interface PrivateImageView extends PrivateImage {
  previewUrl: string;
}

@Component({
  selector: 'app-private-media',
  imports: [CommonModule],
  templateUrl: './private-media.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './private-media.component.css',
})
export class PrivateMediaComponent implements OnInit, OnDestroy {
  @ViewChild('fileInput')
  private fileInput?: ElementRef<HTMLInputElement>;

  images: PrivateImageView[] = [];
  selectedImage?: PrivateImageView;
  selectedFile?: File;
  isLoading = true;
  isUploading = false;
  deletingFileName?: string;
  errorMessage?: string;

  private readonly subscriptions = new Subscription();

  constructor(private privateMediaService: PrivateMediaService) {}

  ngOnInit(): void {
    this.loadImages();
  }

  // Remember the selected file while leaving its bytes in the browser file input.
  onFileSelected(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    this.selectedFile = input.files?.[0];
    this.errorMessage = undefined;
  }

  // Upload the chosen photo and refresh the protected gallery.
  uploadImage(): void {
    if (!this.selectedFile || this.isUploading) {
      return;
    }

    this.isUploading = true;
    this.errorMessage = undefined;

    this.subscriptions.add(
      this.privateMediaService
        .uploadImage(this.selectedFile)
        .pipe(finalize(() => (this.isUploading = false)))
        .subscribe({
          next: () => {
            this.selectedFile = undefined;
            if (this.fileInput) {
              this.fileInput.nativeElement.value = '';
            }
            this.loadImages();
          },
          error: (error: HttpErrorResponse) => {
            this.errorMessage = this.getErrorMessage(
              error,
              'The photo could not be uploaded. Please try again.',
            );
          },
        }),
    );
  }

  // Ask for confirmation because deletion removes the only stored copy.
  deleteImage(image: PrivateImageView): void {
    if (
      this.deletingFileName ||
      !window.confirm('Permanently delete this private photo?')
    ) {
      return;
    }

    this.deletingFileName = image.fileName;
    this.errorMessage = undefined;

    this.subscriptions.add(
      this.privateMediaService
        .deleteImage(image.fileName)
        .pipe(finalize(() => (this.deletingFileName = undefined)))
        .subscribe({
          next: () => {
            if (this.selectedImage?.fileName === image.fileName) {
              this.selectedImage = undefined;
            }
            this.loadImages();
          },
          error: (error: HttpErrorResponse) => {
            this.errorMessage = this.getErrorMessage(
              error,
              'The photo could not be deleted. Please try again.',
            );
          },
        }),
    );
  }

  // Open a larger in-page view without navigating to the protected API URL.
  viewImage(image: PrivateImageView): void {
    this.selectedImage = image;
  }

  closeImage(): void {
    this.selectedImage = undefined;
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
    this.subscriptions.unsubscribe();
    this.revokePreviewUrls();
  }

  // Load metadata first, then request every protected photo using authenticated HTTP.
  private loadImages(): void {
    this.isLoading = true;
    this.errorMessage = undefined;

    this.subscriptions.add(
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
          finalize(() => (this.isLoading = false)),
        )
        .subscribe({
          next: (images) => {
            this.selectedImage = undefined;
            this.revokePreviewUrls();
            this.images = images;
          },
          error: (error: HttpErrorResponse) => {
            this.errorMessage = this.getErrorMessage(
              error,
              'The private media library could not be loaded.',
            );
          },
        }),
    );
  }

  private revokePreviewUrls(): void {
    this.images.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    this.images = [];
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
