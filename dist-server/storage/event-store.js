import { createCrewEvent } from "../crew-core/events.js";
export class CrewEventStore {
    database;
    constructor(database) {
        this.database = database;
    }
    append(event) {
        const validated = createCrewEvent(event);
        const result = this.database.db.prepare(`
      INSERT INTO events(id, project_id, event_type, actor_type, actor_id, payload_json, correlation_id, causation_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(validated.id, validated.projectId, validated.type, validated.actor.type, validated.actor.id, JSON.stringify(validated.payload ?? null), validated.correlationId ?? null, validated.causationId ?? null, validated.createdAt);
        return Number(result.lastInsertRowid);
    }
    appendBatch(events) {
        return this.database.transaction(() => events.map((event) => this.append(event)));
    }
    list(input) {
        const limit = Math.min(Math.max(input.limit ?? 100, 1), 1_000);
        const rows = this.database.db.prepare(`
      SELECT sequence, id, project_id, event_type, actor_type, actor_id, payload_json, correlation_id, causation_id, created_at
      FROM events WHERE project_id = ? AND sequence > ? ORDER BY sequence ASC LIMIT ?
    `).all(input.projectId, input.afterSequence ?? 0, limit);
        return rows.map((row) => ({ sequence: row.sequence, event: this.#fromRow(row) }));
    }
    recent(input) {
        const limit = Math.min(Math.max(input.limit ?? 100, 1), 1_000);
        const rows = this.database.db.prepare(`
      SELECT sequence, id, project_id, event_type, actor_type, actor_id, payload_json, correlation_id, causation_id, created_at
      FROM events WHERE project_id = ? ORDER BY sequence DESC LIMIT ?
    `).all(input.projectId, limit);
        return rows.reverse().map((row) => ({ sequence: row.sequence, event: this.#fromRow(row) }));
    }
    #fromRow(row) {
        return {
            id: row.id,
            type: row.event_type,
            projectId: row.project_id,
            actor: { type: row.actor_type, id: row.actor_id },
            payload: JSON.parse(row.payload_json),
            createdAt: row.created_at,
            ...(row.correlation_id ? { correlationId: row.correlation_id } : {}),
            ...(row.causation_id ? { causationId: row.causation_id } : {}),
        };
    }
}
