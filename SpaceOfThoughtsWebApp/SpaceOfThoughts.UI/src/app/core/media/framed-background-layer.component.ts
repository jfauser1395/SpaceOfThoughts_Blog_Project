import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import {
  buildCenteredFramingTransform,
  buildFramingObjectPosition,
  framingRenderScale,
  parseImageFraming,
} from './image-framing';

// One renderer for every viewport-fixed, cover-cropped background. Feature
// components provide only the URL and persisted framing string; this component
// owns the shared size, focal position, centering, and pan/zoom interpretation.
@Component({
  selector: 'app-framed-background-layer',
  template: '',
  styles: `
    /* Height and vertical anchor are expressed in vh rather than in percentages
       of this fixed element's containing block. A phone browser resizes that
       containing block as its address bar collapses on scroll, so a percentage
       height would grow mid-scroll and background-size: cover would visibly
       rescale the picture. vh is defined against the large viewport, which the
       address bar does not change. On desktop, and in the standalone PWA that
       has no address bar at all, this resolves to exactly what % did. */
    :host {
      height: 100vh;
      inset: auto;
      left: 50%;
      pointer-events: none;
      position: fixed;
      top: 50vh;
      width: 100%;
    }
  `,
  host: {
    'aria-hidden': 'true',
    class: 'media-page-background',
    '[style.background-image]': 'backgroundImage()',
    '[style.background-position]': 'objectPosition()',
    '[style.height]': 'renderHeight()',
    '[style.transform]': 'transform()',
    '[style.width.%]': 'renderScale()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FramedBackgroundLayerComponent {
  readonly src = input<string | null | undefined>(undefined);
  readonly framing = input<string | null | undefined>(undefined);

  private readonly placement = computed(() =>
    parseImageFraming(this.framing()),
  );

  protected readonly backgroundImage = computed(() => {
    const source = this.src()?.trim();
    return source ? `url(${source})` : 'none';
  });
  protected readonly objectPosition = computed(() =>
    buildFramingObjectPosition(this.placement()),
  );
  protected readonly renderScale = computed(() =>
    framingRenderScale(this.placement()),
  );

  // The same overscan the width uses, but measured against the large viewport so
  // a collapsing address bar cannot change the picture's size mid-scroll
  protected readonly renderHeight = computed(() => `${this.renderScale()}vh`);
  protected readonly transform = computed(() =>
    buildCenteredFramingTransform(this.placement()),
  );
}
