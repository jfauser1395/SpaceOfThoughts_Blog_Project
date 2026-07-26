import { DOCUMENT } from '@angular/common';
import {
  Component,
  inject,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ChangeDetectionStrategy,
} from '@angular/core';

@Component({
  selector: 'app-loading-overlay',
  templateUrl: './loading-overlay.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './loading-overlay.component.css',
})
export class LoadingOverlayComponent implements OnChanges, OnDestroy {
  // Loading is controlled by the public page that owns the current API request
  @Input({ required: true }) loading = false;

  // The cover page already manages its own full-screen body overflow
  @Input() lockPageScroll = true;

  // Presentation state shared by every page that uses the overlay
  isVisible = false;
  isLeaving = false;
  hasConnectionTimedOut = false;

  // Shared timings keep loader behavior consistent and avoid flashes on quick requests
  private readonly document = inject(DOCUMENT);
  private readonly delayedLoaderMs = 300;
  private readonly connectionTimeoutMs = 15000;
  private readonly loadingTransitionMs = 320;

  // Timer references are retained so navigation and completed requests can clean them up
  private loadingDelayTimeoutId?: ReturnType<typeof setTimeout>;
  private loadingHideTimeoutId?: ReturnType<typeof setTimeout>;
  private connectionTimeoutId?: ReturnType<typeof setTimeout>;

  // Preserve the page's previous overflow value while the overlay locks scrolling
  private previousBodyOverflow = '';
  private isScrollLocked = false;

  // React whenever the owning page starts or finishes loading its required content
  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['loading']) {
      return;
    }

    if (this.loading) {
      this.beginLoading();
      return;
    }

    this.finishLoading();
  }

  // Clear all pending work when route navigation destroys the current page
  ngOnDestroy(): void {
    this.clearLoadingDelayTimer();
    this.clearLoadingHideTimer();
    this.clearConnectionTimer();
    this.unlockPageScroll();
  }

  // Delay the overlay so fast API responses do not produce a distracting flash
  private beginLoading(): void {
    this.clearLoadingHideTimer();
    this.isLeaving = false;
    this.hasConnectionTimedOut = false;
    this.startConnectionTimer();

    if (this.isVisible || this.loadingDelayTimeoutId) {
      return;
    }

    this.loadingDelayTimeoutId = setTimeout(() => {
      this.loadingDelayTimeoutId = undefined;

      if (this.loading) {
        this.isVisible = true;
        this.lockDocumentScroll();
      }
    }, this.delayedLoaderMs);
  }

  // Fade out a visible overlay once the page reports that its content is ready
  private finishLoading(): void {
    this.clearLoadingDelayTimer();
    this.clearConnectionTimer();
    this.hasConnectionTimedOut = false;

    if (!this.isVisible) {
      this.unlockPageScroll();
      return;
    }

    if (this.isLeaving) {
      return;
    }

    this.isLeaving = true;
    this.loadingHideTimeoutId = setTimeout(() => {
      this.isVisible = false;
      this.isLeaving = false;
      this.loadingHideTimeoutId = undefined;
      this.unlockPageScroll();
    }, this.loadingTransitionMs);
  }

  // Replace the normal loading note when a request remains pending for too long
  private startConnectionTimer(): void {
    this.clearConnectionTimer();
    this.connectionTimeoutId = setTimeout(() => {
      if (this.loading) {
        this.hasConnectionTimedOut = true;
      }

      this.connectionTimeoutId = undefined;
    }, this.connectionTimeoutMs);
  }

  // Stop the connection warning timer after loading finishes
  private clearConnectionTimer(): void {
    if (!this.connectionTimeoutId) {
      return;
    }

    clearTimeout(this.connectionTimeoutId);
    this.connectionTimeoutId = undefined;
  }

  // Cancel an overlay that was scheduled but never needed
  private clearLoadingDelayTimer(): void {
    if (!this.loadingDelayTimeoutId) {
      return;
    }

    clearTimeout(this.loadingDelayTimeoutId);
    this.loadingDelayTimeoutId = undefined;
  }

  // Cancel a pending fade completion during navigation or a new loading cycle
  private clearLoadingHideTimer(): void {
    if (!this.loadingHideTimeoutId) {
      return;
    }

    clearTimeout(this.loadingHideTimeoutId);
    this.loadingHideTimeoutId = undefined;
  }

  // Prevent the page behind a visible overlay from scrolling
  private lockDocumentScroll(): void {
    if (!this.lockPageScroll || this.isScrollLocked) {
      return;
    }

    this.previousBodyOverflow = this.document.body.style.overflow;
    this.document.body.style.overflow = 'hidden';
    this.isScrollLocked = true;
  }

  // Restore the overflow value that belonged to the page before loading started
  private unlockPageScroll(): void {
    if (!this.isScrollLocked) {
      return;
    }

    this.document.body.style.overflow = this.previousBodyOverflow;
    this.isScrollLocked = false;
  }
}
