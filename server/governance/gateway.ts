import { randomUUID } from "node:crypto";

import { AuditStore } from "../audit/audit-store.ts";
import type { AuditRecord, AuditResult } from "../audit/types.ts";
import type { GovernedAction } from "./action.ts";
import type { PolicyDecision } from "./decision.ts";
import { loadPolicy } from "./policy-loader.ts";
import { evaluatePolicy } from "./policy-engine.ts";

export class GovernanceGateway {
  readonly audit: AuditStore;

  constructor(audit = new AuditStore()) {
    this.audit = audit;
  }

  decide(action: GovernedAction): PolicyDecision {
    return evaluatePolicy(loadPolicy(), action);
  }

  async record(
    action: GovernedAction,
    decision: PolicyDecision,
    result: AuditResult,
    extra: { userDecision?: "allow" | "deny"; durationMs?: number } = {},
  ): Promise<AuditRecord> {
    const record: AuditRecord = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      agentId: action.agent.id,
      engine: action.agent.engine,
      ...(action.threadId ? { threadId: action.threadId } : {}),
      tool: action.tool.name,
      action,
      policyDecision: decision.outcome,
      policyRuleId: decision.ruleId,
      policyReason: decision.reason,
      ...(decision.failClosed ? { failClosed: true } : {}),
      ...(extra.userDecision ? { userDecision: extra.userDecision } : {}),
      result,
      ...(extra.durationMs !== undefined ? { durationMs: extra.durationMs } : {}),
    };
    // Auditing is part of the boundary. If it cannot be written, the caller
    // receives an error and no ALLOW is forwarded to the provider.
    await this.audit.append(record);
    return record;
  }
}
