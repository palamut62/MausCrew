export class AgentSessionStore {
    database;
    constructor(database) {
        this.database = database;
    }
    start(session) {
        this.database.db.prepare(`
      INSERT INTO agent_sessions(
        id, project_id, agent_id, provider, model, current_task_id, permissions_json,
        tools_json, context_json, memory_json, started_at, last_heartbeat_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(session.id, session.projectId, session.agentId, session.provider, session.model, session.currentTaskId ?? null, JSON.stringify(session.permissions), JSON.stringify(session.tools), JSON.stringify(session.context), JSON.stringify(session.memory), session.startedAt, session.lastHeartbeatAt);
    }
    get(id) {
        const row = this.database.db.prepare("SELECT * FROM agent_sessions WHERE id = ?").get(id);
        return row ? this.#fromRow(row) : null;
    }
    active() {
        const rows = this.database.db.prepare("SELECT * FROM agent_sessions WHERE ended_at IS NULL ORDER BY started_at ASC").all();
        return rows.map((row) => this.#fromRow(row));
    }
    latestForAgent(agentId) {
        const row = this.database.db.prepare("SELECT * FROM agent_sessions WHERE agent_id = ? ORDER BY started_at DESC, rowid DESC LIMIT 1").get(agentId);
        return row ? this.#fromRow(row) : null;
    }
    heartbeat(id, timestamp) {
        return this.database.db
            .prepare("UPDATE agent_sessions SET last_heartbeat_at = ? WHERE id = ? AND ended_at IS NULL")
            .run(timestamp, id).changes === 1;
    }
    end(id, stopReason, endedAt = new Date().toISOString()) {
        return this.database.db
            .prepare("UPDATE agent_sessions SET ended_at = ?, stop_reason = ? WHERE id = ? AND ended_at IS NULL")
            .run(endedAt, stopReason, id).changes === 1;
    }
    #fromRow(row) {
        return {
            id: row.id,
            projectId: row.project_id,
            agentId: row.agent_id,
            provider: row.provider,
            model: row.model,
            permissions: JSON.parse(row.permissions_json),
            tools: JSON.parse(row.tools_json),
            ...(row.current_task_id ? { currentTaskId: row.current_task_id } : {}),
            context: JSON.parse(row.context_json),
            memory: JSON.parse(row.memory_json),
            startedAt: row.started_at,
            lastHeartbeatAt: row.last_heartbeat_at,
            ...(row.ended_at ? { endedAt: row.ended_at } : {}),
            ...(row.stop_reason ? { stopReason: row.stop_reason } : {}),
        };
    }
}
