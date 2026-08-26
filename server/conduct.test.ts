// Conduct rules ride on every turn, so their cost is fixed and their value is
// entirely in being specific. These tests hold the two things that make them
// worth the tokens: they say what to do rather than what exists, and the
// coordinator rules never tell a bot to spend the user's money casually.
import { describe, expect, it } from "vitest";

import {
  CONDUCT_RULES,
  DRIFT_REMINDER,
  DRIFT_REMINDER_EVERY,
  coordinatorRules,
  shouldRemind,
} from "./conduct.ts";

describe("always-on conduct", () => {
  it("tells the bot to find out rather than ask", () => {
    expect(CONDUCT_RULES).toMatch(/do not ask the user for something you could establish/i);
    // and leaves room for the questions that ARE the user's
    expect(CONDUCT_RULES).toMatch(/decisions that are genuinely theirs/i);
  });

  it("demands honest reporting of failures and skipped work", () => {
    expect(CONDUCT_RULES).toMatch(/show its output/i);
    expect(CONDUCT_RULES).toMatch(/which part and why/i);
    expect(CONDUCT_RULES).toMatch(/not describe work as finished until it is/i);
  });

  it("stays short enough to survive a long context", () => {
    expect(CONDUCT_RULES.length).toBeLessThan(1200);
  });
});

describe("coordinator conduct", () => {
  it("says nothing at all when there is nobody to coordinate", () => {
    expect(coordinatorRules({ hasPeers: false, hasOwnSubagents: false })).toBe("");
  });

  // The adaptation that matters: a peer costs the user money, the engine's own
  // workers do not, so the free path is the one offered first.
  it("points at the engine's own workers for work that is still the bot's", () => {
    const rules = coordinatorRules({ hasPeers: false, hasOwnSubagents: true });
    expect(rules).toMatch(/your own engine's subagents/i);
    expect(rules).not.toMatch(/delegate_bot/);
  });

  it("treats handing work to a peer as a cost, not a convenience", () => {
    const rules = coordinatorRules({ hasPeers: true, hasOwnSubagents: true });
    expect(rules).toMatch(/costs the user tokens/i);
    expect(rules).toMatch(/not a way to save yourself effort/i);
  });

  it("forbids both blocking on a delegation and redoing it", () => {
    const rules = coordinatorRules({ hasPeers: true, hasOwnSubagents: false });
    expect(rules).toMatch(/do not sit and wait/i);
    expect(rules).toMatch(/do not redo the work/i);
    expect(rules).toContain("check_bot");
    expect(rules).toContain("stop_bot");
  });

  it("names the parallel ask, and warns against fragmenting one job", () => {
    const rules = coordinatorRules({ hasPeers: true, hasOwnSubagents: false });
    expect(rules).toContain("ask_bots");
    expect(rules).toMatch(/shares context belongs to one owner/i);
  });
});

describe("drift reminders", () => {
  it("stays quiet early and speaks up once a session is long", () => {
    expect(shouldRemind(0)).toBe(false);
    expect(shouldRemind(1)).toBe(false);
    expect(shouldRemind(DRIFT_REMINDER_EVERY - 1)).toBe(false);
    expect(shouldRemind(DRIFT_REMINDER_EVERY)).toBe(true);
    expect(shouldRemind(DRIFT_REMINDER_EVERY * 3)).toBe(true);
  });

  // A reminder on every turn is just more context to average out.
  it("does not fire on consecutive turns", () => {
    const firing = Array.from({ length: DRIFT_REMINDER_EVERY * 2 }, (_, i) => shouldRemind(i + 1));
    expect(firing.filter(Boolean)).toHaveLength(2);
  });

  it("repeats the rules rather than inventing new ones", () => {
    expect(DRIFT_REMINDER).toMatch(/rather than asking/i);
    expect(DRIFT_REMINDER).toMatch(/verify/i);
    expect(DRIFT_REMINDER.length).toBeLessThan(300);
  });
});
