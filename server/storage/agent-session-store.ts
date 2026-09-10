import type { AgentSession } from "../runtime/agent-session.ts";
import type { CrewDatabase } from "./crew-database.ts";

interface SessionRow {
  id: string;
  project_id: string;
  agent_id: string;
  provider: string;
  model: string;
  current_task_id: string | null;
  permissions_json: string;
  tools_json: string;
  context_json: string;
  memory_json: string;
  started_at: string;
  last_heartbeat_at: string;
  ended_at: string | null;
  stop_reason: string | null;
}

export class AgentSessionStore {
  constructor(readonly database: CrewDatabase) {}

  start(session: AgentSession): void {
    this.database.db.prepare(`
      INSERT INTO agent_sessions(
        id, project_id, agent_id, provider, model, current_task_id, permissions_json,
        tools_json, context_json, memory_json, started_at, last_heartbeat_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      session.id,
      session.projectId,
      session.agentId,
      session.provider,
      session.model,
      session.currentTaskId ?? null,
      JSON.stringify(session.permissions),
      JSON.stringify(session.tools),
      JSON.stringify(session.context),
      JSON.stringify(session.memory),
      session.startedAt,
      session.lastHeartbeatAt,
    );
  }

  get(id: string): AgentSession | null {
    const row = this.database.db.prepare("SELECT * FROM agent_sessions WHERE id = ?").get(id) as unknown as SessionRow | undefined;
    return row ? this.#fromRow(row) : null;
  }

  active(): AgentSession[] {
    const rows = this.database.db.prepare("SELECT * FROM agent_sessions WHERE ended_at IS NULL ORDER BY started_at ASC").all() as unknown as SessionRow[];
    return rows.map((row) => this.#fromRow(row));
  }

  heartbeat(id: string, timestamp: string): boolean {
    return this.database.db
      .prepare("UPDATE agent_sessions SET last_heartbeat_at = ? WHERE id = ? AND ended_at IS NULL")
      .run(timestamp, id).changes === 1;
  }

  end(id: string, stopReason: string, endedAt = new Date().toISOString()): boolean {
    return this.database.db
      .prepare("UPDATE agent_sessions SET ended_at = ?, stop_reason = ? WHERE id = ? AND ended_at IS NULL")
      .run(endedAt, stopReason, id).changes === 1;
  }

  #fromRow(row: SessionRow): AgentSession {
    return {
      id: row.id,
      projectId: row.project_id,
      agentId: row.agent_id,
      provider: row.provider,
      model: row.model,
      permissions: JSON.parse(row.permissions_json) as Record<string, unknown>,
      tools: JSON.parse(row.tools_json) as string[],
      ...(row.current_task_id ? { currentTaskId: row.current_task_id } : {}),
      context: JSON.parse(row.context_json) as Record<string, unknown>,
      memory: JSON.parse(row.memory_json) as Record<string, unknown>,
      startedAt: row.started_at,
      lastHeartbeatAt: row.last_heartbeat_at,
      ...(row.ended_at ? { endedAt: row.ended_at } : {}),
      ...(row.stop_reason ? { stopReason: row.stop_reason } : {}),
    };
  }
}
