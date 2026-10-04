import type { AgentIdentity } from "../crew-core/identity.ts";
import { AGENT_STATUSES, type AgentStatus } from "../crew-core/status-machine.ts";
import type { CrewDatabase } from "./crew-database.ts";

interface AgentRow {
  id: string;
  name: string;
  role: string;
  avatar: string | null;
  status: string;
  created_at: string;
}

const statuses = new Set<string>(AGENT_STATUSES);

export class AgentIdentityStore {
  constructor(readonly database: CrewDatabase) {}

  create(identity: AgentIdentity): AgentIdentity {
    this.database.db
      .prepare("INSERT INTO agents(id, name, role, avatar, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'offline', ?, ?)")
      .run(identity.id, identity.name, identity.role, identity.avatar ?? null, identity.createdAt, identity.createdAt);
    return structuredClone(identity);
  }

  get(id: string): (AgentIdentity & { status: AgentStatus }) | null {
    const row = this.database.db.prepare("SELECT id, name, role, avatar, status, created_at FROM agents WHERE id = ?").get(id) as unknown as AgentRow | undefined;
    if (!row || !statuses.has(row.status)) return null;
    return {
      id: row.id,
      name: row.name,
      role: row.role,
      ...(row.avatar ? { avatar: row.avatar } : {}),
      status: row.status as AgentStatus,
      createdAt: row.created_at,
    };
  }

  setStatus(id: string, status: AgentStatus, updatedAt = new Date().toISOString()): boolean {
    return this.database.db.prepare("UPDATE agents SET status = ?, updated_at = ? WHERE id = ?").run(status, updatedAt, id).changes === 1;
  }
}
