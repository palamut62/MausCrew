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

  it("asks for external writes", () => {
    const decision = evaluatePolicy({ policy: defaultPolicy }, action("Bash", "git push origin main"));
    expect(decision).toMatchObject({ outcome: "ask", ruleId: "safety.external-write" });
  });

  it("allows ordinary non-sensitive reads", () => {
    const decision = evaluatePolicy({ policy: defaultPolicy }, action("Read", "README.md"));
    expect(decision).toMatchObject({ outcome: "allow", ruleId: "safe.read-only" });
  });

  it("fails closed when the policy parser failed", () => {
    const decision = evaluatePolicy({ policy: null, error: "unexpected token" }, action("Read", "README.md"));
    expect(decision).toMatchObject({ outcome: "deny", ruleId: "policy.invalid", failClosed: true });
  });

  it("rejects incomplete policy documents", () => {
    expect(() => validatePolicy({ version: 1, defaults: {}, rules: [] })).toThrow("default for shell");
  });
});
