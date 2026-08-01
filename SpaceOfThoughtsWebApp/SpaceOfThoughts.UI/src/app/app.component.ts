import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './core/navbar/navbar.component';
import { PwaService } from './core/pwa/pwa.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavbarComponent],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './app.component.css',
})
export class AppComponent {
  private readonly pwa = inject(PwaService);

  readonly title = 'SpaceOfThoughts';
  readonly isOnline = this.pwa.isOnline;
  readonly isUpdateAvailable = this.pwa.isUpdateAvailable;
  readonly isUpdateDialogOpen = this.pwa.isUpdateDialogOpen;
  readonly isUpdateRecoveryRequired = this.pwa.isUpdateRecoveryRequired;
  readonly availableVersion = this.pwa.availableVersion;

  // Keep a compact update reminder visible after the full prompt is dismissed
  dismissUpdateDialog(): void {
    this.pwa.dismissUpdateDialog();
  }

  // Reopen the detailed prompt from the persistent update reminder
  openUpdateDialog(): void {
    this.pwa.openUpdateDialog();
  }

  // Reload the complete application so all lazy bundles use the same new version
  reloadApplication(): void {
    this.pwa.reloadApplication();
  }
}
