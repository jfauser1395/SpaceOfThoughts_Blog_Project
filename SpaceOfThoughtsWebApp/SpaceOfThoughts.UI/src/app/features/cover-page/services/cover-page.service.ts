import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { environment } from "../../../../environments/environment";
import { CoverPage } from "../models/cover-page.model";
import { UpdateCoverPage } from "../models/update-cover-page.model";

@Injectable({
  providedIn: "root",
})
export class CoverPageService {
  constructor(private http: HttpClient) {}

  // Get the public cover page content
  getCoverPage(): Observable<CoverPage> {
    return this.http.get<CoverPage>(`${environment.apiBaseUrl}/api/CoverPage`);
  }

  // Update the cover page content for authenticated writers
  updateCoverPage(request: UpdateCoverPage): Observable<CoverPage> {
    return this.http.put<CoverPage>(
      `${environment.apiBaseUrl}/api/CoverPage`,
      request,
    );
  }

  // Remove the currently persisted cover page for authenticated writers
  deleteCoverPage(): Observable<void> {
    return this.http.delete<void>(
      `${environment.apiBaseUrl}/api/CoverPage`,
    );
  }

  // Clear only the cover page's background image reference
  removeBackgroundImage(): Observable<CoverPage> {
    return this.http.delete<CoverPage>(
      `${environment.apiBaseUrl}/api/CoverPage/background-image`,
    );
  }
}
