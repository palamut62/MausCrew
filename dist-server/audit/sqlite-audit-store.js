import { createHash, randomUUID } from "node:crypto";
import { redactAuditValue } from "./audit-store.js";
function canonical(value) {
    if (Array.isArray(value))
        return `[${value.map(canonical).join(",")}]`;
    if (value && typeof value === "object") {
        return `{${Object.entries(value)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, nested]) => `${JSON.stringify(key)}:${canonical(nested)}`)
            .join(",")}}`;
    }
    return JSON.stringify(value);
}
function hashEntry(entry) {
    return createHash("sha256").update(canonical(entry)).digest("hex");
}
export class SqliteAuditStore {
    database;
    constructor(database) {
        this.database = database;
    }
    append(draft) {
        return this.database.transaction(() => {
            const previous = this.database.db
                .prepare("SELECT entry_hash FROM audit_entries WHERE project_id = ? ORDER BY sequence DESC LIMIT 1")
                .get(draft.projectId);
            const base = {
                id: draft.id ?? randomUUID(),
                projectId: draft.projectId,
                actorId: draft.actorId,
                actorType: draft.actorType,
                action: draft.action,
                ...(draft.target ? { target: draft.target } : {}),
                metadata: JSON.parse(JSON.stringify(redactAuditValue(draft.metadata ?? {}) ?? {})),
                createdAt: draft.createdAt ?? new Date().toISOString(),
                ...(previous ? { previousHash: previous.entry_hash } : {}),
            };
            const entry = { ...base, entryHash: hashEntry(base) };
            this.database.db.prepare(`
        INSERT INTO audit_entries(id, project_id, actor_type, actor_id, action, target, metadata_json, previous_hash, entry_hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(entry.id, entry.projectId, entry.actorType, entry.actorId, entry.action, entry.target ?? null, JSON.stringify(entry.metadata ?? {}), entry.previousHash ?? null, entry.entryHash, entry.createdAt);
            return entry;
        });
    }
    list(projectId, limit = 100) {
        const rows = this.database.db.prepare(`
      SELECT id, project_id, actor_id, actor_type, action, target, metadata_json, previous_hash, entry_hash, created_at
      FROM audit_entries WHERE project_id = ? ORDER BY sequence ASC LIMIT ?
    `).all(projectId, Math.min(Math.max(limit, 1), 1_000));
        return rows.map((row) => this.#fromRow(row));
    }
    verify(projectId) {
        const rows = this.database.db.prepare(`
      SELECT id, project_id, actor_id, actor_type, action, target, metadata_json, previous_hash, entry_hash, created_at
      FROM audit_entries WHERE project_id = ? ORDER BY sequence ASC
    `).all(projectId);
        let previousHash;
        for (const row of rows) {
            const entry = this.#fromRow(row);
            if (entry.previousHash !== previousHash)
                return false;
            const { entryHash, ...base } = entry;
            if (hashEntry(base) !== entryHash)
                return false;
            previousHash = entryHash;
        }
        return true;
    }
    #fromRow(row) {
        return {
            id: row.id,
            projectId: row.project_id,
            actorId: row.actor_id,
            actorType: row.actor_type,
            action: row.action,
            ...(row.target ? { target: row.target } : {}),
            metadata: JSON.parse(row.metadata_json),
            createdAt: row.created_at,
            ...(row.previous_hash ? { previousHash: row.previous_hash } : {}),
            entryHash: row.entry_hash,
        };
    }
}
