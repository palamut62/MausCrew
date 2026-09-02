import { describe, expect, it } from "vitest";

import { keysymFor } from "./keysym";

const event = (key: string, modifiers: Partial<{ ctrl: boolean; meta: boolean; alt: boolean; shift: boolean }> = {}) => ({
  key,
  ctrlKey: modifiers.ctrl ?? false,
  metaKey: modifiers.meta ?? false,
  altKey: modifiers.alt ?? false,
  shiftKey: modifiers.shift ?? false,
});

describe("keysym translation", () => {
  it("renames the keys X calls something else", () => {
    expect(keysymFor(event("Enter"))).toEqual({ kind: "key", key: "Return" });
    expect(keysymFor(event("Backspace"))).toEqual({ kind: "key", key: "BackSpace" });
    expect(keysymFor(event("PageDown"))).toEqual({ kind: "key", key: "Next" });
    expect(keysymFor(event("ArrowLeft"))).toEqual({ kind: "key", key: "Left" });
    expect(keysymFor(event(" "))).toEqual({ kind: "key", key: "space" });
  });

  it("carries modifiers as an xdotool chord, with Cmd standing in for Ctrl", () => {
    expect(keysymFor(event("c", { ctrl: true }))).toEqual({ kind: "key", key: "ctrl+c" });
    // The box runs Linux: ⌘C there is ctrl+c, and a Super chord would do
    // nothing at all.
    expect(keysymFor(event("c", { meta: true }))).toEqual({ kind: "key", key: "ctrl+c" });
    expect(keysymFor(event("Tab", { alt: true }))).toEqual({ kind: "key", key: "alt+Tab" });
  });

  it("leaves plain typing to the text field", () => {
    // Unmodified characters are how words get typed; the key path exists for
    // what a text field cannot send.
    expect(keysymFor(event("a"))).toBeNull();
    expect(keysymFor(event("7"))).toBeNull();
  });

  it("names punctuation xdotool would not take literally", () => {
    expect(keysymFor(event("/", { ctrl: true }))).toEqual({ kind: "key", key: "ctrl+slash" });
    expect(keysymFor(event("-", { ctrl: true }))).toEqual({ kind: "key", key: "ctrl+minus" });
  });

  it("passes function keys through and refuses everything it does not know", () => {
    expect(keysymFor(event("F5"))).toEqual({ kind: "key", key: "F5" });
    for (const key of ["Shift", "Meta", "Dead", "Unidentified"]) {
      expect(keysymFor(event(key))).toBeNull();
    }
  });
});
