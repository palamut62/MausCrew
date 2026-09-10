import { redactAuditValue } from "../audit/audit-store.ts";
import type { CrewDatabase } from "./crew-database.ts";

export type ToolCallStatus = "started" | "completed" | "failed" | "cancelled";
export interface StoredToolCall {
  id: string; projectId: string; agentId: string; sessionId?: string; taskId?: string; tool: string;
  status: ToolCallStatus; startedAt: string; endedAt?: string;
}
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
  activeForAgent(agentId: string): StoredToolCall | null {
    const row = this.database.db.prepare("SELECT id, project_id, agent_id, session_id, task_id, tool, status, started_at, ended_at FROM tool_calls WHERE agent_id = ? AND status = 'started' ORDER BY started_at DESC LIMIT 1").get(agentId) as Record<string, string | null> | undefined;
    return row ? { id: row.id!, projectId: row.project_id!, agentId: row.agent_id!, ...(row.session_id ? { sessionId: row.session_id } : {}), ...(row.task_id ? { taskId: row.task_id } : {}), tool: row.tool!, status: row.status as ToolCallStatus, startedAt: row.started_at!, ...(row.ended_at ? { endedAt: row.ended_at } : {}) } : null;
  }
}
