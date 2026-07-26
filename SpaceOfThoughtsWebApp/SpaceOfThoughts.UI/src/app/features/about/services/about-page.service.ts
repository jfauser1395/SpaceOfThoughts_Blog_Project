import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AboutPage } from '../models/about-page.model';
import { UpdateAboutPage } from '../models/update-about-page.model';

@Injectable({
  providedIn: 'root',
})
export class AboutPageService {
  private http = inject(HttpClient);

  // Get the public about page content
  getAboutPage(): Observable<AboutPage> {
    return this.http.get<AboutPage>(`${environment.apiBaseUrl}/api/AboutPage`);
  }

  // Update the about page content for authenticated writers
  updateAboutPage(request: UpdateAboutPage): Observable<AboutPage> {
    return this.http.put<AboutPage>(
      `${environment.apiBaseUrl}/api/AboutPage`,
      request,
    );
  }
}
