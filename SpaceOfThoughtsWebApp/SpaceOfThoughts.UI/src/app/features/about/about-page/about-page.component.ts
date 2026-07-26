import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { LoadingOverlayComponent } from '../../../core/loading-overlay/loading-overlay.component';
import { AboutPage } from '../models/about-page.model';
import { AboutPageService } from '../services/about-page.service';

@Component({
  selector: 'app-about-page',
  imports: [CommonModule, LoadingOverlayComponent],
  templateUrl: './about-page.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './about-page.component.css',
})
export class AboutPageComponent implements OnInit, OnDestroy {
  // Current about page content displayed in the template
  aboutPage?: AboutPage;
  isLoading = true; // Flag used by the shared public-page loading overlay
  isNotPublished = false; // Distinguish a missing page from temporary API failures
  private aboutPageSubscription?: Subscription; // Subscription for the current API request
  private aboutPageRetryTimeoutId?: number; // Timer for retrying temporary API failures

  constructor(private aboutPageService: AboutPageService) {}

  ngOnInit(): void {
    // Start loading the editable About content when the public route activates
    this.loadAboutPage();
  }

  // Load the public about page content and retry temporary API failures
  private loadAboutPage(): void {
    this.isLoading = true;
    this.isNotPublished = false;
    this.clearAboutPageRetry();
    this.aboutPageSubscription?.unsubscribe();
    this.aboutPageSubscription = this.aboutPageService
      .getAboutPage()
      .subscribe({
        next: (aboutPage) => {
          this.aboutPage = aboutPage;
          this.isLoading = false;
        },
        error: (error: HttpErrorResponse) => {
          if (error.status === 404) {
            // A missing record means the administrator has not published the page yet
            this.aboutPage = undefined;
            this.isNotPublished = true;
            this.isLoading = false;
            return;
          }

          this.aboutPageRetryTimeoutId = window.setTimeout(() => {
            this.loadAboutPage();
          }, 2500);
        },
      });
  }

  ngOnDestroy(): void {
    // Unsubscribe from the about page request to prevent memory leaks
    this.aboutPageSubscription?.unsubscribe();
    this.clearAboutPageRetry();
  }

  // Clear any pending retry when the request restarts or the route is destroyed
  private clearAboutPageRetry(): void {
    if (this.aboutPageRetryTimeoutId) {
      window.clearTimeout(this.aboutPageRetryTimeoutId);
      this.aboutPageRetryTimeoutId = undefined;
    }
  }
}
