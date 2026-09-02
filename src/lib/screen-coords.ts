// Turning a click on the preview into a click on the real screen.
//
// The preview is a JPEG the box downscales to 1024px wide, drawn with
// `object-contain` into a 16:10 box. Two mappings therefore stack: the
// letterboxed rectangle inside the element, and the ratio between the frame
// and the display it was captured from. Getting either wrong puts the pointer
// somewhere plausible but wrong, which is worse than refusing the click.

export interface Rect {
  width: number;
  height: number;
}

export interface ClickPoint {
  /** Pixels from the element's left/top edge. */
  offsetX: number;
  offsetY: number;
}

/**
 * Screen coordinates for a click, or null when the click landed on the
 * letterbox rather than on the image.
 *
 * @param element the rendered <img> box
 * @param natural the frame's own pixel size (naturalWidth/naturalHeight)
 * @param display the box's real screen size, as reported by the capture
 */
export function screenPoint(
  point: ClickPoint,
  element: Rect,
  natural: Rect,
  display: Rect,
): { x: number; y: number } | null {
  if (!element.width || !element.height || !natural.width || !natural.height) return null;
  if (!display.width || !display.height) return null;

  // object-contain: the image is scaled to fit, and centred in whatever is
  // left over on the other axis.
  const scale = Math.min(element.width / natural.width, element.height / natural.height);
  const drawnWidth = natural.width * scale;
  const drawnHeight = natural.height * scale;
  const offsetLeft = (element.width - drawnWidth) / 2;
  const offsetTop = (element.height - drawnHeight) / 2;

  const withinX = point.offsetX - offsetLeft;
  const withinY = point.offsetY - offsetTop;
  if (withinX < 0 || withinY < 0 || withinX > drawnWidth || withinY > drawnHeight) return null;

  return {
    x: Math.round((withinX / drawnWidth) * display.width),
    y: Math.round((withinY / drawnHeight) * display.height),
  };
}
