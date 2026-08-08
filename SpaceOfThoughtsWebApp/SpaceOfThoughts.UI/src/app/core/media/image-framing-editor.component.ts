import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnDestroy,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import {
  DEFAULT_IMAGE_FRAMING,
  IMAGE_ZOOM_STEP,
  ImageFramingFit,
  MINIMUM_IMAGE_ZOOM,
  buildContainedFramingTransform,
  buildFramingObjectPosition,
  buildFramingTransform,
  clampFramingPercent,
  clampImageZoom,
  formatImageFraming,
  framingRenderScale,
  maximumZoomForFit,
  parseImageFraming,
} from './image-framing';

// Drag-and-zoom framing control, matching the profile picture editor's feel.
//
// The component is fully controlled: it never stores the framing itself, it
// derives everything from the `framing` input and emits a new string on every
// change. That removes any possibility of the editor's copy and the saved value
// drifting apart while a form is open.
//
// The frame fills this host, so the page decides its shape — a card preview sets
// a fixed height, a full-page preview sets an aspect ratio.
@Component({
  selector: 'app-image-framing-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="framing-frame"
      [class.is-draggable]="canFrame()"
      [class.is-dragging]="isDragging()"
      [attr.title]="canFrame() ? 'Drag to position picture' : null"
      (pointerdown)="onPointerDown($event)"
    >
      @if (src(); as source) {
        @if (fit() === 'contain') {
          <img
            class="is-contained"
            [src]="source"
            [alt]="alt()"
            [style.transform]="transform()"
            draggable="false"
          />
        } @else {
          <img
            [src]="source"
            [alt]="alt()"
            [style.height.%]="renderScale()"
            [style.object-position]="objectPosition()"
            [style.transform]="transform()"
            [style.width.%]="renderScale()"
            draggable="false"
          />
        }
      } @else {
        <span class="framing-empty">No picture selected</span>
      }
      <ng-content />
    </div>

    <div class="framing-zoom">
      <label [attr.for]="zoomInputId">
        <span>{{ zoomLabel() }}</span>
        <output [attr.for]="zoomInputId">{{ zoom() }}%</output>
      </label>
      <!-- The reset sits on the zoom bar itself: it undoes the same framing the
           slider and the drag build up, so it belongs with them rather than in a
           row of its own. -->
      <div class="framing-zoom-row">
        <div class="framing-zoom-track">
          <input
            [id]="zoomInputId"
            type="range"
            [min]="minimumZoom"
            [max]="maximumZoom()"
            [step]="zoomStep"
            [value]="zoom()"
            [disabled]="!canFrame()"
            (input)="onZoomChange($event)"
          />
          <!-- The low end means different things in the two fits: filling the
               frame for a cropped picture, the whole picture for a contained one -->
          <div class="framing-scale" aria-hidden="true">
            <span>{{ fit() === 'contain' ? 'Whole picture' : 'Fit' }}</span>
            <span>Closer</span>
          </div>
        </div>

        <button
          type="button"
          class="admin-icon-button framing-reset"
          [disabled]="!canFrame() || !isFramed()"
          title="Reset framing"
          aria-label="Reset framing"
          (click)="resetFraming()"
        >
          <i class="bi bi-arrow-counterclockwise" aria-hidden="true"></i>
        </button>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    /* The page decides the frame's shape, because only the page knows what it is
       previewing: a card sets a fixed height, a full-page hero sets a ratio.
       Custom properties cross the encapsulation boundary; a selector would not. */
    .framing-frame {
      align-items: center;
      aspect-ratio: var(--framing-frame-aspect, auto);
      background: var(--media-background);
      border-radius: 8px;
      display: flex;
      height: var(--framing-frame-height, 100%);
      justify-content: center;
      overflow: hidden;
      position: relative;
      touch-action: none;
      user-select: none;
      width: 100%;
    }

    .framing-frame.is-draggable {
      cursor: grab;
    }

    .framing-frame.is-dragging {
      cursor: grabbing;
    }

    /* The host centres the picture, so the transform only has to pan it. */
    .framing-frame img {
      display: block;
      flex: 0 0 auto;
      max-width: none;
      object-fit: cover;
      transition: transform 0.14s ease;
    }

    .framing-frame.is-dragging img {
      transition: none;
    }

    /* Sized by its own shape rather than by the frame, so the frame shows
       through around it exactly as it will once published. */
    .framing-frame img.is-contained {
      max-height: 100%;
      max-width: 100%;
      object-fit: contain;
    }

    .framing-empty {
      color: var(--media-text-muted, inherit);
      font-size: 13px;
    }

    .framing-zoom {
      display: grid;
      gap: 6px;
      margin-top: 12px;
    }

    .framing-zoom label {
      display: flex;
      font-size: 13px;
      font-weight: 650;
      justify-content: space-between;
    }

    .framing-zoom input[type='range'] {
      width: 100%;
    }

    /* The slider keeps its own column so the Fit/Closer scale stays aligned
       under it rather than under the button beside it. */
    .framing-zoom-row {
      align-items: start;
      display: flex;
      gap: 10px;
    }

    .framing-zoom-track {
      flex: 1;
      min-width: 0;
    }

    .framing-scale {
      display: flex;
      font-size: 12px;
      justify-content: space-between;
      opacity: 0.72;
    }

    /* The base look comes from the global .admin-icon-button style, so this
       matches every other icon action on the pages that host it. */
    .framing-reset {
      flex: 0 0 auto;
    }

    .framing-reset:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }

    /* :hover still fires on a disabled button, so the global hover colours have
       to be held back here. */
    .framing-reset:disabled:hover,
    .framing-reset:disabled:focus {
      background: var(--color-surface-muted);
      border-color: var(--color-border);
      color: var(--color-heading);
    }
  `,
})
export class ImageFramingEditorComponent implements OnDestroy {
  readonly src = input<string | null | undefined>(undefined);
  readonly alt = input('');
  readonly framing = input<string | null | undefined>(undefined);
  readonly disabled = input(false);
  readonly zoomLabel = input('Picture zoom');

  // Must match the fit the published surface uses, or this stops being a preview.
  readonly fit = input<ImageFramingFit>('cover');

  // Emits the complete "x% y% zoom%" string whenever the framing changes.
  readonly framingChange = output<string>();

  readonly minimumZoom = MINIMUM_IMAGE_ZOOM;
  readonly maximumZoom = computed(() => maximumZoomForFit(this.fit()));
  readonly zoomStep = IMAGE_ZOOM_STEP;

  // Unique so several editors can appear on one page without clashing label ids
  protected readonly zoomInputId = `image-framing-zoom-${++ImageFramingEditorComponent.instanceCount}`;
  private static instanceCount = 0;

  readonly isDragging = signal(false);

  private readonly placement = computed(() => parseImageFraming(this.framing(), this.fit()));

  // The slider shows the saved zoom; the picture is drawn the way the public
  // surface draws it, so the editor previews what readers see.
  protected readonly zoom = computed(() => this.placement().zoom);
  protected readonly renderScale = computed(() =>
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
  protected readonly canFrame = computed(() => !!this.src() && !this.disabled());
  protected readonly isFramed = computed(
    () =>
      formatImageFraming(this.placement(), this.fit()) !== DEFAULT_IMAGE_FRAMING,
  );

  // Active pointer and incremental drag values used for smooth two-axis movement
  private activePointerId?: number;
  private dragTarget?: HTMLElement;
  private dragLastClientX = 0;
  private dragLastClientY = 0;
  private dragPositionX = 50;
  private dragPositionY = 50;

  onPointerDown(event: PointerEvent): void {
    if (!this.canFrame() || (event.pointerType === 'mouse' && event.button !== 0)) {
      return;
    }

    event.preventDefault();
    const frame = event.currentTarget as HTMLElement;
    this.activePointerId = event.pointerId;
    this.dragTarget = frame;
    this.isDragging.set(true);
    this.dragLastClientX = event.clientX;
    this.dragLastClientY = event.clientY;
    this.dragPositionX = this.placement().x;
    this.dragPositionY = this.placement().y;
    frame.setPointerCapture(event.pointerId);
  }

  // Track movement on the window so a drag is not lost outside the frame
  @HostListener('window:pointermove', ['$event'])
  onPointerMove(event: PointerEvent): void {
    if (!this.isDragging() || event.pointerId !== this.activePointerId) {
      return;
    }

    if (event.cancelable) {
      event.preventDefault();
    }

    this.emitPositionFromDrag(event);
  }

  @HostListener('window:pointerup', ['$event'])
  onPointerUp(event: PointerEvent): void {
    if (!this.isDragging() || event.pointerId !== this.activePointerId) {
      return;
    }

    this.emitPositionFromDrag(event);
    this.finishDrag(event.pointerId);
  }

  // Cancel an interrupted drag without applying an unreliable final position
  @HostListener('window:pointercancel', ['$event'])
  onPointerCancel(event: PointerEvent): void {
    if (event.pointerId === this.activePointerId) {
      this.finishDrag(event.pointerId);
    }
  }

  onZoomChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const current = this.placement();
    this.framingChange.emit(
      formatImageFraming(
        {
          ...current,
          zoom: clampImageZoom(Number(input.value), this.fit()),
        },
        this.fit(),
      ),
    );
  }

  resetFraming(): void {
    this.framingChange.emit(DEFAULT_IMAGE_FRAMING);
  }

  ngOnDestroy(): void {
    this.finishDrag(this.activePointerId);
  }

  // Convert pointer movement into percentage-based framing. Dragging moves the
  // picture with the pointer, so the stored position moves the opposite way.
  private emitPositionFromDrag(event: PointerEvent): void {
    const frame = this.dragTarget;
    if (!frame) {
      return;
    }

    const bounds = frame.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) {
      return;
    }

    const deltaX = ((event.clientX - this.dragLastClientX) / bounds.width) * 100;
    const deltaY =
      ((event.clientY - this.dragLastClientY) / bounds.height) * 100;

    this.dragPositionX = clampFramingPercent(this.dragPositionX - deltaX);
    this.dragPositionY = clampFramingPercent(this.dragPositionY - deltaY);
    this.dragLastClientX = event.clientX;
    this.dragLastClientY = event.clientY;

    this.framingChange.emit(
      formatImageFraming(
        {
          x: this.dragPositionX,
          y: this.dragPositionY,
          zoom: this.placement().zoom,
        },
        this.fit(),
      ),
    );
  }

  // Release pointer capture and clear all state associated with the current drag
  private finishDrag(pointerId?: number): void {
    if (pointerId !== undefined && this.dragTarget?.hasPointerCapture(pointerId)) {
      this.dragTarget.releasePointerCapture(pointerId);
    }

    this.isDragging.set(false);
    this.activePointerId = undefined;
    this.dragTarget = undefined;
  }
}
