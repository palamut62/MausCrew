// The mascot is decoration, but the two things that make it read as a room
// rather than a spinner are arithmetic, so they are testable: every mood has a
// row, and no two bots share a gait.
import { describe, expect, it } from "vitest";

import {
  MAUS_MOTION,
  motionFor,
  stateForBot,
  timingFor,
  type MausState,
} from "./mascot-motion";

describe("motion table", () => {
  it("gives every mood a complete, sane row", () => {
    for (const [state, motion] of Object.entries(MAUS_MOTION)) {
      expect(motion.period, `${state} period`).toBeGreaterThan(400);
      expect(motion.amplitude, `${state} amplitude`).toBeGreaterThanOrEqual(0);
      // the tile is 100 units tall; anything past a tenth of it leaves the box
      expect(motion.amplitude, `${state} amplitude`).toBeLessThanOrEqual(10);
      expect(Math.abs(motion.tilt), `${state} tilt`).toBeLessThanOrEqual(15);
      expect(motion.eye, `${state} eye`).toBeGreaterThanOrEqual(0);
      expect(motion.eye, `${state} eye`).toBeLessThanOrEqual(1.25);
    }
  });

  it("falls back to resting motion instead of freezing on an unknown state", () => {
    expect(motionFor(undefined)).toEqual(MAUS_MOTION.idle);
    expect(motionFor(null)).toEqual(MAUS_MOTION.idle);
    expect(motionFor("not-a-mood" as MausState)).toEqual(MAUS_MOTION.idle);
  });

  it("holds sleeping bots perfectly still", () => {
    expect(MAUS_MOTION.sleeping.amplitude).toBe(0);
    expect(MAUS_MOTION.sleeping.eye).toBeLessThan(0.2);
  });
});

describe("per-bot timing", () => {
  it("is stable for a bot and different between bots", () => {
    expect(timingFor("bot-a")).toEqual(timingFor("bot-a"));
    expect(timingFor("bot-a").phase).not.toBe(timingFor("bot-b").phase);
  });

  it("keeps the rate close enough to the authored period to stay in character", () => {
    for (const seed of ["a", "b", "c", "bot-1758", "", "🐭"]) {
      const { phase, rate } = timingFor(seed);
      expect(phase).toBeGreaterThanOrEqual(0);
      expect(phase).toBeLessThan(Math.PI * 2);
      expect(rate).toBeGreaterThanOrEqual(0.91);
      expect(rate).toBeLessThanOrEqual(1.09);
    }
  });

  // The whole point of the offsets: a roomful of bots must not pulse together.
  it("spreads a realistic roster across the cycle", () => {
    const phases = Array.from(
      { length: 24 },
      (_, i) => timingFor(`bot-${i}`).phase,
    );
    const buckets = new Set(
      phases.map((p) => Math.floor((p / (Math.PI * 2)) * 6)),
    );
    expect(buckets.size).toBeGreaterThanOrEqual(5);
  });
});

describe("stateForBot", () => {
  const bot = (over: Partial<Parameters<typeof stateForBot>[0]> = {}) => ({
    name: "Pesto",
    ...over,
  });

  it("reads what the bot is doing before what it is for", () => {
    expect(stateForBot(bot({ title: "Designer", busy: true }))).toBe("working");
    expect(stateForBot(bot({ title: "Designer", unread: true }))).toBe(
      "notifying",
    );
    // a failed tool call outranks even busy — the avatar must not keep smiling
    expect(
      stateForBot(
        bot({
          busy: true,
          messages: [{ kind: "activity", tool: { ok: false } }],
        }),
      ),
    ).toBe("alerting");
  });

  it("settles a resting mood from the bot's job", () => {
    expect(stateForBot(bot({ title: "Compliance" }))).toBe("scared");
    // the groups overlap; the earlier row wins and must keep winning
    expect(stateForBot(bot({ title: "Security review" }))).toBe("suspicious");
    expect(stateForBot(bot({ description: "Runs overnight batches" }))).toBe(
      "drowsy",
    );
    expect(stateForBot(bot({ title: "Uptime monitor" }))).toBe("radar");
    expect(stateForBot(bot({}))).toBe("idle");
  });
});

// The renderer's loop is three lines of arithmetic driven by requestAnimationFrame.
// rAF cannot run in a test (or in a hidden window), so the arithmetic is tested
// directly here — this is what actually decides whether the roster looks alive.
describe("the bob the renderer draws", () => {
  const bobAt = (seed: string, state: MausState, ms: number) => {
    const motion = motionFor(state);
    const { phase, rate } = timingFor(seed);
    return Math.sin((ms / (motion.period * rate)) * Math.PI * 2 + phase) * motion.amplitude;
  };
  const trace = (seed: string, state: MausState) =>
    Array.from({ length: 60 }, (_, i) => bobAt(seed, state, i * 100));

  it("actually travels, and stays inside the tile", () => {
    const values = trace("bot-a", "working");
    const span = Math.max(...values) - Math.min(...values);
    expect(span).toBeGreaterThan(1);
    expect(Math.max(...values.map(Math.abs))).toBeLessThanOrEqual(
      MAUS_MOTION.working.amplitude + 0.001,
    );
  });

  it("keeps two bots in the same mood out of step", () => {
    const a = trace("bot-a", "idle");
    const b = trace("bot-b", "idle");
    const apart = a.map((v, i) => Math.abs(v - b[i]));
    // never identical, and meaningfully apart at some point in the window
    expect(Math.min(...apart)).toBeGreaterThan(0);
    expect(Math.max(...apart)).toBeGreaterThan(0.5);
  });

  it("holds a sleeping bot at rest for every frame", () => {
    expect(trace("bot-a", "sleeping").every((v) => v === 0)).toBe(true);
  });
});
