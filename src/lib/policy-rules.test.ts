import { describe, expect, it } from "vitest";

import { insertRule, isBuiltInRule, removeRule, ruleId, type PolicyRule } from "./policy-rules";

const builtIns: PolicyRule[] = [
  { id: "safety.high-risk", decision: "deny" },
  { id: "safety.external-write", decision: "ask" },
  { id: "safe.read-only", decision: "allow" },
];

describe("policy rule placement", () => {
  it("keeps a new allow rule behind every built-in", () => {
    const next = insertRule(builtIns, { id: "user.allow.git", decision: "allow" });
    expect(next.map((rule) => rule.id)).toEqual([...builtIns.map((rule) => rule.id), "user.allow.git"]);
  });

  it("puts a stopping rule ahead of the user's allow rules", () => {
    const withAllow = insertRule(builtIns, { id: "user.allow.git", decision: "allow" });
    const next = insertRule(withAllow, { id: "user.deny.rm", decision: "deny" });
    expect(next.map((rule) => rule.id)).toEqual([
      "safety.high-risk",
      "safety.external-write",
      "safe.read-only",
      "user.deny.rm",
      "user.allow.git",
    ]);
  });

  it("keeps two stopping rules in the order they were added", () => {
    const first = insertRule(builtIns, { id: "user.ask.a", decision: "ask" });
    const second = insertRule(first, { id: "user.deny.b", decision: "deny" });
    expect(second.map((rule) => rule.id).slice(3)).toEqual(["user.ask.a", "user.deny.b"]);
  });

  it("refuses to remove a built-in rule", () => {
    const next = removeRule(insertRule(builtIns, { id: "user.allow.git", decision: "allow" }), "safety.high-risk");
    expect(next.map((rule) => rule.id)).toContain("safety.high-risk");
    expect(removeRule(next, "user.allow.git").map((rule) => rule.id)).not.toContain("user.allow.git");
  });

  it("derives readable, unique ids", () => {
    expect(ruleId([], "mcp__custom_*", "deny")).toBe("user.deny.mcp-custom");
    const taken: PolicyRule[] = [{ id: "user.ask.bash", decision: "ask" }];
    expect(ruleId(taken, "Bash", "ask")).toBe("user.ask.bash-2");
  });

  it("recognizes which rules the app shipped", () => {
    expect(isBuiltInRule({ id: "safety.high-risk", decision: "deny" })).toBe(true);
    expect(isBuiltInRule({ id: "user.ask.bash", decision: "ask" })).toBe(false);
  });
});
