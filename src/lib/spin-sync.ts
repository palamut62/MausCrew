// Synchronised spinners.
//
// A CSS animation starts when its element mounts, so two spinners that appear a
// third of a second apart rotate a third of a turn apart forever. One spinner
// on screen: nobody notices. Five activity chips down a transcript: five little
// clocks all telling different times, and the eye reads it as jitter.
//
// The fix is one line of arithmetic. Every spinner shares a duration, and each
// one starts with a negative delay equal to however far into the current cycle
// the app already is — so a spinner mounted at any moment is dealt straight
// into the phase everything else is already on.

export const SPIN_DURATION_MS = 1000;

/**
 * The `animation-delay` a spinner mounting *now* needs in order to line up with
 * every spinner already turning. Always negative or zero: a negative delay
 * means "this animation is already that far along", which is exactly the
 * catch-up being asked for.
 */
export function spinDelayMs(
  now = typeof performance === "undefined" ? 0 : performance.now(),
): number {
  const into = ((now % SPIN_DURATION_MS) + SPIN_DURATION_MS) % SPIN_DURATION_MS;
  return -into;
}

/** Ready to hand to `style={{ animationDelay: … }}`. */
export function spinDelay(now?: number): string {
  return `${spinDelayMs(now).toFixed(0)}ms`;
}
