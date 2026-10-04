import { createInboxItem, type AgentInboxDraft, type AgentInboxItem, type InboxPriority } from "../runtime/agent-inbox.ts";
import type { CrewDatabase } from "./crew-database.ts";

const priorityRank: Record<InboxPriority, number> = { critical: 4, high: 3, normal: 2, low: 1 };

interface InboxRow {
  sequence: number;
  id: string;
  project_id: string;
  agent_id: string;
  kind: AgentInboxItem["kind"];
  priority: InboxPriority;
  payload_json: string;
  source_event_id: string | null;
  state: AgentInboxItem["state"];
  attempts: number;
  available_at: string;
  created_at: string;
  claimed_at: string | null;
  completed_at: string | null;
  error: string | null;
}

export interface InboxEnqueueResult {
  accepted: boolean;
  item?: AgentInboxItem;
  evictedId?: string;
  reason?: "capacity";
}

export class AgentInboxStore {
  constructor(readonly database: CrewDatabase, readonly capacityPerAgent = 256) {
    if (!Number.isInteger(capacityPerAgent) || capacityPerAgent < 1) throw new Error("Inbox capacity must be at least 1");
  }

  enqueue(draft: AgentInboxDraft): InboxEnqueueResult {
    return this.database.transaction(() => {
      const item = createInboxItem(draft);
      const queued = this.database.db.prepare(`
        SELECT sequence, id, priority FROM agent_inbox
        WHERE agent_id = ? AND state = 'queued'
        ORDER BY CASE priority WHEN 'low' THEN 1 WHEN 'normal' THEN 2 WHEN 'high' THEN 3 ELSE 4 END ASC, sequence ASC
      `).all(item.agentId) as Array<{ sequence: number; id: string; priority: InboxPriority }>;
      let evictedId: string | undefined;
      if (queued.length >= this.capacityPerAgent) {
        const weakest = queued[0];
        if (priorityRank[item.priority] <= priorityRank[weakest.priority]) return { accepted: false, reason: "capacity" };
        this.database.db.prepare("UPDATE agent_inbox SET state = 'dead_letter', error = 'evicted_by_higher_priority' WHERE id = ?").run(weakest.id);
        evictedId = weakest.id;
      }
      const result = this.database.db.prepare(`
        INSERT INTO agent_inbox(id, project_id, agent_id, kind, priority, payload_json, source_event_id, state, attempts, available_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', 0, ?, ?)
      `).run(item.id, item.projectId, item.agentId, item.kind, item.priority, JSON.stringify(item.payload ?? null), item.sourceEventId ?? null, item.availableAt, item.createdAt);
      item.sequence = Number(result.lastInsertRowid);
      return { accepted: true, item, ...(evictedId ? { evictedId } : {}) };
    });
  }

  claim(agentId: string, now = new Date().toISOString()): AgentInboxItem | null {
    return this.database.transaction(() => {
      const row = this.database.db.prepare(`
        SELECT * FROM agent_inbox WHERE agent_id = ? AND state = 'queued' AND available_at <= ?
        ORDER BY CASE priority WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'normal' THEN 2 ELSE 1 END DESC, sequence ASC LIMIT 1
      `).get(agentId, now) as unknown as InboxRow | undefined;
      if (!row) return null;
      this.database.db.prepare("UPDATE agent_inbox SET state = 'claimed', claimed_at = ?, attempts = attempts + 1 WHERE id = ? AND state = 'queued'").run(now, row.id);
      return this.#fromRow({ ...row, state: "claimed", claimed_at: now, attempts: row.attempts + 1 });
    });
  }

  complete(id: string, completedAt = new Date().toISOString()): boolean {
    return this.database.db.prepare("UPDATE agent_inbox SET state = 'completed', completed_at = ? WHERE id = ? AND state = 'claimed'").run(completedAt, id).changes === 1;
  }

  queueLength(agentId: string): number {
    const row = this.database.db.prepare("SELECT count(*) AS count FROM agent_inbox WHERE agent_id = ? AND state = 'queued'").get(agentId) as { count: number };
    return row.count;
  }

  #fromRow(row: InboxRow): AgentInboxItem {
    return {
      id: row.id,
      sequence: row.sequence,
      projectId: row.project_id,
      agentId: row.agent_id,
      kind: row.kind,
      priority: row.priority,
      payload: JSON.parse(row.payload_json) as unknown,
      ...(row.source_event_id ? { sourceEventId: row.source_event_id } : {}),
      state: row.state,
      attempts: row.attempts,
      availableAt: row.available_at,
      createdAt: row.created_at,
      ...(row.claimed_at ? { claimedAt: row.claimed_at } : {}),
      ...(row.completed_at ? { completedAt: row.completed_at } : {}),
      ...(row.error ? { error: row.error } : {}),
    };
  }
}
