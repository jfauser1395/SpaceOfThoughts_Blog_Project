import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { BlogImage } from '../../models/blog-image.model';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../../../environments/environment';
import { map } from 'rxjs/operators';

// Public image categories match the API's dedicated storage directories
export type PublicImageCategory = 'Blog' | 'CoverPage' | 'AboutPage';

@Injectable({
  providedIn: 'root', // This service will be provided at the root level
})
export class ImageService {
  private http = inject(HttpClient);

  // BehaviorSubject to store and emit the selected image
  selectedImage: BehaviorSubject<BlogImage> = new BehaviorSubject<BlogImage>({
    id: '',
    fileExtension: '',
    fileName: '',
    title: '',
    dateCreated: '',
    url: '',
  });

  // Get all images with optional sorting
  getAllImages(
    sortBy?: string,
    sortDirection?: string,
    category?: PublicImageCategory,
  ): Observable<BlogImage[]> {
    let params = new HttpParams();
    if (sortBy) {
      params = params.set('sortBy', sortBy);
    }
    if (sortDirection) {
      params = params.set('sortDirection', sortDirection);
    }
    if (category) {
      params = params.set('category', category);
    }
    return this.http.get<BlogImage[]>(`${environment.apiBaseUrl}/api/Images`, {
      params: params,
    });
  }

  // Check if there are no images available
  checkIfImagesEmpty(category?: PublicImageCategory): Observable<boolean> {
    return this.getAllImages(undefined, undefined, category).pipe(
      map((images) => images.length === 0),
    );
  }

  // Upload a new image
  uploadImage(
    file: File,
    fileName: string,
    title: string,
    category: PublicImageCategory = 'Blog',
  ): Observable<BlogImage> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileName', fileName);
    formData.append('title', title);
    formData.append('category', category);
    return this.http.post<BlogImage>(
      `${environment.apiBaseUrl}/api/Images`,
      formData,
    );
  }

  // Select an image and emit the selected image
  selectImage(image: BlogImage): void {
    this.selectedImage.next(image);
  }

  // Listen for the selected image
  onSelectImage(): Observable<BlogImage> {
    return this.selectedImage.asObservable();
  }

  // Delete an uploaded image by its ID
  deleteUploadedImage(id: string): Observable<BlogImage> {
    return this.http.delete<BlogImage>(
      `${environment.apiBaseUrl}/api/Images/${id}`,
    );
  }
}
