import { createInboxItem } from "../runtime/agent-inbox.js";
const priorityRank = { critical: 4, high: 3, normal: 2, low: 1 };
export class AgentInboxStore {
    database;
    capacityPerAgent;
    constructor(database, capacityPerAgent = 256) {
        this.database = database;
        this.capacityPerAgent = capacityPerAgent;
        if (!Number.isInteger(capacityPerAgent) || capacityPerAgent < 1)
            throw new Error("Inbox capacity must be at least 1");
    }
    enqueue(draft) {
        return this.database.transaction(() => {
            const item = createInboxItem(draft);
            const queued = this.database.db.prepare(`
        SELECT sequence, id, priority FROM agent_inbox
        WHERE agent_id = ? AND state = 'queued'
        ORDER BY CASE priority WHEN 'low' THEN 1 WHEN 'normal' THEN 2 WHEN 'high' THEN 3 ELSE 4 END ASC, sequence ASC
      `).all(item.agentId);
            let evictedId;
            if (queued.length >= this.capacityPerAgent) {
                const weakest = queued[0];
                if (priorityRank[item.priority] <= priorityRank[weakest.priority])
                    return { accepted: false, reason: "capacity" };
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
    claim(agentId, now = new Date().toISOString()) {
        return this.database.transaction(() => {
            const row = this.database.db.prepare(`
        SELECT * FROM agent_inbox WHERE agent_id = ? AND state = 'queued' AND available_at <= ?
        ORDER BY CASE priority WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'normal' THEN 2 ELSE 1 END DESC, sequence ASC LIMIT 1
      `).get(agentId, now);
            if (!row)
                return null;
            this.database.db.prepare("UPDATE agent_inbox SET state = 'claimed', claimed_at = ?, attempts = attempts + 1 WHERE id = ? AND state = 'queued'").run(now, row.id);
            return this.#fromRow({ ...row, state: "claimed", claimed_at: now, attempts: row.attempts + 1 });
        });
    }
    complete(id, completedAt = new Date().toISOString()) {
        return this.database.db.prepare("UPDATE agent_inbox SET state = 'completed', completed_at = ? WHERE id = ? AND state = 'claimed'").run(completedAt, id).changes === 1;
    }
    queueLength(agentId) {
        const row = this.database.db.prepare("SELECT count(*) AS count FROM agent_inbox WHERE agent_id = ? AND state = 'queued'").get(agentId);
        return row.count;
    }
    #fromRow(row) {
        return {
            id: row.id,
            sequence: row.sequence,
            projectId: row.project_id,
            agentId: row.agent_id,
            kind: row.kind,
            priority: row.priority,
            payload: JSON.parse(row.payload_json),
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
