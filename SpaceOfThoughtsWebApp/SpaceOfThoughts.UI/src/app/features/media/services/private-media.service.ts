import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PrivateImage } from '../models/private-image.model';

@Injectable({
  providedIn: 'root',
})
export class PrivateMediaService {
  private readonly privateImagesUrl = `${environment.apiBaseUrl}/api/Images/private`;

  constructor(private http: HttpClient) {}

  // Return metadata without exposing the server's physical storage path.
  getImages(): Observable<PrivateImage[]> {
    return this.http.get<PrivateImage[]>(this.privateImagesUrl);
  }

  // Store one supported photo in the API's non-public image directory.
  uploadImage(file: File): Observable<PrivateImage> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<PrivateImage>(this.privateImagesUrl, formData);
  }

  // Fetch protected image bytes through HttpClient so credentials are included.
  getImage(fileName: string): Observable<Blob> {
    return this.http.get(
      `${this.privateImagesUrl}/${encodeURIComponent(fileName)}`,
      { responseType: 'blob' },
    );
  }

  // Remove a photo by its API-issued filename.
  deleteImage(fileName: string): Observable<void> {
    return this.http.delete<void>(
      `${this.privateImagesUrl}/${encodeURIComponent(fileName)}`,
    );
  }
}
