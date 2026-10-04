import { createHash, randomUUID } from "node:crypto";

import type { SqliteAuditStore } from "../audit/sqlite-audit-store.ts";
import type { CrewEventBus } from "../crew-core/event-bus.ts";
import { createCrewEvent, type CrewEvent } from "../crew-core/events.ts";
import type { CrewDatabase } from "../storage/crew-database.ts";
import type { CrewEventStore } from "../storage/event-store.ts";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "changes_requested";
export interface ToolApproval { id: string; projectId: string; agentId: string; sessionId?: string; taskId?: string; action: string; argumentsHash: string; status: ApprovalStatus; reason?: string; createdAt: string; decidedAt?: string; decidedBy?: string; consumedAt?: string }
type Row = { id: string; project_id: string; agent_id: string; session_id: string | null; task_id: string | null; action: string; arguments_hash: string; status: ApprovalStatus; reason: string | null; created_at: string; decided_at: string | null; decided_by: string | null; consumed_at: string | null };

export function hashToolArguments(value: unknown): string { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }

export class ApprovalService {
  constructor(readonly database: CrewDatabase, readonly events: CrewEventStore, readonly audit: SqliteAuditStore, readonly bus: CrewEventBus) {}

  request(input: { projectId: string; agentId: string; sessionId?: string; taskId?: string; action: string; arguments: unknown; reason: string }): ToolApproval {
    const approval: ToolApproval = { id: randomUUID(), projectId: input.projectId, agentId: input.agentId, ...(input.sessionId ? { sessionId: input.sessionId } : {}), ...(input.taskId ? { taskId: input.taskId } : {}), action: input.action, argumentsHash: hashToolArguments(input.arguments), status: "pending", reason: input.reason, createdAt: new Date().toISOString() };
    let event!: CrewEvent;
    this.database.transaction(() => {
      this.database.db.prepare(`INSERT INTO approvals(id, project_id, agent_id, session_id, task_id, action, arguments_hash, status, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`)
        .run(approval.id, approval.projectId, approval.agentId, approval.sessionId ?? null, approval.taskId ?? null, approval.action, approval.argumentsHash, approval.reason ?? null, approval.createdAt);
      event = this.#record("approval.requested", approval, "system", "tool-manager");
    });
    this.bus.publish(event); return approval;
  }

  decide(id: string, decision: "approved" | "rejected" | "changes_requested", decidedBy: string, reason?: string): ToolApproval {
    const current = this.get(id); if (!current || current.status !== "pending") throw new Error(`Approval is not pending: ${id}`);
    const decidedAt = new Date().toISOString(); let approval!: ToolApproval; let event!: CrewEvent;
    this.database.transaction(() => {
      const result = this.database.db.prepare("UPDATE approvals SET status = ?, reason = COALESCE(?, reason), decided_at = ?, decided_by = ? WHERE id = ? AND status = 'pending'").run(decision, reason ?? null, decidedAt, decidedBy, id);
      if (Number(result.changes) !== 1) throw new Error(`Approval decision raced: ${id}`);
      approval = this.get(id)!;
      event = this.#record(decision === "approved" ? "approval.approved" : "approval.rejected", approval, "human", decidedBy);
    });
    this.bus.publish(event); return approval;
  }

  cancelPending(id: string, reason: string): ToolApproval {
    const current = this.get(id); if (!current || current.status !== "pending") throw new Error(`Approval is not pending: ${id}`);
    const decidedAt = new Date().toISOString(); let approval!: ToolApproval; let event!: CrewEvent;
    this.database.transaction(() => {
      this.database.db.prepare("UPDATE approvals SET status = 'rejected', reason = ?, decided_at = ?, decided_by = 'system' WHERE id = ? AND status = 'pending'").run(reason, decidedAt, id);
      approval = this.get(id)!; event = this.#record("approval.rejected", approval, "system", "workflow-engine");
    });
    this.bus.publish(event); return approval;
  }

  get(id: string): ToolApproval | undefined {
    const row = this.database.db.prepare("SELECT * FROM approvals WHERE id = ?").get(id) as unknown as Row | undefined;
    return row ? { id: row.id, projectId: row.project_id, agentId: row.agent_id, ...(row.session_id ? { sessionId: row.session_id } : {}), ...(row.task_id ? { taskId: row.task_id } : {}), action: row.action, argumentsHash: row.arguments_hash, status: row.status, ...(row.reason ? { reason: row.reason } : {}), createdAt: row.created_at, ...(row.decided_at ? { decidedAt: row.decided_at } : {}), ...(row.decided_by ? { decidedBy: row.decided_by } : {}), ...(row.consumed_at ? { consumedAt: row.consumed_at } : {}) } : undefined;
  }

  consumeApproved(id: string, input: { projectId: string; agentId: string; action: string; arguments: unknown }): void {
    const approval = this.get(id);
    if (!approval || approval.status !== "approved" || approval.consumedAt || approval.projectId !== input.projectId || approval.agentId !== input.agentId || approval.action !== input.action || approval.argumentsHash !== hashToolArguments(input.arguments)) throw new Error("Approval does not authorize this exact tool call");
    const result = this.database.db.prepare("UPDATE approvals SET consumed_at = ? WHERE id = ? AND status = 'approved' AND consumed_at IS NULL").run(new Date().toISOString(), id);
    if (Number(result.changes) !== 1) throw new Error("Approval has already been consumed");
  }

  #record(type: "approval.requested" | "approval.approved" | "approval.rejected", approval: ToolApproval, actorType: "system" | "human", actorId: string): CrewEvent {
    const event = createCrewEvent({ type, projectId: approval.projectId, actor: { type: actorType, id: actorId }, payload: { approvalId: approval.id, agentId: approval.agentId, taskId: approval.taskId, action: approval.action, status: approval.status }, correlationId: approval.taskId ?? approval.id });
    this.events.append(event); this.audit.append({ projectId: approval.projectId, actorId, actorType, action: type, target: approval.id, metadata: event.payload as Record<string, unknown>, createdAt: event.createdAt }); return event;
  }
}
