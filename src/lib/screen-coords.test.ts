import { describe, expect, it } from "vitest";

import { screenPoint } from "./screen-coords";

// A 1024x640 frame captured from a 1920x1200 display, drawn into a 400x250
// element — the same 16:10 the panel reserves, so nothing is letterboxed.
const natural = { width: 1024, height: 640 };
const display = { width: 1920, height: 1200 };
const element = { width: 400, height: 250 };

describe("preview click mapping", () => {
  it("maps the centre and the corners of an exactly-fitting frame", () => {
    expect(screenPoint({ offsetX: 200, offsetY: 125 }, element, natural, display)).toEqual({ x: 960, y: 600 });
    expect(screenPoint({ offsetX: 0, offsetY: 0 }, element, natural, display)).toEqual({ x: 0, y: 0 });
    expect(screenPoint({ offsetX: 400, offsetY: 250 }, element, natural, display)).toEqual({ x: 1920, y: 1200 });
  });

  it("accounts for the letterbox when the frame is a different shape", () => {
    // A 4:3 frame in a 16:10 box leaves bars on the left and right; a click
    // in a bar is not a click on the screen.
    const fourByThree = { width: 1024, height: 768 };
    const drawn = 250 * (1024 / 768); // ≈ 333.3 wide, centred in 400
    const bar = (400 - drawn) / 2;
    expect(screenPoint({ offsetX: bar / 2, offsetY: 125 }, element, fourByThree, display)).toBeNull();
    expect(screenPoint({ offsetX: 200, offsetY: 125 }, element, fourByThree, display)).toEqual({ x: 960, y: 600 });
  });

  it("refuses a click when a size is missing", () => {
    expect(screenPoint({ offsetX: 10, offsetY: 10 }, { width: 0, height: 0 }, natural, display)).toBeNull();
    expect(screenPoint({ offsetX: 10, offsetY: 10 }, element, natural, { width: 0, height: 0 })).toBeNull();
  });

  it("scales up rather than assuming the preview is the screen", () => {
    // The whole point: the frame is 1024 wide, the screen is 1920, and a
    // click three quarters across must land three quarters across the screen.
    expect(screenPoint({ offsetX: 300, offsetY: 125 }, element, natural, display)).toEqual({ x: 1440, y: 600 });
  });
});
