import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormsModule, Validators, ReactiveFormsModule, FormControl } from '@angular/forms';
import { ImageService } from '../services/image.service';
import { Observable, Subscription } from 'rxjs';
import { BlogImage } from '../../models/blog-image.model';

@Component({
  selector: 'app-image-selector',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './image-selector.component.html',
  styleUrls: ['./image-selector.component.css'],
})
export class ImageSelectorComponent implements OnInit, OnDestroy {
  private file?: File; // Variable to hold the uploaded file
  form!: FormGroup; // FormGroup for the image upload form
  fileName: string = ''; // Name of the uploaded file
  title: string = ''; // Title of the uploaded image
  images$?: Observable<BlogImage[]>; // Observable for the list of images
  sortedBy: string; // Field to sort the images by
  sortDirection: string; // Direction of sorting
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
    this.fileName = this.form.get('fileName')?.value;
    this.title = this.form.get('title')?.value;
    if (this.file && this.fileName !== '' && this.title !== '') {
      // Image service to upload the image
      this.imageService
        .uploadImage(this.file, this.fileName, this.title)
        .subscribe({
          next: (response) => {
            this.getImages(); // Get all images again
            this.selectImage(response); // Send image URL to the parent component
            this.form.reset(); // Reset form after upload
          },
        });
    }
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
    );

    // Check if any images are uploaded
    this.imageService.checkIfImagesEmpty().subscribe((isEmpty) => {
      this.noImages = isEmpty;
    });
  }

  // Unsubscribe from the delete uploaded image request to prevent memory leaks
  ngOnDestroy(): void {
    this.deleteUploadedImage$?.unsubscribe();
  }
}
