import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, of, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { BlogSummaryPage } from '../models/blog-summary-page.model';
import { defaultBlogSummaryPage } from '../models/default-blog-summary-page';
import { UpdateBlogSummaryPage } from '../models/update-blog-summary-page.model';

@Injectable({
  providedIn: 'root',
})
export class BlogSummaryPageService {
  constructor(private http: HttpClient) {}

  // Get the public blogs summary page settings
  getBlogSummaryPage(): Observable<BlogSummaryPage> {
    return this.http
      .get<BlogSummaryPage>(`${environment.apiBaseUrl}/api/BlogSummaryPage`)
      .pipe(
        catchError((error: HttpErrorResponse) =>
          error.status === 404
            ? of({
                ...defaultBlogSummaryPage,
                updatedAt: new Date().toISOString(),
              })
            : throwError(() => error),
        ),
      );
  }

  // Update the blogs summary page settings for authenticated writers
  updateBlogSummaryPage(
    request: UpdateBlogSummaryPage,
  ): Observable<BlogSummaryPage> {
    return this.http.put<BlogSummaryPage>(
      `${environment.apiBaseUrl}/api/BlogSummaryPage?addAuth=true`,
      request,
    );
  }
}
