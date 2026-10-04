import type { CrewEvent } from "../crew-core/events.ts";
import { createCrewEvent } from "../crew-core/events.ts";
import type { CrewDatabase } from "./crew-database.ts";

interface EventRow {
  id: string;
  project_id: string;
  event_type: CrewEvent["type"];
  actor_type: CrewEvent["actor"]["type"];
  actor_id: string;
  payload_json: string;
  correlation_id: string | null;
  causation_id: string | null;
  created_at: string;
}

export interface StoredCrewEvent<T = unknown> {
  sequence: number;
  event: CrewEvent<T>;
}

export class CrewEventStore {
  constructor(readonly database: CrewDatabase) {}

  append<T>(event: CrewEvent<T>): number {
    const validated = createCrewEvent(event);
    const result = this.database.db.prepare(`
      INSERT INTO events(id, project_id, event_type, actor_type, actor_id, payload_json, correlation_id, causation_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      validated.id,
      validated.projectId,
      validated.type,
      validated.actor.type,
      validated.actor.id,
      JSON.stringify(validated.payload ?? null),
      validated.correlationId ?? null,
      validated.causationId ?? null,
      validated.createdAt,
    );
    return Number(result.lastInsertRowid);
  }

  appendBatch(events: readonly CrewEvent[]): number[] {
    return this.database.transaction(() => events.map((event) => this.append(event)));
  }

  list(input: { projectId: string; afterSequence?: number; limit?: number }): StoredCrewEvent[] {
    const limit = Math.min(Math.max(input.limit ?? 100, 1), 1_000);
    const rows = this.database.db.prepare(`
      SELECT sequence, id, project_id, event_type, actor_type, actor_id, payload_json, correlation_id, causation_id, created_at
      FROM events WHERE project_id = ? AND sequence > ? ORDER BY sequence ASC LIMIT ?
    `).all(input.projectId, input.afterSequence ?? 0, limit) as unknown as Array<EventRow & { sequence: number }>;
    return rows.map((row) => ({ sequence: row.sequence, event: this.#fromRow(row) }));
  }

  recent(input: { projectId: string; limit?: number }): StoredCrewEvent[] {
    const limit = Math.min(Math.max(input.limit ?? 100, 1), 1_000);
    const rows = this.database.db.prepare(`
      SELECT sequence, id, project_id, event_type, actor_type, actor_id, payload_json, correlation_id, causation_id, created_at
      FROM events WHERE project_id = ? ORDER BY sequence DESC LIMIT ?
    `).all(input.projectId, limit) as unknown as Array<EventRow & { sequence: number }>;
    return rows.reverse().map((row) => ({ sequence: row.sequence, event: this.#fromRow(row) }));
  }

  #fromRow(row: EventRow): CrewEvent {
    return {
      id: row.id,
      type: row.event_type,
      projectId: row.project_id,
      actor: { type: row.actor_type, id: row.actor_id },
      payload: JSON.parse(row.payload_json) as unknown,
      createdAt: row.created_at,
      ...(row.correlation_id ? { correlationId: row.correlation_id } : {}),
      ...(row.causation_id ? { causationId: row.causation_id } : {}),
    };
  }
}
