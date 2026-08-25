// The whole value of the shared spinner is one property: two spinners that
// mount at different moments must end up at the same angle. That is arithmetic,
// so it is testable without a browser.
import { describe, expect, it } from "vitest";

import { SPIN_DURATION_MS, spinDelay, spinDelayMs } from "./spin-sync";

/** Where a spinner that mounted at `mountedAt` sits at `now`, as a turn 0..1. */
const angleAt = (mountedAt: number, now: number) => {
  const started = mountedAt + spinDelayMs(mountedAt);
  const turn = ((now - started) % SPIN_DURATION_MS) / SPIN_DURATION_MS;
  return (turn + 1) % 1;
};

describe("spinner sync", () => {
  it("catches a late spinner up instead of pushing it back", () => {
    // never positive: a positive delay would stall the spinner, not align it
    for (const t of [0, 1, 250, 999, 1000, 4321.7, 98765]) {
      expect(spinDelayMs(t)).toBeLessThanOrEqual(0);
      expect(spinDelayMs(t)).toBeGreaterThan(-SPIN_DURATION_MS);
    }
  });

  it("puts spinners mounted seconds apart at the same angle", () => {
    const now = 10_000;
    const angles = [0, 137, 412.5, 999, 3000, 7777.7].map((m) =>
      angleAt(m, now),
    );
    for (const a of angles) expect(a).toBeCloseTo(angles[0], 9);
  });

  it("still turns — alignment must not mean frozen", () => {
    const mounted = 500;
    expect(angleAt(mounted, 1000)).not.toBeCloseTo(angleAt(mounted, 1250), 3);
  });

  it("survives a clock that has been running for days", () => {
    const days = 3 * 24 * 60 * 60 * 1000;
    expect(angleAt(days + 13, days + 20_000)).toBeCloseTo(
      angleAt(days + 4567, days + 20_000),
      9,
    );
  });

  it("formats a delay CSS accepts", () => {
    expect(spinDelay(1500)).toMatch(/^-?\d+ms$/);
    expect(spinDelay(0)).toBe("0ms");
  });
});
