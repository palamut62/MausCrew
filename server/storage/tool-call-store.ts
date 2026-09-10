import { redactAuditValue } from "../audit/audit-store.ts";
import type { CrewDatabase } from "./crew-database.ts";

export type ToolCallStatus = "started" | "completed" | "failed" | "cancelled";
export class ToolCallStore {
  constructor(readonly database: CrewDatabase) {}
  start(input: { id: string; projectId: string; agentId: string; sessionId?: string; taskId?: string; tool: string; arguments: unknown; startedAt: string }): void {
    this.database.db.prepare(`INSERT INTO tool_calls(id, project_id, agent_id, session_id, task_id, tool, arguments_json, status, started_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'started', ?)`)
      .run(input.id, input.projectId, input.agentId, input.sessionId ?? null, input.taskId ?? null, input.tool, JSON.stringify(redactAuditValue(input.arguments) ?? null), input.startedAt);
  }
  finish(id: string, status: Exclude<ToolCallStatus, "started">, input: { result?: unknown; error?: string; endedAt: string }): void {
    const result = this.database.db.prepare("UPDATE tool_calls SET status = ?, result_json = ?, error = ?, ended_at = ? WHERE id = ? AND status = 'started'")
      .run(status, input.result === undefined ? null : JSON.stringify(redactAuditValue(input.result) ?? null), input.error ?? null, input.endedAt, id);
    if (Number(result.changes) !== 1) throw new Error(`Tool call is not active: ${id}`);
  }
}
