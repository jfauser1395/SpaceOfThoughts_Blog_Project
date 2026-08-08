import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  input,
  signal,
} from '@angular/core';

// A picture cropped into a frame always hides something. This pairs a frame
// with the control that reveals the rest of the picture, and with the full
// screen view that control opens.
//
// Place it inside a positioned wrapper that sits outside the frame's own
// overflow clipping, otherwise the frame clips the trigger away. The full
// screen layer is fixed, so the frame cannot clip that.
@Component({
  selector: 'app-image-fullscreen-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="fullscreen-trigger"
      [attr.aria-label]="label()"
      [attr.title]="label()"
      (click)="open()"
    >
      <i class="bi bi-arrows-fullscreen" aria-hidden="true"></i>
    </button>

    @if (isOpen()) {
      <!-- The contained picture is the whole picture, including whatever the
           frame it was opened from crops away -->
      <div
        class="fullscreen-backdrop"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="label()"
        (click)="close()"
      >
        <button
          type="button"
          class="fullscreen-close"
          aria-label="Close full screen view"
          (click)="close()"
        >
          <i class="bi bi-x-lg" aria-hidden="true"></i>
        </button>

        <img [src]="src()" [alt]="alt()" (click)="$event.stopPropagation()" />
      </div>
    }
  `,
  styles: `
    /* Defaults suit the bottom right corner of a frame; a page that wants the
       trigger elsewhere overrides these on the element. */
    :host {
      bottom: 12px;
      position: absolute;
      right: 12px;
    }

    .fullscreen-trigger {
      align-items: center;
      -webkit-backdrop-filter: blur(4px);
      backdrop-filter: blur(4px);
      background: rgb(0 0 0 / 45%);
      border: 1px solid rgb(255 255 255 / 25%);
      border-radius: 999px;
      color: #fff;
      display: inline-flex;
      font-size: 16px;
      height: 42px;
      justify-content: center;
      transition:
        background-color 0.2s ease,
        transform 0.2s ease;
      width: 42px;
    }

    .fullscreen-trigger:hover,
    .fullscreen-trigger:focus-visible {
      background: rgb(0 0 0 / 70%);
      transform: scale(1.06);
    }

    .fullscreen-trigger:focus-visible {
      outline: 2px solid var(--color-primary-hover);
      outline-offset: 2px;
    }

    .fullscreen-backdrop {
      align-items: center;
      background: rgb(9 8 7 / 92%);
      cursor: zoom-out;
      display: flex;
      inset: 0;
      justify-content: center;
      padding: clamp(1rem, 4vw, 3rem);
      position: fixed;
      z-index: 1100;
    }

    .fullscreen-backdrop img {
      border-radius: 0.5rem;
      box-shadow: 0 1.2rem 3.5rem rgb(0 0 0 / 35%);
      cursor: default;
      max-height: 100%;
      max-width: 100%;
      object-fit: contain;
    }

    .fullscreen-close {
      align-items: center;
      background: rgb(255 255 255 / 12%);
      border: 1px solid rgb(255 255 255 / 18%);
      border-radius: 999px;
      color: #fff;
      display: inline-flex;
      height: 2.75rem;
      justify-content: center;
      position: absolute;
      right: 1.25rem;
      top: 1.25rem;
      width: 2.75rem;
    }

    .fullscreen-close:hover,
    .fullscreen-close:focus-visible {
      background: rgb(255 255 255 / 24%);
    }
  `,
})
export class ImageFullscreenViewComponent {
  readonly src = input.required<string>();
  readonly alt = input('');

  // Names both the trigger and the dialog it opens.
  readonly label = input('View picture full screen');

  readonly isOpen = signal(false);

  open(): void {
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  // Support the conventional Escape-key behavior for the full screen view
  @HostListener('document:keydown.escape')
  closeWithEscape(): void {
    this.close();
  }
}
