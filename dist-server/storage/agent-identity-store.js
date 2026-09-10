import { AGENT_STATUSES } from "../crew-core/status-machine.js";
const statuses = new Set(AGENT_STATUSES);
export class AgentIdentityStore {
    database;
    constructor(database) {
        this.database = database;
    }
    create(identity) {
        this.database.db
            .prepare("INSERT INTO agents(id, name, role, avatar, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'offline', ?, ?)")
            .run(identity.id, identity.name, identity.role, identity.avatar ?? null, identity.createdAt, identity.createdAt);
        return structuredClone(identity);
    }
    get(id) {
        const row = this.database.db.prepare("SELECT id, name, role, avatar, status, created_at FROM agents WHERE id = ?").get(id);
        if (!row || !statuses.has(row.status))
            return null;
        return {
            id: row.id,
            name: row.name,
            role: row.role,
            ...(row.avatar ? { avatar: row.avatar } : {}),
            status: row.status,
            createdAt: row.created_at,
        };
    }
    setStatus(id, status, updatedAt = new Date().toISOString()) {
        return this.database.db.prepare("UPDATE agents SET status = ?, updated_at = ? WHERE id = ?").run(status, updatedAt, id).changes === 1;
    }
}
