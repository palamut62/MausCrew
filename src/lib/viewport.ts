// Keeps the mobile shell above the on-screen keyboard.
//
// `100dvh` already tracks a collapsing URL bar, and the browser keeps it
// correct through rotations and resizes without any help. What it does not
// track is the keyboard: on iOS the layout viewport keeps its full height
// while the keyboard covers the bottom third, which puts the composer under
// the keyboard exactly when you are typing into it.
//
// So this does the narrow thing: it overrides the height ONLY while
// something is covering the viewport, and otherwise leaves --app-height
// unset so CSS owns it. A missed resize event can then leave the app looking
// slightly wrong for a moment, but never stuck at a stale pixel height.

/** Below this, the gap is a collapsing URL bar or a rounding difference —
 * both of which dvh already handles. Soft keyboards are far taller. */
const KEYBOARD_MIN_PX = 120;

/** The height #root should take, or null to fall back to CSS. Split out from
 * the DOM plumbing so the decision is testable. */
export function appHeight(
  visual: { height: number; offsetTop: number } | null | undefined,
  layoutHeight: number,
): string | null {
  if (!visual) return null;
  // offsetTop is non-zero while iOS is pinch-zoomed or mid-scroll-bounce;
  // adding it back measures the window rather than the currently visible
  // slice, which would flicker on every rubber-band scroll.
  const height = visual.height + visual.offsetTop;
  if (!Number.isFinite(height) || height <= 0) return null;
  if (layoutHeight - height < KEYBOARD_MIN_PX) return null;
  return `${Math.round(height)}px`;
}

/** Subscribes #root's height to the visual viewport. No-op off the browser
 * and on browsers without visualViewport, where the CSS fallback stands. */
export function installViewportHeight(): () => void {
  if (typeof window === "undefined") return () => {};
  const visual = window.visualViewport;
  if (!visual) return () => {};

  const apply = () => {
    const height = appHeight(visual, window.innerHeight);
    if (height) document.documentElement.style.setProperty("--app-height", height);
    else document.documentElement.style.removeProperty("--app-height");
  };

  apply();
  visual.addEventListener("resize", apply);
  visual.addEventListener("scroll", apply);
  // The window's own resize matters too: it is the event that fires when the
  // keyboard closes on a browser that resizes the layout viewport with it.
  window.addEventListener("resize", apply);
  window.addEventListener("orientationchange", apply);
  return () => {
    visual.removeEventListener("resize", apply);
    visual.removeEventListener("scroll", apply);
    window.removeEventListener("resize", apply);
    window.removeEventListener("orientationchange", apply);
  };
}
