import type { GovernedAction } from "../governance/action.ts";
import type { PolicyOutcome } from "../governance/decision.ts";

export type AuditResult = "pending" | "success" | "failed" | "denied" | "cancelled";

export type AuditRecord = {
  id: string;
  timestamp: string;
  agentId: string;
  engine: string;
  threadId?: string;
  tool: string;
  action: GovernedAction;
  policyDecision: PolicyOutcome;
  policyRuleId: string;
  policyReason: string;
  failClosed?: boolean;
  userDecision?: "allow" | "deny";
  result: AuditResult;
  durationMs?: number;
};
