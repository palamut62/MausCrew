import { createHash, randomUUID } from "node:crypto";
import { createCrewEvent } from "../crew-core/events.js";
export function hashToolArguments(value) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
export class ApprovalService {
    database;
    events;
    audit;
    bus;
    constructor(database, events, audit, bus) {
        this.database = database;
        this.events = events;
        this.audit = audit;
        this.bus = bus;
    }
    request(input) {
        const approval = { id: randomUUID(), projectId: input.projectId, agentId: input.agentId, ...(input.sessionId ? { sessionId: input.sessionId } : {}), ...(input.taskId ? { taskId: input.taskId } : {}), action: input.action, argumentsHash: hashToolArguments(input.arguments), status: "pending", reason: input.reason, createdAt: new Date().toISOString() };
        let event;
        this.database.transaction(() => {
            this.database.db.prepare(`INSERT INTO approvals(id, project_id, agent_id, session_id, task_id, action, arguments_hash, status, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`)
                .run(approval.id, approval.projectId, approval.agentId, approval.sessionId ?? null, approval.taskId ?? null, approval.action, approval.argumentsHash, approval.reason ?? null, approval.createdAt);
            event = this.#record("approval.requested", approval, "system", "tool-manager");
        });
        this.bus.publish(event);
        return approval;
    }
    decide(id, decision, decidedBy, reason) {
        const current = this.get(id);
        if (!current || current.status !== "pending")
            throw new Error(`Approval is not pending: ${id}`);
        const decidedAt = new Date().toISOString();
        let approval;
        let event;
        this.database.transaction(() => {
            const result = this.database.db.prepare("UPDATE approvals SET status = ?, reason = COALESCE(?, reason), decided_at = ?, decided_by = ? WHERE id = ? AND status = 'pending'").run(decision, reason ?? null, decidedAt, decidedBy, id);
            if (Number(result.changes) !== 1)
                throw new Error(`Approval decision raced: ${id}`);
            approval = this.get(id);
            event = this.#record(decision === "approved" ? "approval.approved" : "approval.rejected", approval, "human", decidedBy);
        });
        this.bus.publish(event);
        return approval;
    }
    cancelPending(id, reason) {
        const current = this.get(id);
        if (!current || current.status !== "pending")
            throw new Error(`Approval is not pending: ${id}`);
        const decidedAt = new Date().toISOString();
        let approval;
        let event;
        this.database.transaction(() => {
            this.database.db.prepare("UPDATE approvals SET status = 'rejected', reason = ?, decided_at = ?, decided_by = 'system' WHERE id = ? AND status = 'pending'").run(reason, decidedAt, id);
            approval = this.get(id);
            event = this.#record("approval.rejected", approval, "system", "workflow-engine");
        });
        this.bus.publish(event);
        return approval;
    }
    get(id) {
        const row = this.database.db.prepare("SELECT * FROM approvals WHERE id = ?").get(id);
        return row ? { id: row.id, projectId: row.project_id, agentId: row.agent_id, ...(row.session_id ? { sessionId: row.session_id } : {}), ...(row.task_id ? { taskId: row.task_id } : {}), action: row.action, argumentsHash: row.arguments_hash, status: row.status, ...(row.reason ? { reason: row.reason } : {}), createdAt: row.created_at, ...(row.decided_at ? { decidedAt: row.decided_at } : {}), ...(row.decided_by ? { decidedBy: row.decided_by } : {}), ...(row.consumed_at ? { consumedAt: row.consumed_at } : {}) } : undefined;
    }
    consumeApproved(id, input) {
        const approval = this.get(id);
        if (!approval || approval.status !== "approved" || approval.consumedAt || approval.projectId !== input.projectId || approval.agentId !== input.agentId || approval.action !== input.action || approval.argumentsHash !== hashToolArguments(input.arguments))
            throw new Error("Approval does not authorize this exact tool call");
        const result = this.database.db.prepare("UPDATE approvals SET consumed_at = ? WHERE id = ? AND status = 'approved' AND consumed_at IS NULL").run(new Date().toISOString(), id);
        if (Number(result.changes) !== 1)
            throw new Error("Approval has already been consumed");
    }
    #record(type, approval, actorType, actorId) {
        const event = createCrewEvent({ type, projectId: approval.projectId, actor: { type: actorType, id: actorId }, payload: { approvalId: approval.id, agentId: approval.agentId, taskId: approval.taskId, action: approval.action, status: approval.status }, correlationId: approval.taskId ?? approval.id });
        this.events.append(event);
        this.audit.append({ projectId: approval.projectId, actorId, actorType, action: type, target: approval.id, metadata: event.payload, createdAt: event.createdAt });
        return event;
    }
}
