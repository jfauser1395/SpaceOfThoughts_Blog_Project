import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import {
  ImageFramingFit,
  buildContainedFramingTransform,
  buildFramingObjectPosition,
  buildFramingTransform,
  framingRenderScale,
  parseImageFraming,
} from './image-framing';

// Renders a picture cropped to its container using the framing an administrator
// chose in the editor. Every public card and every editor preview uses this one
// component, so the crop shown while editing is the crop readers get.
@Component({
  selector: 'app-framed-image',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (fit() === 'contain') {
      <!-- The picture keeps its own proportions and the frame shows through
           around it, so the whole picture can be put on show. -->
      <img
        class="is-contained"
        [src]="src()"
        [alt]="alt()"
        [attr.loading]="loading()"
        [attr.fetchpriority]="fetchPriority()"
        decoding="async"
        [style.transform]="transform()"
        draggable="false"
      />
    } @else {
      <img
        [src]="src()"
        [alt]="alt()"
        [attr.loading]="loading()"
        [attr.fetchpriority]="fetchPriority()"
        decoding="async"
        [style.height.%]="renderedScale()"
        [style.object-position]="objectPosition()"
        [style.transform]="transform()"
        [style.width.%]="renderedScale()"
        draggable="false"
      />
    }
  `,
  styles: `
    :host {
      align-items: center;
      background: var(--media-background);
      display: flex;
      justify-content: center;
      overflow: hidden;
    }

    /* The host centres the picture, so the transform only has to pan it. */
    img {
      display: block;
      flex: 0 0 auto;
      max-width: none;
      object-fit: cover;
    }

    /* Sized by its own shape rather than by the frame, so the zoom in the
       transform is all that grows it. */
    img.is-contained {
      max-height: 100%;
      max-width: 100%;
      object-fit: contain;
    }
  `,
})
export class FramedImageComponent {
  readonly src = input.required<string>();
  readonly alt = input('');
  readonly loading = input<'eager' | 'lazy'>('eager');
  readonly fetchPriority = input<'auto' | 'high' | 'low'>('auto');

  // Saved "x% y% zoom%" string; anything unparseable falls back to centred.
  readonly framing = input<string | null | undefined>(undefined);

  // Whether the picture fills the frame and crops, or sits whole inside it.
  readonly fit = input<ImageFramingFit>('cover');

  private readonly placement = computed(() =>
    parseImageFraming(this.framing(), this.fit()),
  );

  // The shared render scale carries the overscan the framing maths pans within,
  // so a published picture is drawn exactly as its editor drew it. It also
  // covers the hairline gaps subpixel rounding used to leave along the edges.
  protected readonly renderedScale = computed(() =>
    framingRenderScale(this.placement()),
  );
  protected readonly objectPosition = computed(() =>
    buildFramingObjectPosition(this.placement()),
  );
  protected readonly transform = computed(() =>
    this.fit() === 'contain'
      ? buildContainedFramingTransform(this.placement())
      : buildFramingTransform(this.placement()),
  );
}
