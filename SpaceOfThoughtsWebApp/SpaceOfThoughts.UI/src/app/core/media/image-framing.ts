// Placement maths shared by every surface that crops an administrator's picture:
// the cover background, the blog card thumbnails, and the editor previews for
// both. Keeping it in one place is what stops a saved framing being interpreted
// one way in an editor and another way on the public page.
//
// The model mirrors the profile avatar editor: the picture is sized to `zoom%`
// of its frame, cropped with `cover`, panned inside its own box by
// `object-position` / `background-position`, and shifted by a translate that
// reaches the overflow zooming created.
//
// Like the avatar, the picture is rendered larger than its frame. That margin is
// what makes the crop draggable in both directions at every zoom level: a
// picture rendered at exactly 100% fills one axis of its frame precisely and
// cannot be moved along it at all, which reads as a broken control. The overscan
// also keeps the picture from ever being pulled past its own edge, which would
// expose the surface beneath a background or a card.

export interface ImageFraming {
  x: number;
  y: number;
  zoom: number;
}

// A framed picture is drawn one of two ways, and the zoom means something
// different in each:
//
// `cover`   fills the frame completely and crops whatever hangs over. 100% is
//           the smallest size that still covers, so it never goes lower. Cards
//           use this: a grid only reads as a grid if every tile is full.
// `contain` keeps the whole picture inside the frame and lets the frame show
//           through around it. 100% is the whole picture; zooming past that
//           grows it until it fills and then crops. The article banner uses
//           this, so a picture can be shown entire against black.
export type ImageFramingFit = 'cover' | 'contain';

// Below 100% the picture would no longer cover its frame.
export const MINIMUM_IMAGE_ZOOM = 100;
export const MAXIMUM_IMAGE_ZOOM = 250;

// Contained pictures need far more reach: filling a wide frame with a tall
// picture can take three times its fitted size.
export const MAXIMUM_CONTAINED_IMAGE_ZOOM = 400;
export const IMAGE_ZOOM_STEP = 1;

// The largest zoom a fit mode offers.
export function maximumZoomForFit(fit: ImageFramingFit): number {
  return fit === 'contain'
    ? MAXIMUM_CONTAINED_IMAGE_ZOOM
    : MAXIMUM_IMAGE_ZOOM;
}

// How much larger than its frame a picture is rendered. Every surface pays for
// this in picture that is never seen, so it is kept to the least that still
// leaves the crop movable in both directions: 1.1 gives 5% of the frame to pan
// into on every side at minimum zoom.
export const IMAGE_PAN_OVERSCAN = 1.1;

// Centred and unzoomed, matching how existing pictures already render.
export const DEFAULT_IMAGE_FRAMING = '50% 50% 100%';

// Keep a pan percentage inside the frame.
export function clampFramingPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 50;
  }

  return Math.min(100, Math.max(0, value));
}

// Keep zoom inside the range the editors' sliders expose.
export function clampImageZoom(
  value: number,
  fit: ImageFramingFit = 'cover',
): number {
  if (!Number.isFinite(value)) {
    return MINIMUM_IMAGE_ZOOM;
  }

  return Math.min(
    maximumZoomForFit(fit),
    Math.max(MINIMUM_IMAGE_ZOOM, Math.round(value)),
  );
}

// Parse a stored "x% y% zoom%" string, falling back to the centred default. The
// fit has to be passed wherever it is not `cover`, or a contained picture's zoom
// is clamped down to the narrower cover range on the way in.
export function parseImageFraming(
  framing?: string | null,
  fit: ImageFramingFit = 'cover',
): ImageFraming {
  const [xText, yText, zoomText] = (
    framing?.trim() || DEFAULT_IMAGE_FRAMING
  ).split(/\s+/);

  return {
    x: Math.round(clampFramingPercent(parsePercent(xText))),
    y: Math.round(clampFramingPercent(parsePercent(yText))),
    zoom: clampImageZoom(parsePercent(zoomText), fit),
  };
}

// Render the framing back into the string persisted by the API.
export function formatImageFraming(
  framing: ImageFraming,
  fit: ImageFramingFit = 'cover',
): string {
  const x = Math.round(clampFramingPercent(framing.x));
  const y = Math.round(clampFramingPercent(framing.y));
  const zoom = clampImageZoom(framing.zoom, fit);

  return `${x}% ${y}% ${zoom}%`;
}

// Size the picture is actually rendered at, as a percentage of its frame. Every
// surface that draws a framed picture — the editors and the public pages — has
// to use this, or the crop shown while editing stops matching the published one.
export function framingRenderScale(framing: ImageFraming): number {
  return clampImageZoom(framing.zoom) * IMAGE_PAN_OVERSCAN;
}

// Choose which part of the picture fills the frame at the current zoom. Suits
// both `object-position` on an <img> and `background-position` on a layer.
export function buildFramingObjectPosition(framing: ImageFraming): string {
  const x = Math.round(clampFramingPercent(framing.x));
  const y = Math.round(clampFramingPercent(framing.y));

  return `${x}% ${y}%`;
}

// Pan an element its own layout already centres, such as a flex-centred <img>.
export function buildFramingTransform(framing: ImageFraming): string {
  const { offsetX, offsetY } = framingOffsets(framing);

  return `translate(${offsetX.toFixed(2)}%, ${offsetY.toFixed(2)}%)`;
}

// Pan an absolutely positioned layer pinned at its frame's centre point, where
// the -50% that centres the element has to travel in the same transform.
export function buildCenteredFramingTransform(framing: ImageFraming): string {
  const { offsetX, offsetY } = framingOffsets(framing);

  return `translate(${(-50 + offsetX).toFixed(2)}%, ${(-50 + offsetY).toFixed(2)}%)`;
}

// Grow and pan a picture that keeps its own proportions inside the frame. The
// scale is the zoom itself rather than a size in percent of the frame, because a
// contained picture is only ever as big as its own shape allows. There is no
// overscan: at 100% the whole picture is showing, so nothing is hidden to pan to
// and the frame shows through around it.
export function buildContainedFramingTransform(framing: ImageFraming): string {
  const zoom = clampImageZoom(framing.zoom, 'contain');
  const { offsetX, offsetY } = framingOffsets(framing, zoom);

  return `scale(${(zoom / 100).toFixed(4)}) translate(${offsetX.toFixed(2)}%, ${offsetY.toFixed(2)}%)`;
}

// Half of the overflow the render scale created, expressed against the element's
// own size. The overscan keeps this above zero even at minimum zoom, so both
// axes stay draggable.
function framingOffsets(
  framing: ImageFraming,
  renderScale = framingRenderScale(framing),
): {
  offsetX: number;
  offsetY: number;
} {
  const scale = renderScale;
  const x = clampFramingPercent(framing.x);
  const y = clampFramingPercent(framing.y);
  const maximumOffset = ((scale - 100) / (2 * scale)) * 100;

  return {
    offsetX: ((50 - x) / 50) * maximumOffset,
    offsetY: ((50 - y) / 50) * maximumOffset,
  };
}

// Read a percentage that may or may not carry its unit.
function parsePercent(value?: string): number {
  return Number((value ?? '').replace('%', ''));
}
