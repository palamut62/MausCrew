// iOS does not resize the layout viewport when the software keyboard opens.
// Chrome does, given `interactive-widget=resizes-content` in the viewport
// meta, but Safari ignores that entirely: the page keeps its full height and
// the keyboard is drawn over the bottom of it. In an app whose bottom edge is
// the composer, that means typing blind.
//
// The overlap is published as a CSS variable rather than applied here, so the
// layout decision stays in CSS next to the safe-area inset it stacks with.
// Where the keyboard does resize the viewport the overlap is naturally 0 and
// nothing double-counts.
export function trackKeyboardInset() {
  const viewport = window.visualViewport;
  if (!viewport) return;

  const apply = () => {
    // offsetTop matters: iOS scrolls the visual viewport up to reveal the
    // focused field, and without it the overlap reads as larger than the
    // keyboard actually is.
    const overlap = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
    document.documentElement.style.setProperty("--keyboard-inset", `${Math.round(overlap)}px`);
  };

  apply();
  viewport.addEventListener("resize", apply);
  viewport.addEventListener("scroll", apply);
}
