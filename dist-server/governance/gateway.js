import { randomUUID } from "node:crypto";
import { AuditStore } from "../audit/audit-store.js";
import { loadPolicy } from "./policy-loader.js";
import { evaluatePolicy } from "./policy-engine.js";
export class GovernanceGateway {
    audit;
    constructor(audit = new AuditStore()) {
        this.audit = audit;
    }
    decide(action) {
        return evaluatePolicy(loadPolicy(), action);
    }
    async record(action, decision, result, extra = {}) {
        const record = {
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
