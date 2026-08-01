import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  ApplicationRef,
  DestroyRef,
  Injectable,
  InjectionToken,
  PLATFORM_ID,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  SwUpdate,
  VersionEvent,
  VersionReadyEvent,
} from '@angular/service-worker';
import { Observable, concat, fromEvent, interval, merge } from 'rxjs';
import { first, map } from 'rxjs/operators';

const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

// Expose application stability through a token so the delayed update schedule
// can be replaced deterministically in tests.
export const PWA_APP_IS_STABLE = new InjectionToken<Observable<boolean>>(
  'PWA_APP_IS_STABLE',
  {
    providedIn: 'root',
    factory: () => inject(ApplicationRef).isStable,
  },
);

// Resolve Window only in a browser. Returning null keeps this service safe when
// Angular renders the application on the server.
export const PWA_WINDOW = new InjectionToken<Window | null>('PWA_WINDOW', {
  providedIn: 'root',
  factory: () =>
    isPlatformBrowser(inject(PLATFORM_ID))
      ? inject(DOCUMENT).defaultView
      : null,
});

/**
 * Owns browser connectivity and Angular service-worker update state.
 * Components receive readonly signals and cannot mutate lifecycle state directly.
 */
@Injectable({
  providedIn: 'root',
})
export class PwaService {
  private readonly appIsStable$ = inject(PWA_APP_IS_STABLE);
  private readonly destroyRef = inject(DestroyRef);
  private readonly swUpdate = inject(SwUpdate);
  private readonly window = inject(PWA_WINDOW);

  private readonly onlineState = signal(true);
  private readonly updateAvailableState = signal(false);
  private readonly updateDialogOpenState = signal(false);
  private readonly updateRecoveryRequiredState = signal(false);
  private readonly availableVersionState = signal<string | null>(null);
  private applicationIsStable = false;
  private updateCheckInFlight?: Promise<void>;

  readonly isOnline = this.onlineState.asReadonly();
  readonly isUpdateAvailable = this.updateAvailableState.asReadonly();
  readonly isUpdateDialogOpen = this.updateDialogOpenState.asReadonly();
  readonly isUpdateRecoveryRequired =
    this.updateRecoveryRequiredState.asReadonly();
  readonly availableVersion = this.availableVersionState.asReadonly();

  constructor() {
    this.monitorConnectivity();
    this.monitorServiceWorkerUpdates();
  }

  dismissUpdateDialog(): void {
    this.updateDialogOpenState.set(false);
  }

  openUpdateDialog(): void {
    this.updateDialogOpenState.set(true);
  }

  reloadApplication(): void {
    // A complete reload avoids mixing lazy-loaded chunks from different releases.
    this.window?.location.reload();
  }

  private monitorConnectivity(): void {
    const window = this.window;
    if (!window) {
      return;
    }

    this.onlineState.set(window.navigator.onLine);

    merge(
      fromEvent(window, 'online').pipe(map(() => true)),
      fromEvent(window, 'offline').pipe(map(() => false)),
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((isOnline) => {
        this.onlineState.set(isOnline);

        if (isOnline) {
          // A reconnect is a useful opportunity to discover a missed release.
          this.requestUpdateCheck();
        }
      });
  }

  private monitorServiceWorkerUpdates(): void {
    if (!this.swUpdate.isEnabled) {
      return;
    }

    this.swUpdate.versionUpdates
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.handleVersionEvent(event));

    this.swUpdate.unrecoverable
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        // The active cache is incomplete and cannot safely serve the application;
        // keep prompting until the user reloads into a complete version.
        console.error(
          'The current application version is unrecoverable.',
          event.reason,
        );
        this.updateRecoveryRequiredState.set(true);
        this.updateAvailableState.set(true);
        this.updateDialogOpenState.set(true);
      });

    const appIsStable$ = this.appIsStable$.pipe(first((isStable) => isStable));

    // Perform one check when startup work settles, then check every six hours.
    // Waiting for stability prevents update polling from delaying application startup.
    concat(appIsStable$, interval(UPDATE_CHECK_INTERVAL_MS))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.applicationIsStable = true;
        this.requestUpdateCheck();
      });
  }

  private handleVersionEvent(event: VersionEvent): void {
    switch (event.type) {
      case 'VERSION_DETECTED':
      case 'NO_NEW_VERSION_DETECTED':
        return;

      case 'VERSION_READY':
        // Prompt only after Angular has downloaded and validated the full release.
        this.availableVersionState.set(this.readVersionLabel(event));
        this.updateAvailableState.set(true);
        this.updateDialogOpenState.set(true);
        return;

      case 'VERSION_INSTALLATION_FAILED':
        console.error(
          `Application version ${event.version.hash} could not be installed.`,
          event.error,
        );
        return;

      default: {
        // Make newly added Angular VersionEvent variants fail compilation until handled.
        const unhandledEvent: never = event;
        return unhandledEvent;
      }
    }
  }

  private readVersionLabel(event: VersionReadyEvent): string | null {
    const appData = event.latestVersion.appData;
    if (!appData || !('version' in appData)) {
      return null;
    }

    const version = appData['version'];
    return typeof version === 'string' && version.trim().length > 0
      ? version
      : null;
  }

  private requestUpdateCheck(): void {
    // Connectivity events and the timer can occur together. Reuse the active check
    // instead of issuing overlapping requests for the service-worker manifest.
    if (
      !this.swUpdate.isEnabled ||
      !this.applicationIsStable ||
      !this.onlineState() ||
      this.updateCheckInFlight
    ) {
      return;
    }

    const updateCheck = this.swUpdate
      .checkForUpdate()
      .then(() => undefined)
      .catch((error: unknown) => {
        console.error('The application update check failed.', error);
      })
      .finally(() => {
        if (this.updateCheckInFlight === updateCheck) {
          this.updateCheckInFlight = undefined;
        }
      });

    this.updateCheckInFlight = updateCheck;
  }
}
