// A wrong handover silently spends a second subscription to get the same
// failure, so the classifier's job is as much about refusing as accepting.
// These tests weight the refusals accordingly.
import { describe, expect, it } from "vitest";

import { classifyFailure, exhaustedNotice, handoverNotice, nextEngine } from "./failover.ts";

describe("telling exhaustion apart from failure", () => {
  it("moves a turn when the engine is out of allowance", () => {
    for (const message of [
      "Claude usage limit reached. Your limit will reset at 3pm.",
      "You have exceeded your weekly limit for this model",
      "quota exceeded for this organization",
      "This account is out of credits",
    ]) {
      expect(classifyFailure(message).move, message).toBe(true);
      expect(classifyFailure(message).reason, message).toBe("exhausted");
    }
  });

  it("moves a turn when it is only being throttled", () => {
    expect(classifyFailure("429 Too Many Requests").reason).toBe("rate-limited");
    expect(classifyFailure('{"type":"overloaded_error"}').reason).toBe("rate-limited");
  });

  it("moves a turn when the account cannot pay", () => {
    expect(classifyFailure("402 payment required").reason).toBe("billing");
    expect(classifyFailure("Insufficient balance").reason).toBe("billing");
  });

  // The expensive mistake: burning a second budget to reproduce the same error.
  it("stays put for anything another engine cannot fix", () => {
    for (const message of [
      "401 authentication_error: invalid api key",
      "permission denied while reading /etc/shadow",
      "no such model: ghost-1",
      "spawn claude ENOENT",
      "TypeError: cannot read properties of undefined",
      "The tests failed: 3 assertions did not hold",
    ]) {
      expect(classifyFailure(message).move, message).toBe(false);
    }
  });

  // Auth failures often mention limits in the same breath.
  it("does not mistake an auth failure that says 'limit' for exhaustion", () => {
    expect(classifyFailure("unauthorized: key has no quota exceeded allowance").move).toBe(false);
  });

  it("stays put when there is nothing to read", () => {
    expect(classifyFailure(null).move).toBe(false);
    expect(classifyFailure("").move).toBe(false);
    expect(classifyFailure("   ").move).toBe(false);
  });
});

describe("choosing where to go next", () => {
  const available = new Set(["claude", "codex", "deepseek", "openrouter"]);

  it("follows the user's order, not availability order", () => {
    expect(
      nextEngine({ chain: ["claude", "codex", "deepseek"], available, tried: ["claude"] }),
    ).toBe("codex");
  });

  it("never offers an engine already tried this turn", () => {
    expect(
      nextEngine({ chain: ["claude", "codex"], available, tried: ["claude", "codex"] }),
    ).toBeNull();
  });

  it("skips an engine that is not configured", () => {
    expect(
      nextEngine({
        chain: ["claude", "ghost", "codex"],
        available,
        tried: ["claude"],
      }),
    ).toBe("codex");
  });

  it("gives up rather than looping between two exhausted engines", () => {
    let tried: string[] = [];
    const chain = ["claude", "codex"];
    for (let i = 0; i < 5; i++) {
      const next = nextEngine({ chain, available, tried });
      if (!next) break;
      tried.push(next);
    }
    expect(tried).toEqual(["claude", "codex"]);
  });

  it("has nowhere to go with an empty chain", () => {
    expect(nextEngine({ chain: [], available, tried: [] })).toBeNull();
  });
});

describe("what the user is told", () => {
  it("names both engines and the reason", () => {
    const notice = handoverNotice("Claude Sonnet 5", "Codex", "exhausted");
    expect(notice).toContain("Claude Sonnet 5");
    expect(notice).toContain("Codex");
    expect(notice).toMatch(/ran out of allowance/);
    // the promise that makes a handover acceptable rather than alarming
    expect(notice).toMatch(/history/);
  });

  it("says nothing when only one engine was ever tried", () => {
    expect(exhaustedNotice(["Claude"])).toBe("");
    expect(exhaustedNotice(["Claude", "Codex"])).toMatch(/Claude, Codex/);
  });
});
