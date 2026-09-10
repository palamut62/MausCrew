import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { DATA_DIR } from "../config.ts";

export const CREW_DATABASE_PATH = join(DATA_DIR, "crew-core.sqlite");

const MIGRATIONS = [
  `
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      avatar TEXT,
      status TEXT NOT NULL DEFAULT 'offline',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS events (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL UNIQUE,
      project_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      actor_type TEXT NOT NULL CHECK (actor_type IN ('human', 'agent', 'system')),
      actor_id TEXT NOT NULL,
      payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
      correlation_id TEXT,
      causation_id TEXT,
      created_at TEXT NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS events_project_sequence_idx ON events(project_id, sequence);
    CREATE INDEX IF NOT EXISTS events_correlation_idx ON events(correlation_id) WHERE correlation_id IS NOT NULL;

    CREATE TRIGGER IF NOT EXISTS events_no_update
    BEFORE UPDATE ON events BEGIN SELECT RAISE(ABORT, 'events are immutable'); END;
    CREATE TRIGGER IF NOT EXISTS events_no_delete
    BEFORE DELETE ON events BEGIN SELECT RAISE(ABORT, 'events are immutable'); END;

    CREATE TABLE IF NOT EXISTS audit_entries (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL UNIQUE,
      project_id TEXT NOT NULL,
      actor_type TEXT NOT NULL CHECK (actor_type IN ('human', 'agent', 'system')),
      actor_id TEXT NOT NULL,
      action TEXT NOT NULL,
      target TEXT,
      metadata_json TEXT NOT NULL CHECK (json_valid(metadata_json)),
      previous_hash TEXT,
      entry_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    ) STRICT;
    CREATE UNIQUE INDEX IF NOT EXISTS audit_project_hash_idx ON audit_entries(project_id, entry_hash);
    CREATE TRIGGER IF NOT EXISTS audit_no_update
    BEFORE UPDATE ON audit_entries BEGIN SELECT RAISE(ABORT, 'audit entries are immutable'); END;
    CREATE TRIGGER IF NOT EXISTS audit_no_delete
    BEFORE DELETE ON audit_entries BEGIN SELECT RAISE(ABORT, 'audit entries are immutable'); END;
  `,
  `
    CREATE TABLE IF NOT EXISTS agent_sessions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      current_task_id TEXT,
      permissions_json TEXT NOT NULL CHECK (json_valid(permissions_json)),
      tools_json TEXT NOT NULL CHECK (json_valid(tools_json)),
      context_json TEXT NOT NULL CHECK (json_valid(context_json)),
      memory_json TEXT NOT NULL CHECK (json_valid(memory_json)),
      started_at TEXT NOT NULL,
      last_heartbeat_at TEXT NOT NULL,
      ended_at TEXT,
      stop_reason TEXT
    ) STRICT;
    CREATE INDEX IF NOT EXISTS agent_sessions_active_idx ON agent_sessions(agent_id, ended_at, last_heartbeat_at);
    CREATE UNIQUE INDEX IF NOT EXISTS agent_sessions_one_active_agent_idx ON agent_sessions(agent_id) WHERE ended_at IS NULL;

    CREATE TABLE IF NOT EXISTS agent_inbox (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL UNIQUE,
      project_id TEXT NOT NULL,
      agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
      kind TEXT NOT NULL CHECK (kind IN ('task', 'handoff', 'message', 'review', 'system_event')),
      priority TEXT NOT NULL CHECK (priority IN ('critical', 'high', 'normal', 'low')),
      payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
      source_event_id TEXT,
      state TEXT NOT NULL CHECK (state IN ('queued', 'claimed', 'completed', 'dead_letter')),
      attempts INTEGER NOT NULL DEFAULT 0,
      available_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      claimed_at TEXT,
      completed_at TEXT,
      error TEXT
    ) STRICT;
    CREATE INDEX IF NOT EXISTS agent_inbox_ready_idx ON agent_inbox(agent_id, state, available_at, priority, sequence);
  `,
] as const;

export class CrewDatabase {
  readonly db: DatabaseSync;
  #transactionDepth = 0;

  constructor(path = CREW_DATABASE_PATH) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA foreign_keys = ON");
    this.db.exec("PRAGMA busy_timeout = 5000");
    if (path !== ":memory:") this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL) STRICT");
    this.#migrate();
  }

  close(): void {
    this.db.close();
  }

  transaction<T>(operation: () => T): T {
    if (this.#transactionDepth > 0) return operation();
    this.db.exec("BEGIN IMMEDIATE");
    this.#transactionDepth += 1;
    try {
      const result = operation();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    } finally {
      this.#transactionDepth -= 1;
    }
  }

  #migrate(): void {
    const applied = this.db.prepare("SELECT version FROM schema_migrations").all().map((row) => Number(row.version));
    const appliedVersions = new Set(applied);
    MIGRATIONS.forEach((sql, index) => {
      const version = index + 1;
      if (appliedVersions.has(version)) return;
      this.transaction(() => {
        this.db.exec(sql);
        this.db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)").run(version, new Date().toISOString());
      });
    });
  }
}
