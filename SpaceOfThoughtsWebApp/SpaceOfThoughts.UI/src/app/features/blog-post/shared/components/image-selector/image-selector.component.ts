import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ImageService, PublicImageCategory } from '../services/image.service';
import { Observable, Subscription } from 'rxjs';
import { BlogImage } from '../../models/blog-image.model';

@Component({
  selector: 'app-image-selector',
  imports: [FormsModule, ReactiveFormsModule, AsyncPipe],
  templateUrl: './image-selector.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./image-selector.component.css'],
})
export class ImageSelectorComponent implements OnInit, OnDestroy {
  private readonly imageService = inject(ImageService);

  // Route uploads and the visible library to the page-specific public folder
  readonly imageCategory = input<PublicImageCategory>('Blog');

  // Use the existing Bootstrap dismiss control only after a successful upload
  private readonly closeModalButton =
    viewChild<ElementRef<HTMLButtonElement>>('closeModalButton');

  private file?: File; // Variable to hold the uploaded file
  form!: FormGroup; // FormGroup for the image upload form
  readonly uploadError = signal<string | undefined>(undefined); // Explain duplicate or failed uploads without closing the modal
  readonly isUploading = signal(false); // Prevent concurrent submissions of the same form
  images$?: Observable<BlogImage[]>; // Observable for the list of images
  readonly sortedBy = 'DateCreated'; // Field to sort the images by
  readonly sortDirection = 'asc'; // Direction of sorting
  uploadImageSubscription?: Subscription; // Subscription for uploading an image
  deleteUploadedImage$?: Subscription; // Subscription for deleting uploaded images
  readonly noImages = signal<boolean | undefined>(undefined); // Flag to indicate if there are no images

  ngOnInit(): void {
    // Declare and initialize the form group
    this.form = new FormGroup({
      file: new FormControl(null, Validators.required),
      fileName: new FormControl(null, Validators.required),
      title: new FormControl(null, Validators.required),
    });

    // Get all previously saved images
    this.getImages();
  }

  // Map the uploaded file to the file variable on upload change event
  onFileUploadChange(event: Event): void {
    const element = event.currentTarget as HTMLInputElement;
    this.file = element.files?.[0];
  }

  // Upload new file
  uploadImage(): void {
    // Map form values to the appropriate BlogImage values
    this.uploadError.set(undefined);
    const fileName = this.form.get('fileName')?.value;
    const title = this.form.get('title')?.value;
    if (this.file && fileName !== '' && title !== '') {
      this.isUploading.set(true);

      // Image service to upload the image
      this.uploadImageSubscription = this.imageService
        .uploadImage(this.file, fileName, title, this.imageCategory())
        .subscribe({
          next: (response) => {
            this.isUploading.set(false);
            this.getImages(); // Get all images again
            this.selectImage(response); // Send image URL to the parent component
            this.form.reset(); // Reset form after upload
            this.file = undefined;
            this.closeModalButton()?.nativeElement.click();
          },
          error: (error: HttpErrorResponse) => {
            this.isUploading.set(false);
            this.uploadError.set(this.getUploadErrorMessage(error));
          },
        });
    }
  }

  // Prefer the API's filename validation message and keep a safe fallback
  private getUploadErrorMessage(error: HttpErrorResponse): string {
    const validationErrors = error.error?.errors as
      | Record<string, string[]>
      | undefined;
    return (
      validationErrors?.['fileName']?.[0] ??
      error.error?.detail ??
      'The image could not be uploaded. Please try again.'
    );
  }

  // Select an image
  selectImage(image: BlogImage): void {
    this.imageService.selectImage(image);
  }

  // Delete an image
  deleteImage(image: BlogImage): void {
    if (image.id) {
      this.deleteUploadedImage$ = this.imageService
        .deleteUploadedImage(image.id)
        .subscribe({
          next: () => {
            this.getImages(); // Refresh the image list after deletion
          },
        });
    }
  }

  // Get all images
  getImages(): void {
    this.images$ = this.imageService.getAllImages(
      this.sortedBy,
      this.sortDirection,
      this.imageCategory(),
    );

    // Check if any images are uploaded
    this.imageService
      .checkIfImagesEmpty(this.imageCategory())
      .subscribe((isEmpty) => {
        this.noImages.set(isEmpty);
      });
  }

  // Unsubscribe from the delete uploaded image request to prevent memory leaks
  ngOnDestroy(): void {
    this.uploadImageSubscription?.unsubscribe();
    this.deleteUploadedImage$?.unsubscribe();
  }
}
