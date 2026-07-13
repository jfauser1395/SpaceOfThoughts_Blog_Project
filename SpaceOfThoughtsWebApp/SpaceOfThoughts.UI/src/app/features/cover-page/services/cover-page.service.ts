import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, of, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CoverPage } from '../models/cover-page.model';
import { defaultCoverPage } from '../models/default-cover-page';
import { UpdateCoverPage } from '../models/update-cover-page.model';

@Injectable({
  providedIn: 'root',
})
export class CoverPageService {
  constructor(private http: HttpClient) {}

  // Get the public cover page content
  getCoverPage(): Observable<CoverPage> {
    return this.http
      .get<CoverPage>(`${environment.apiBaseUrl}/api/CoverPage`)
      .pipe(
        catchError((error: HttpErrorResponse) =>
          error.status === 404
            ? of({ ...defaultCoverPage, updatedAt: new Date().toISOString() })
            : throwError(() => error),
        ),
      );
  }

  // Update the cover page content for authenticated writers
  updateCoverPage(request: UpdateCoverPage): Observable<CoverPage> {
    return this.http.put<CoverPage>(
      `${environment.apiBaseUrl}/api/CoverPage?addAuth=true`,
      request,
    );
  }
}
