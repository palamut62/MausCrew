export type PolicyOutcome = "allow" | "ask" | "deny";

export type PolicyDecision = {
  outcome: PolicyOutcome;
  ruleId: string;
  reason: string;
  failClosed: boolean;
};
