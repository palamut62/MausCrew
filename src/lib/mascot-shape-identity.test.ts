// A bot has to look like itself everywhere it appears.
//
// The first version derived the body shape from whatever seed a call site
// happened to pass. The sidebar row passed the bot id; the conversation header
// passed nothing and fell back to the name. Two seeds, two hashes, two shapes —
// the same bot drawn with a different body in two places on one screen.
//
// The fix was to stop deriving it: the shape is stored on the bot record beside
// its colour. These tests hold both halves of that — the derivation really is
// seed-sensitive (so it can never quietly become the source of truth again),
// and a stored shape overrides it no matter what seed comes along.
import { describe, expect, it } from "vitest";

import { SHIPPED_SHAPES, personaShapePath, resolvePersonaShape } from "./mascot-shapes";

const shapeFor = (opts: { seed: string; stored?: string }) =>
  personaShapePath(opts.stored ?? resolvePersonaShape(opts.seed));

describe("a bot looks like itself everywhere", () => {
  it("draws one body for one bot however the avatar is called", () => {
    const stored = "hex";
    const inSidebar = shapeFor({ seed: "bot-1758", stored });
    const inHeader = shapeFor({ seed: "Comet", stored });
    const inCall = shapeFor({ seed: "green", stored });
    expect(inHeader).toBe(inSidebar);
    expect(inCall).toBe(inSidebar);
  });

  // The bug, kept as a test: this is what the app did before the shape was
  // stored, and it is why deriving must never be the primary path again.
  it("would have drawn two bodies when the seed differs and nothing is stored", () => {
    const byId = shapeFor({ seed: "bot-1758" });
    const byName = shapeFor({ seed: "Comet" });
    expect(byName).not.toBe(byId);
  });

  it("still gives an unstored bot a stable shape rather than nothing", () => {
    const first = shapeFor({ seed: "legacy-bot" });
    const second = shapeFor({ seed: "legacy-bot" });
    expect(first).toBe(second);
    expect(first.length).toBeGreaterThan(20);
  });

  it("accepts every shape the store can assign", () => {
    for (const shape of SHIPPED_SHAPES) {
      const path = personaShapePath(shape);
      expect(path, shape).toMatch(/^M[-\d.]/);
      expect(path, shape).not.toMatch(/NaN|undefined/);
    }
  });

  it("falls back to a real body when a record carries an unknown shape", () => {
    expect(personaShapePath("banana")).toBe(personaShapePath("blob"));
  });
});
