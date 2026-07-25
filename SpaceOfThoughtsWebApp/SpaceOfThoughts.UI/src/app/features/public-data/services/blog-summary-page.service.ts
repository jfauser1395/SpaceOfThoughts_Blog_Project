import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { BlogSummaryPage } from '../models/blog-summary-page.model';
import { UpdateBlogSummaryPage } from '../models/update-blog-summary-page.model';

@Injectable({
  providedIn: 'root',
})
export class BlogSummaryPageService {
  constructor(private http: HttpClient) {}

  // Get the public blogs summary page settings
  getBlogSummaryPage(): Observable<BlogSummaryPage> {
    return this.http.get<BlogSummaryPage>(
      `${environment.apiBaseUrl}/api/BlogSummaryPage`,
    );
  }

  // Update the blogs summary page settings for authenticated writers
  updateBlogSummaryPage(
    request: UpdateBlogSummaryPage,
  ): Observable<BlogSummaryPage> {
    return this.http.put<BlogSummaryPage>(
      `${environment.apiBaseUrl}/api/BlogSummaryPage`,
      request,
    );
  }

  // Remove the persisted blogs page settings for authenticated writers
  deleteBlogSummaryPage(): Observable<void> {
    return this.http.delete<void>(
      `${environment.apiBaseUrl}/api/BlogSummaryPage`,
    );
  }

  // Clear only the blogs page's background image reference
  removeBackgroundImage(): Observable<BlogSummaryPage> {
    return this.http.delete<BlogSummaryPage>(
      `${environment.apiBaseUrl}/api/BlogSummaryPage/background-image`,
    );
  }
}
