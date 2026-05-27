import { ApplicationRef, Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './core/navbar/navbar.component';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { concat, interval } from 'rxjs';
import { first } from 'rxjs/operators';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet, NavbarComponent],
    templateUrl: './app.component.html',
    styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'SpaceOfThoughts';

  constructor(
    private readonly appRef: ApplicationRef,
    private readonly swUpdate: SwUpdate
  ) {}

  ngOnInit(): void {
    // Kick off PWA update checks as soon as the root component is initialized.
    this.initializeServiceWorkerUpdates();
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
          'A new version of this app is available. Reload now to update?'
        );

        if (shouldReload) {
          void this.swUpdate.activateUpdate().then(() => {
            document.location.reload();
          });
        }
      }
    });

    // Wait until Angular reports the app as stable before scheduling periodic checks.
    const appIsStable$ = this.appRef.isStable.pipe(first((isStable) => isStable));
    const everySixHours$ = interval(6 * 60 * 60 * 1000);
    const everySixHoursOnceAppIsStable$ = concat(appIsStable$, everySixHours$);

    everySixHoursOnceAppIsStable$.subscribe(() => {
      // Ask the service worker for a newer version in the background.
      void this.swUpdate.checkForUpdate();
    });
  }
}
