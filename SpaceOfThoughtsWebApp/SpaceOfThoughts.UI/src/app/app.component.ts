import {
  ApplicationRef,
  Component,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './core/navbar/navbar.component';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { concat, interval, Subscription } from 'rxjs';
import { first } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavbarComponent],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly appRef = inject(ApplicationRef);
  private readonly swUpdate = inject(SwUpdate);

  readonly title = 'SpaceOfThoughts';

  // Shell signals notify the OnPush root view about service-worker events
  readonly isUpdateAvailable = signal(false);
  readonly isUpdateDialogOpen = signal(false);
  readonly isUpdateRecoveryRequired = signal(false);

  private serviceWorkerUpdateSubscription?: Subscription;
  private unrecoverableStateSubscription?: Subscription;
  private updateCheckSubscription?: Subscription;

  ngOnInit(): void {
    // Kick off PWA update checks as soon as the root component is initialized.
    this.initializeServiceWorkerUpdates();
  }

  // Release background service-worker listeners with the app shell
  ngOnDestroy(): void {
    this.serviceWorkerUpdateSubscription?.unsubscribe();
    this.unrecoverableStateSubscription?.unsubscribe();
    this.updateCheckSubscription?.unsubscribe();
  }

  // Keep a compact update reminder visible after the full prompt is dismissed
  dismissUpdateDialog(): void {
    this.isUpdateDialogOpen.set(false);
  }

  // Reopen the detailed prompt from the persistent update reminder
  openUpdateDialog(): void {
    this.isUpdateDialogOpen.set(true);
  }

  // Reload the complete application so all lazy bundles use the same new version
  reloadApplication(): void {
    document.location.reload();
  }

  private initializeServiceWorkerUpdates(): void {
    // Guard for local/dev runs (e.g. ng serve) where service workers are disabled.
    if (!this.swUpdate.isEnabled) {
      return;
    }

    // Open the themed update dialog after Angular finishes downloading a new version
    this.serviceWorkerUpdateSubscription =
      this.swUpdate.versionUpdates.subscribe((event: VersionEvent) => {
        if (event.type === 'VERSION_READY') {
          this.isUpdateAvailable.set(true);
          this.isUpdateDialogOpen.set(true);
          return;
        }

        if (event.type === 'VERSION_INSTALLATION_FAILED') {
          console.error(
            'The new application version could not be installed.',
            event.error,
          );
        }
      });

    // Ask for a full reload if Angular cannot safely recover the current cached version
    this.unrecoverableStateSubscription = this.swUpdate.unrecoverable.subscribe(
      (event) => {
        console.error(
          'The current application version is unrecoverable.',
          event.reason,
        );
        this.isUpdateRecoveryRequired.set(true);
        this.isUpdateAvailable.set(true);
        this.isUpdateDialogOpen.set(true);
      },
    );

    // Wait until Angular reports the app as stable before scheduling periodic checks.
    const appIsStable$ = this.appRef.isStable.pipe(
      first((isStable) => isStable),
    );
    const everySixHours$ = interval(6 * 60 * 60 * 1000);
    const everySixHoursOnceAppIsStable$ = concat(appIsStable$, everySixHours$);

    this.updateCheckSubscription = everySixHoursOnceAppIsStable$.subscribe(
      () => {
        // Ask the service worker for a newer version in the background.
        void this.swUpdate.checkForUpdate().catch((error: unknown) => {
          console.error('The application update check failed.', error);
        });
      },
    );
  }
}
