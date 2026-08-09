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
    :host {
      height: 100%;
      inset: auto;
      left: 50%;
      pointer-events: none;
      position: fixed;
      top: 50%;
      width: 100%;
    }
  `,
  host: {
    'aria-hidden': 'true',
    class: 'media-page-background',
    '[style.background-image]': 'backgroundImage()',
    '[style.background-position]': 'objectPosition()',
    '[style.height.%]': 'renderScale()',
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
  protected readonly transform = computed(() =>
    buildCenteredFramingTransform(this.placement()),
  );
}
