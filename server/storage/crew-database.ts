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
