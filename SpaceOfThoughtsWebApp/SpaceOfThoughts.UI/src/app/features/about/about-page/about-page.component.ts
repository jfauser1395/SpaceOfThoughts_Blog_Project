import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { LoadingOverlayComponent } from '../../../core/loading-overlay/loading-overlay.component';
import { AboutPage } from '../models/about-page.model';
import { AboutPageService } from '../services/about-page.service';

@Component({
  selector: 'app-about-page',
  imports: [LoadingOverlayComponent],
  templateUrl: './about-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './about-page.component.css',
})
export class AboutPageComponent implements OnInit, OnDestroy {
  private readonly aboutPageService = inject(AboutPageService);

  // Signals keep API and retry state visible to the OnPush public page
  readonly aboutPage = signal<AboutPage | undefined>(undefined);
  readonly isLoading = signal(true); // Flag used by the shared public-page loading overlay
  readonly isNotPublished = signal(false); // Distinguish a missing page from temporary API failures
  private aboutPageSubscription?: Subscription; // Subscription for the current API request
  private aboutPageRetryTimeoutId?: number;

  ngOnInit(): void {
    // Start loading the editable About content when the public route activates
    this.loadAboutPage();
  }

  // Load the public about page content and retry temporary API failures
  private loadAboutPage(): void {
    this.isLoading.set(true);
    this.isNotPublished.set(false);
    this.clearAboutPageRetry();
    this.aboutPageSubscription?.unsubscribe();
    this.aboutPageSubscription = this.aboutPageService
      .getAboutPage()
      .subscribe({
        next: (aboutPage) => {
          this.aboutPage.set(aboutPage);
          this.isLoading.set(false);
        },
        error: (error: HttpErrorResponse) => {
          if (error.status === 404) {
            // A missing record means the administrator has not published the page yet
            this.aboutPage.set(undefined);
            this.isNotPublished.set(true);
            this.isLoading.set(false);
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
