import { describe, expect, it } from "vitest";

import { SqliteAuditStore } from "../audit/sqlite-audit-store.ts";
import { createAgentIdentity } from "../crew-core/identity.ts";
import { createCrewEvent } from "../crew-core/events.ts";
import { AgentIdentityStore } from "./agent-identity-store.ts";
import { CrewDatabase } from "./crew-database.ts";
import { CrewEventStore } from "./event-store.ts";

describe("Phase 1 SQLite stores", () => {
  it("persists agent identities independently from runtime sessions", () => {
    const database = new CrewDatabase(":memory:");
    try {
      const store = new AgentIdentityStore(database);
      store.create(createAgentIdentity({ id: "agent-1", name: "Architect", role: "Design", createdAt: "2026-09-10T10:00:00.000Z" }));
      expect(store.get("agent-1")).toEqual({ id: "agent-1", name: "Architect", role: "Design", status: "offline", createdAt: "2026-09-10T10:00:00.000Z" });
      expect(store.setStatus("agent-1", "idle")).toBe(true);
      expect(store.get("agent-1")?.status).toBe("idle");
    } finally {
      database.close();
    }
  });

  it("appends and replays correlated immutable events", () => {
    const database = new CrewDatabase(":memory:");
    try {
      const store = new CrewEventStore(database);
      const first = createCrewEvent({ id: "event-1", type: "task.created", projectId: "project-1", actor: { type: "human", id: "user" }, payload: { secret: "not-secret" }, createdAt: "2026-09-10T10:00:00.000Z" });
      const second = createCrewEvent({ id: "event-2", type: "task.started", projectId: "project-1", actor: { type: "agent", id: "agent-1" }, payload: {}, createdAt: "2026-09-10T10:00:01.000Z", correlationId: "workflow-1", causationId: "event-1" });
      expect(store.appendBatch([first, second])).toEqual([1, 2]);
      expect(store.list({ projectId: "project-1", afterSequence: 1 })).toEqual([{ sequence: 2, event: second }]);
      expect(() => database.db.prepare("UPDATE events SET event_type = 'task.failed' WHERE id = 'event-1'").run()).toThrow("events are immutable");
      expect(() => database.db.prepare("DELETE FROM events WHERE id = 'event-1'").run()).toThrow("events are immutable");
    } finally {
      database.close();
    }
  });

  it("rolls back the whole event batch on duplicate input", () => {
    const database = new CrewDatabase(":memory:");
    try {
      const store = new CrewEventStore(database);
      const duplicate = createCrewEvent({ id: "same", type: "task.created", projectId: "project-1", actor: { type: "system", id: "core" }, payload: {} });
      expect(() => store.appendBatch([duplicate, duplicate])).toThrow();
      expect(store.list({ projectId: "project-1" })).toEqual([]);
    } finally {
      database.close();
    }
  });

  it("redacts secrets and verifies the per-project audit hash chain", () => {
    const database = new CrewDatabase(":memory:");
    try {
      const store = new SqliteAuditStore(database);
      const first = store.append({ projectId: "project-1", actorId: "agent-1", actorType: "agent", action: "tool.execute", target: "shell", metadata: { apiKey: "top-secret", command: "echo ok" }, createdAt: "2026-09-10T10:00:00.000Z" });
      const second = store.append({ projectId: "project-1", actorId: "user", actorType: "human", action: "approval.approved", metadata: {}, createdAt: "2026-09-10T10:00:01.000Z" });
      expect(first.metadata).toEqual({ apiKey: "[REDACTED]", command: "echo ok" });
      expect(second.previousHash).toBe(first.entryHash);
      expect(store.verify("project-1")).toBe(true);
      expect(() => database.db.prepare("DELETE FROM audit_entries WHERE id = ?").run(first.id)).toThrow("audit entries are immutable");
    } finally {
      database.close();
    }
  });
});
