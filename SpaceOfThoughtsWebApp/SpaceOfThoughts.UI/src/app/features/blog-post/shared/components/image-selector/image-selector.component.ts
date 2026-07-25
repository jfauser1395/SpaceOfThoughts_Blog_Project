import {
  Component,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
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
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './image-selector.component.html',
  styleUrls: ['./image-selector.component.css'],
})
export class ImageSelectorComponent implements OnInit, OnDestroy {
  // Route uploads and the visible library to the page-specific public folder
  @Input() imageCategory: PublicImageCategory = 'Blog';

  // Use the existing Bootstrap dismiss control only after a successful upload
  @ViewChild('closeModalButton')
  private closeModalButton?: ElementRef<HTMLButtonElement>;

  private file?: File; // Variable to hold the uploaded file
  form!: FormGroup; // FormGroup for the image upload form
  fileName: string = ''; // Name of the uploaded file
  title: string = ''; // Title of the uploaded image
  uploadError?: string; // Explain duplicate or failed uploads without closing the modal
  isUploading = false; // Prevent concurrent submissions of the same form
  images$?: Observable<BlogImage[]>; // Observable for the list of images
  sortedBy: string; // Field to sort the images by
  sortDirection: string; // Direction of sorting
  uploadImageSubscription?: Subscription; // Subscription for uploading an image
  deleteUploadedImage$?: Subscription; // Subscription for deleting uploaded images
  noImages?: boolean; // Flag to indicate if there are no images

  constructor(private imageService: ImageService) {
    this.sortedBy = 'DateCreated'; // Default sorting by date created
    this.sortDirection = 'asc'; // Default sorting direction
  }

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
    this.uploadError = undefined;
    this.fileName = this.form.get('fileName')?.value;
    this.title = this.form.get('title')?.value;
    if (this.file && this.fileName !== '' && this.title !== '') {
      this.isUploading = true;

      // Image service to upload the image
      this.uploadImageSubscription = this.imageService
        .uploadImage(this.file, this.fileName, this.title, this.imageCategory)
        .subscribe({
          next: (response) => {
            this.isUploading = false;
            this.getImages(); // Get all images again
            this.selectImage(response); // Send image URL to the parent component
            this.form.reset(); // Reset form after upload
            this.file = undefined;
            this.closeModalButton?.nativeElement.click();
          },
          error: (error: HttpErrorResponse) => {
            this.isUploading = false;
            this.uploadError = this.getUploadErrorMessage(error);
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
  getImages() {
    this.images$ = this.imageService.getAllImages(
      this.sortedBy,
      this.sortDirection,
      this.imageCategory,
    );

    // Check if any images are uploaded
    this.imageService
      .checkIfImagesEmpty(this.imageCategory)
      .subscribe((isEmpty) => {
        this.noImages = isEmpty;
      });
  }

  // Unsubscribe from the delete uploaded image request to prevent memory leaks
  ngOnDestroy(): void {
    this.uploadImageSubscription?.unsubscribe();
    this.deleteUploadedImage$?.unsubscribe();
  }
}
