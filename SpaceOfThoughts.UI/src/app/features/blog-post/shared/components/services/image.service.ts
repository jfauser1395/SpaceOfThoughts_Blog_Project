import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { BlogImage } from '../../models/blog-image.model';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../../../environments/environment';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root', // This service will be provided at the root level
})
export class ImageService {
  // BehaviorSubject to store and emit the selected image
  selectedImage: BehaviorSubject<BlogImage> = new BehaviorSubject<BlogImage>({
    id: '',
    fileExtension: '',
    fileName: '',
    title: '',
    dateCreated: '',
    url: '',
  });

  constructor(private http: HttpClient) {}

  // Get all images with optional sorting
  getAllImages(
    sortBy?: string,
    sortDirection?: string,
  ): Observable<BlogImage[]> {
    let params = new HttpParams();
    if (sortBy) {
      params = params.set('sortBy', sortBy);
    }
    if (sortDirection) {
      params = params.set('sortDirection', sortDirection);
    }
    return this.http.get<BlogImage[]>(`${environment.apiBaseUrl}/api/Images`, {
      params: params,
    });
  }

  // Check if there are no images available
  checkIfImagesEmpty(): Observable<boolean> {
    return this.getAllImages().pipe(map((images) => images.length === 0));
  }

  // Upload a new image
  uploadImage(
    file: File,
    fileName: string,
    title: string,
  ): Observable<BlogImage> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileName', fileName);
    formData.append('title', title);
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
      `${environment.apiBaseUrl}/api/Images/${id}?addAuth=true`,
    );
  }
}
