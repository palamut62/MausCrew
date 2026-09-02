import { describe, expect, it } from "vitest";

import { parseDisplayGeometry } from "./box.ts";

describe("capture geometry", () => {
  it("reads the display size the capture reported", () => {
    expect(parseDisplayGeometry("captured 1920x1200\n")).toEqual({ width: 1920, height: 1200 });
  });

  it("reports nothing when xdotool was not there to answer", () => {
    // Older images, or a box whose desktop has not started: the frame is
    // still usable, it just cannot be clicked on.
    expect(parseDisplayGeometry("captured unknown")).toBeNull();
    expect(parseDisplayGeometry("captured")).toBeNull();
    expect(parseDisplayGeometry("")).toBeNull();
  });
});
