import { ApplicationRef, Component, OnDestroy, OnInit } from '@angular/core';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterOutlet,
} from '@angular/router';
import { NavbarComponent } from './core/navbar/navbar.component';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { concat, interval, Subscription } from 'rxjs';
import { first } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavbarComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'SpaceOfThoughts';
  isRouteFadingOut = false;
  useRouteFadeFallback = false;

  // Route transition state is kept in the shell so public pages fade consistently
  private readonly routeFadeOutMinimumMs = 280;
  private hasCompletedInitialNavigation = false;
  private routeFadeStartedAt = 0;
  private routeFadeTimeoutId?: number;
  private routeFadeSubscription?: Subscription;

  constructor(
    private readonly appRef: ApplicationRef,
    private readonly swUpdate: SwUpdate,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    // Start public-route transition tracking before initializing background app services
    this.initializeRouteFadeFallback();
    // Kick off PWA update checks as soon as the root component is initialized.
    this.initializeServiceWorkerUpdates();
  }

  // Release router listeners and pending transition timers with the app shell
  ngOnDestroy(): void {
    this.routeFadeSubscription?.unsubscribe();
    this.clearRouteFadeTimer();
  }

  // Listen for public-route navigation and coordinate the shell fade lifecycle
  private initializeRouteFadeFallback(): void {
    this.useRouteFadeFallback = this.isPublicFadeRoute(this.router.url);
    this.hasCompletedInitialNavigation = this.router.navigated;
    this.routeFadeSubscription = this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.useRouteFadeFallback = this.isPublicFadeRoute(event.url);
        this.beginRouteFade(event.url);
        return;
      }

      if (event instanceof NavigationEnd) {
        this.useRouteFadeFallback = this.isPublicFadeRoute(
          event.urlAfterRedirects,
        );
        this.finishRouteFade();
        this.hasCompletedInitialNavigation = true;
        return;
      }

      if (
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        this.useRouteFadeFallback = this.isPublicFadeRoute(this.router.url);
        this.cancelRouteFade();
        this.hasCompletedInitialNavigation = true;
      }
    });
  }

  // Begin fading only when navigation moves between supported public pages
  private beginRouteFade(nextUrl: string): void {
    if (!this.hasCompletedInitialNavigation) {
      this.hasCompletedInitialNavigation = this.router.navigated;
    }

    if (
      !this.hasCompletedInitialNavigation ||
      !this.isPublicFadeRoute(this.router.url) ||
      !this.isPublicFadeRoute(nextUrl)
    ) {
      return;
    }

    this.clearRouteFadeTimer();
    this.routeFadeStartedAt = Date.now();
    this.isRouteFadingOut = true;
  }

  // Keep a short minimum fade before revealing the newly activated route
  private finishRouteFade(): void {
    if (!this.isRouteFadingOut) {
      return;
    }

    const elapsedMs = Date.now() - this.routeFadeStartedAt;
    const remainingMs = Math.max(0, this.routeFadeOutMinimumMs - elapsedMs);

    this.clearRouteFadeTimer();
    this.routeFadeTimeoutId = window.setTimeout(() => {
      this.isRouteFadingOut = false;
    }, remainingMs);
  }

  // Restore the current page immediately when navigation is cancelled or fails
  private cancelRouteFade(): void {
    this.clearRouteFadeTimer();
    this.isRouteFadingOut = false;
  }

  // Clear any pending route reveal before starting another transition
  private clearRouteFadeTimer(): void {
    if (this.routeFadeTimeoutId === undefined) {
      return;
    }

    window.clearTimeout(this.routeFadeTimeoutId);
    this.routeFadeTimeoutId = undefined;
  }

  // Normalize query strings and trailing slashes before checking public routes
  private isPublicFadeRoute(url: string): boolean {
    const path = url.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
    return path === '/' || path === '/blogs' || path === '/about';
  }

  private initializeServiceWorkerUpdates(): void {
    // Guard for local/dev runs (e.g. ng serve) where service workers are disabled.
    if (!this.swUpdate.isEnabled) {
      return;
    }

    // Listen for a freshly downloaded app version and let the user decide when to reload.
    this.swUpdate.versionUpdates.subscribe((event: VersionEvent) => {
      if (event.type === 'VERSION_READY') {
        const shouldReload = window.confirm(
          'A new version of this app is available. Reload now to update?',
        );

        if (shouldReload) {
          void this.swUpdate.activateUpdate().then(() => {
            document.location.reload();
          });
        }
      }
    });

    // Wait until Angular reports the app as stable before scheduling periodic checks.
    const appIsStable$ = this.appRef.isStable.pipe(
      first((isStable) => isStable),
    );
    const everySixHours$ = interval(6 * 60 * 60 * 1000);
    const everySixHoursOnceAppIsStable$ = concat(appIsStable$, everySixHours$);

    everySixHoursOnceAppIsStable$.subscribe(() => {
      // Ask the service worker for a newer version in the background.
      void this.swUpdate.checkForUpdate();
    });
  }
}
