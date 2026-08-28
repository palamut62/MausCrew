// The shell overrides its height only while a keyboard is covering the
// viewport; everything else is dvh's job, and taking it over would mean a
// missed resize event leaves the app stuck at a stale pixel height.
import { describe, expect, it } from "vitest";

import { appHeight } from "./viewport";

describe("appHeight", () => {
  it("leaves CSS in charge when the platform has no visual viewport", () => {
    expect(appHeight(null, 812)).toBeNull();
    expect(appHeight(undefined, 812)).toBeNull();
  });

  it("leaves CSS in charge when nothing is covering the viewport", () => {
    expect(appHeight({ height: 812, offsetTop: 0 }, 812)).toBeNull();
  });

  it("ignores a collapsing URL bar, which dvh already tracks", () => {
    expect(appHeight({ height: 740, offsetTop: 0 }, 812)).toBeNull();
  });

  it("takes over for a keyboard, rounded to whole pixels", () => {
    expect(appHeight({ height: 465.4, offsetTop: 0 }, 812)).toBe("465px");
  });

  it("adds offsetTop so a rubber-band scroll is not mistaken for a keyboard", () => {
    // 812 - (700 + 44) = 68px — under the threshold, so CSS keeps it.
    expect(appHeight({ height: 700, offsetTop: 44 }, 812)).toBeNull();
  });

  it("rejects a degenerate measurement rather than collapsing the app", () => {
    expect(appHeight({ height: 0, offsetTop: 0 }, 812)).toBeNull();
    expect(appHeight({ height: Number.NaN, offsetTop: 0 }, 812)).toBeNull();
  });
});
