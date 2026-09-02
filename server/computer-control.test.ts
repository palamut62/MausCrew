import { describe, expect, it } from "vitest";

import { controlCommand, parseControlInput, shellQuote } from "./computer-control.ts";

describe("computer control commands", () => {
  it("moves and clicks at rounded coordinates", () => {
    expect(controlCommand({ kind: "click", x: 100.4, y: 250.6 }))
      .toBe("export DISPLAY=${DISPLAY:-:0}; xdotool mousemove 100 251 click 1");
    expect(controlCommand({ kind: "click", x: 10, y: 20, button: "right" })).toContain("click 3");
    expect(controlCommand({ kind: "click", x: 10, y: 20, double: true })).toContain("click --repeat 2 --delay 60 1");
  });

  it("keeps typed text literal no matter what is in it", () => {
    // The failure this guards against is a command, not a typo: the text is
    // about to be interpolated into a shell line running on the box.
    const command = controlCommand({ kind: "type", text: "it's $(rm -rf /) `whoami` \"x\"" });
    expect(command).toBe(
      `export DISPLAY=\${DISPLAY:-:0}; xdotool type --delay 12 -- 'it'\\''s $(rm -rf /) \`whoami\` "x"'`,
    );
    expect(shellQuote("a'b")).toBe(`'a'\\''b'`);
  });

  it("accepts keysyms and modifier combos, and refuses anything else", () => {
    expect(controlCommand({ kind: "key", key: "Return" })).toContain("xdotool key -- Return");
    expect(controlCommand({ kind: "key", key: "ctrl+alt+Delete" })).toContain("ctrl+alt+Delete");
    for (const key of ["a; rm -rf /", "$(id)", "", "ctrl+", "a b"]) {
      expect(() => controlCommand({ kind: "key", key })).toThrow("keysym");
    }
  });

  it("bounds scrolling and refuses a direction it does not know", () => {
    expect(controlCommand({ kind: "scroll", x: 5, y: 5, direction: "up", amount: 999 })).toContain("--repeat 10");
    expect(controlCommand({ kind: "scroll", x: 5, y: 5, direction: "down" })).toContain("click --repeat 3 --delay 20 5");
    expect(() => controlCommand({ kind: "scroll", x: 5, y: 5, direction: "sideways" as "up" })).toThrow("up or down");
  });

  it("refuses coordinates that are not on any screen", () => {
    for (const value of [-1, Number.NaN, 999_999, "left" as unknown as number]) {
      expect(() => controlCommand({ kind: "click", x: value, y: 0 })).toThrow("screen coordinate");
    }
  });

  it("refuses a typed block long enough to be a paste", () => {
    expect(() => controlCommand({ kind: "type", text: "x".repeat(2_001) })).toThrow("at most 2000");
    expect(() => controlCommand({ kind: "type", text: "" })).toThrow("required");
  });

  it("parses only the four input kinds", () => {
    expect(parseControlInput({ kind: "click", x: "12", y: "34" })).toEqual({ kind: "click", x: 12, y: 34 });
    expect(parseControlInput({ kind: "key", key: "Escape" })).toEqual({ kind: "key", key: "Escape" });
    expect(() => parseControlInput({ kind: "drag" })).toThrow("click, scroll, type, or key");
  });
});
