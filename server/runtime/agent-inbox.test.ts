import { describe, expect, it } from "vitest";

import { AgentIdentityStore } from "../storage/agent-identity-store.ts";
import { AgentInboxStore } from "../storage/agent-inbox-store.ts";
import { CrewDatabase } from "../storage/crew-database.ts";
import { createAgentIdentity } from "../crew-core/identity.ts";

function harness(capacity = 4) {
  const database = new CrewDatabase(":memory:");
  new AgentIdentityStore(database).create(createAgentIdentity({ id: "agent-1", name: "Worker", role: "Build" }));
  return { database, inbox: new AgentInboxStore(database, capacity) };
}

describe("AgentInboxStore", () => {
  it("claims by priority then FIFO and completes exactly once", () => {
    const app = harness();
    try {
      app.inbox.enqueue({ id: "low", projectId: "p", agentId: "agent-1", kind: "message", priority: "low", payload: {} });
      app.inbox.enqueue({ id: "high-1", projectId: "p", agentId: "agent-1", kind: "task", priority: "high", payload: {} });
      app.inbox.enqueue({ id: "high-2", projectId: "p", agentId: "agent-1", kind: "task", priority: "high", payload: {} });
      expect(app.inbox.claim("agent-1")?.id).toBe("high-1");
      const second = app.inbox.claim("agent-1");
      expect(second?.id).toBe("high-2");
      expect(app.inbox.complete(second!.id)).toBe(true);
      expect(app.inbox.complete(second!.id)).toBe(false);
    } finally {
      app.database.close();
    }
  });

  it("rejects equal/lower priority overflow and evicts the oldest weaker item", () => {
    const app = harness(2);
    try {
      app.inbox.enqueue({ id: "low", projectId: "p", agentId: "agent-1", kind: "message", priority: "low", payload: {} });
      app.inbox.enqueue({ id: "normal", projectId: "p", agentId: "agent-1", kind: "task", priority: "normal", payload: {} });
      expect(app.inbox.enqueue({ id: "another-low", projectId: "p", agentId: "agent-1", kind: "message", priority: "low", payload: {} })).toEqual({ accepted: false, reason: "capacity" });
      expect(app.inbox.enqueue({ id: "critical", projectId: "p", agentId: "agent-1", kind: "system_event", priority: "critical", payload: {} })).toMatchObject({ accepted: true, evictedId: "low" });
      expect(app.inbox.queueLength("agent-1")).toBe(2);
      expect(app.inbox.claim("agent-1")?.id).toBe("critical");
    } finally {
      app.database.close();
    }
  });
});
