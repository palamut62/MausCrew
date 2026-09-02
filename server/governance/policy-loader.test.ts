import { describe, expect, it } from "vitest";

import { normalizePermissionAction } from "./action.ts";
import { evaluatePolicy, type PolicyDocument } from "./policy-engine.ts";
import { withNetworkRule, withSensitiveRule } from "./policy-loader.ts";

/** A policy file written before the destructive/sensitive split, by someone
 * who had set every category default to allow. */
const legacyPermissive: PolicyDocument = {
  version: 1,
  defaults: {
    shell: "allow",
    filesystem: "allow",
    browser: "allow",
    computer: "allow",
    mcp: "allow",
    composio: "allow",
    network: "allow",
    agent: "allow",
    other: "allow",
  },
  rules: [
    { id: "safety.high-risk", when: { risks: ["high"] }, decision: "deny" },
    { id: "safety.external-write", when: { externalWrite: true }, decision: "ask" },
    { id: "safe.read-only", when: { intents: ["read"] }, decision: "allow" },
  ],
};

const action = (tool: string, summary: string) =>
  normalizePermissionAction({ botId: "bot-1", engine: "claude", threadId: "thread-1", tool, summary });

describe("policy migration", () => {
  it("inserts the sensitive rule behind the destructive one", () => {
    const migrated = withSensitiveRule(legacyPermissive);
    expect(migrated.rules.map((rule) => rule.id)).toEqual([
      "safety.high-risk",
      "safety.sensitive",
      "safety.external-write",
      "safe.read-only",
    ]);
  });

  it("turns an unanswerable deny into an approval card on an old file", () => {
    // Before: risk "high" → safety.high-risk → deny, with no way to say yes.
    // After: the rule the migration adds holds it at a card instead.
    const decision = evaluatePolicy({ policy: withSensitiveRule(legacyPermissive) }, action("Bash", "cat ~/.hermes/.env"));
    expect(decision).toMatchObject({ outcome: "ask", ruleId: "safety.sensitive" });
  });

  it("does not let a permissive default swallow credential access", () => {
    // Without the migration the same command now falls through to
    // defaults.shell — which on this file is `allow`. Silently allowing is
    // the wrong half of the fix.
    const decision = evaluatePolicy({ policy: legacyPermissive }, action("Bash", "cat ~/.hermes/.env"));
    expect(decision.outcome).toBe("allow");
    expect(evaluatePolicy({ policy: withSensitiveRule(legacyPermissive) }, action("Bash", "cat ~/.hermes/.env")).outcome)
      .toBe("ask");
  });

  it("leaves a policy that already has the rule alone", () => {
    const once = withSensitiveRule(legacyPermissive);
    expect(withSensitiveRule(once).rules).toEqual(once.rules);
  });

  it("adds the network boundary ahead of a legacy read-only allow", () => {
    const migrated = withNetworkRule(withSensitiveRule(legacyPermissive));
    expect(migrated.rules.map((rule) => rule.id)).toEqual([
      "safety.high-risk",
      "safety.sensitive",
      "safety.external-write",
      "safety.network-boundary",
      "safe.read-only",
    ]);
    expect(evaluatePolicy({ policy: migrated }, action("WebSearch", "search docs"))).toMatchObject({
      outcome: "ask",
      ruleId: "safety.network-boundary",
    });
  });

  it("keeps a user's own decision for the rule when they have edited it", () => {
    const edited: PolicyDocument = {
      ...legacyPermissive,
      rules: [{ id: "safety.sensitive", when: { sensitive: true }, decision: "allow" }, ...legacyPermissive.rules],
    };
    expect(withSensitiveRule(edited).rules[0]).toMatchObject({ id: "safety.sensitive", decision: "allow" });
  });
});
