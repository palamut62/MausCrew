import { afterEach, describe, expect, it, vi } from "vitest";

import { SqliteAuditStore } from "../audit/sqlite-audit-store.ts";
import { AgentLifecycleService } from "../crew-core/agent-lifecycle.ts";
import { CrewEventBus } from "../crew-core/event-bus.ts";
import { createAgentIdentity } from "../crew-core/identity.ts";
import { AgentIdentityStore } from "../storage/agent-identity-store.ts";
import { AgentSessionStore } from "../storage/agent-session-store.ts";
import { CrewDatabase } from "../storage/crew-database.ts";
import { CrewEventStore } from "../storage/event-store.ts";
import { AgentRuntimeSession } from "./agent-runtime-session.ts";
import { createAgentSession } from "./agent-session.ts";
import { AgentHeartbeatService } from "./heartbeat.ts";

function harness(now = Date.parse("2026-09-10T10:00:00.000Z"), staleAfterMs = 30_000) {
  const database = new CrewDatabase(":memory:");
  const identities = new AgentIdentityStore(database);
  const events = new CrewEventStore(database);
  const audit = new SqliteAuditStore(database);
  const bus = new CrewEventBus();
  const lifecycle = new AgentLifecycleService(database, identities, events, audit, bus);
  const sessions = new AgentSessionStore(database);
  let clock = now;
  const heartbeats = new AgentHeartbeatService(database, sessions, identities, events, audit, lifecycle, bus, staleAfterMs, () => clock);
  lifecycle.create("project-1", createAgentIdentity({ id: "agent-1", name: "Worker", role: "Build", createdAt: new Date(now).toISOString() }), { type: "human", id: "user" });
  return { database, identities, events, audit, bus, lifecycle, sessions, heartbeats, setClock: (value: number) => { clock = value; } };
}

afterEach(() => vi.useRealTimers());

describe("agent runtime foundations", () => {
  it("persists isolated session state and completion", () => {
    const app = harness();
    try {
      const session = createAgentSession({ id: "session-1", projectId: "project-1", agentId: "agent-1", provider: "codex", model: "gpt", permissions: { shell: "ask" }, tools: ["git.status"], context: { turn: 1 }, memory: { note: "local" }, startedAt: "2026-09-10T10:00:00.000Z" });
      app.sessions.start(session);
      session.context.turn = 2;
      expect(app.sessions.get("session-1")).toMatchObject({ context: { turn: 1 }, memory: { note: "local" } });
      expect(app.sessions.end("session-1", "completed", "2026-09-10T10:01:00.000Z")).toBe(true);
      expect(app.sessions.active()).toEqual([]);
      expect(app.sessions.get("session-1")).toMatchObject({ endedAt: "2026-09-10T10:01:00.000Z", stopReason: "completed" });
    } finally {
      app.database.close();
    }
  });

  it("records heartbeats and marks an expired active agent stale", () => {
    const start = Date.parse("2026-09-10T10:00:00.000Z");
    const app = harness(start, 30_000);
    try {
      app.sessions.start(createAgentSession({ id: "session-1", projectId: "project-1", agentId: "agent-1", provider: "codex", model: "gpt", permissions: {}, tools: [], context: {}, memory: {}, startedAt: new Date(start).toISOString() }));
      app.lifecycle.transition({ projectId: "project-1", agentId: "agent-1", to: "idle", actor: { type: "system", id: "runtime" } });
      app.setClock(start + 10_000);
      app.heartbeats.record({ sessionId: "session-1", agentId: "agent-1", status: "idle", currentAction: "waiting" });
      expect(app.heartbeats.markStale()).toEqual([]);
      app.setClock(start + 40_001);
      expect(app.heartbeats.markStale()).toEqual(["agent-1"]);
      expect(app.identities.get("agent-1")?.status).toBe("stale");
      expect(app.events.list({ projectId: "project-1" }).some(({ event }) => event.type === "agent.heartbeat")).toBe(true);
    } finally {
      app.database.close();
    }
  });

  it("emits periodic heartbeat and propagates stop cancellation", async () => {
    vi.useFakeTimers();
    const app = harness();
    try {
      const runtime = new AgentRuntimeSession({ id: "session-1", projectId: "project-1", agentId: "agent-1", provider: "codex", model: "gpt", permissions: {}, tools: [], context: {}, memory: {}, startedAt: "2026-09-10T10:00:00.000Z" }, app.sessions, app.lifecycle, app.heartbeats, 100);
      const tool = runtime.cancellation.child();
      runtime.start();
      await vi.advanceTimersByTimeAsync(250);
      const heartbeatCount = app.events.list({ projectId: "project-1", limit: 100 }).filter(({ event }) => event.type === "agent.heartbeat").length;
      expect(heartbeatCount).toBe(3);
      runtime.stop("user_stop");
      expect(tool.signal.aborted).toBe(true);
      expect(app.sessions.get("session-1")?.stopReason).toBe("user_stop");
      expect(app.identities.get("agent-1")?.status).toBe("offline");
      const eventTypes = app.events.list({ projectId: "project-1", limit: 100 }).map(({ event }) => event.type);
      expect(eventTypes).toContain("agent.started");
      expect(eventTypes).toContain("agent.stopped");
      expect(app.audit.verify("project-1")).toBe(true);
    } finally {
      app.database.close();
    }
  });

  it("rejects a second active session for the same agent", () => {
    const app = harness();
    try {
      const base = { projectId: "project-1", agentId: "agent-1", provider: "codex", model: "gpt", permissions: {}, tools: [], context: {}, memory: {} };
      app.sessions.start(createAgentSession({ ...base, id: "session-1" }));
      expect(() => app.sessions.start(createAgentSession({ ...base, id: "session-2" }))).toThrow();
      expect(app.sessions.active()).toHaveLength(1);
    } finally {
      app.database.close();
    }
  });
});
