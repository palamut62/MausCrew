import { describe, expect, it } from "vitest";

import { normalizePermissionAction } from "./action.ts";
import { evaluatePolicy, defaultPolicy, validatePolicy } from "./policy-engine.ts";

const action = (tool: string, summary: string) =>
  normalizePermissionAction({ botId: "bot-1", engine: "claude", threadId: "thread-1", tool, summary });

describe("governance policy", () => {
  it("denies destructive commands before broader defaults", () => {
    const decision = evaluatePolicy({ policy: defaultPolicy }, action("Bash", "rm -rf ./output"));
    expect(decision).toMatchObject({ outcome: "deny", ruleId: "safety.high-risk" });
  });

  // Regression: `.env` matched the credential heuristic, the heuristic fed
  // `risk: high`, and the only rule that saw "high" denied. A read-only,
  // value-redacting look at a .env was refused with nowhere in the app to
  // approve it — while every category default was set to allow.
  it("asks about credential access instead of refusing it", () => {
    for (const summary of [
      "sed 's/=.*/=<redacted>/' .env",
      "cat ~/.hermes/.env | head -30",
      "set -a; . ./.env; set +a; x-cli me mentions",
      "cat ~/.ssh/id_ed25519.pub",
    ]) {
      const decision = evaluatePolicy({ policy: defaultPolicy }, action("Bash", summary));
      expect(decision).toMatchObject({ outcome: "ask", ruleId: "safety.sensitive" });
    }
  });

  it("still denies a command that is destructive as well as sensitive", () => {
    const decision = evaluatePolicy({ policy: defaultPolicy }, action("Bash", "rm -rf ~/.ssh"));
    expect(decision).toMatchObject({ outcome: "deny", ruleId: "safety.high-risk" });
  });

  it("holds a sensitive read ahead of the read-only allow", () => {
    // Order matters more than the rule: if safe.read-only came first, a
    // `Read` of a credential file would be waved straight through.
    const decision = evaluatePolicy({ policy: defaultPolicy }, action("Read", "/home/u/project/.env"));
    expect(decision).toMatchObject({ outcome: "ask", ruleId: "safety.sensitive" });
  });

  it("asks for external writes", () => {
    const decision = evaluatePolicy({ policy: defaultPolicy }, action("Bash", "git push origin main"));
    expect(decision).toMatchObject({ outcome: "ask", ruleId: "safety.external-write" });
  });

  it("allows ordinary non-sensitive reads", () => {
    const decision = evaluatePolicy({ policy: defaultPolicy }, action("Read", "README.md"));
    expect(decision).toMatchObject({ outcome: "allow", ruleId: "safe.read-only" });
  });

  it("holds browser and network reads at the approval boundary", () => {
    expect(evaluatePolicy({ policy: defaultPolicy }, action("WebSearch", "search docs"))).toMatchObject({
      outcome: "ask",
      ruleId: "safety.network-boundary",
    });
    expect(evaluatePolicy({ policy: defaultPolicy }, action("fetch", "https://example.com"))).toMatchObject({
      outcome: "ask",
      ruleId: "safety.network-boundary",
    });
  });

  it("fails closed when the policy parser failed", () => {
    const decision = evaluatePolicy({ policy: null, error: "unexpected token" }, action("Read", "README.md"));
    expect(decision).toMatchObject({ outcome: "deny", ruleId: "policy.invalid", failClosed: true });
  });

  it("rejects incomplete policy documents", () => {
    expect(() => validatePolicy({ version: 1, defaults: {}, rules: [] })).toThrow("default for shell");
  });
});
