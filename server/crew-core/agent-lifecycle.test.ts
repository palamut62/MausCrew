import { describe, expect, it } from "vitest";

import { SqliteAuditStore } from "../audit/sqlite-audit-store.ts";
import { AgentIdentityStore } from "../storage/agent-identity-store.ts";
import { CrewDatabase } from "../storage/crew-database.ts";
import { CrewEventStore } from "../storage/event-store.ts";
import { AgentLifecycleService } from "./agent-lifecycle.ts";
import { CrewEventBus } from "./event-bus.ts";
import { createAgentIdentity } from "./identity.ts";
import { InvalidAgentStatusTransitionError } from "./status-machine.ts";

function harness() {
  const database = new CrewDatabase(":memory:");
  const identities = new AgentIdentityStore(database);
  const events = new CrewEventStore(database);
  const audit = new SqliteAuditStore(database);
  const bus = new CrewEventBus();
  return { database, identities, events, audit, bus, service: new AgentLifecycleService(database, identities, events, audit, bus) };
}

describe("AgentLifecycleService", () => {
  it("commits identity, event and audit before publishing", async () => {
    const app = harness();
    try {
      const observed: string[] = [];
      app.bus.subscribe("projection", (event) => {
        observed.push(`${event.type}:${app.events.list({ projectId: "project-1" }).length}:${app.audit.list("project-1").length}`);
      });
      const identity = createAgentIdentity({ id: "agent-1", name: "Architect", role: "Design" });
      app.service.create("project-1", identity, { type: "human", id: "user" });
      app.service.transition({ projectId: "project-1", agentId: "agent-1", to: "idle", actor: { type: "system", id: "runtime" } });
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(app.identities.get("agent-1")?.status).toBe("idle");
      expect(observed).toEqual(["agent.created:2:2", "agent.status_changed:2:2"]);
      expect(app.audit.verify("project-1")).toBe(true);
    } finally {
      app.database.close();
    }
  });

  it("rejects an invalid transition before any persistent mutation", () => {
    const app = harness();
    try {
      app.service.create("project-1", createAgentIdentity({ id: "agent-1", name: "Architect", role: "Design" }), { type: "human", id: "user" });
      expect(() => app.service.transition({ projectId: "project-1", agentId: "agent-1", to: "completed", actor: { type: "system", id: "runtime" } }))
        .toThrow(InvalidAgentStatusTransitionError);
      expect(app.identities.get("agent-1")?.status).toBe("offline");
      expect(app.events.list({ projectId: "project-1" })).toHaveLength(1);
      expect(app.audit.list("project-1")).toHaveLength(1);
    } finally {
      app.database.close();
    }
  });
});
