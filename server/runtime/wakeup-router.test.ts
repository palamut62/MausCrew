import { describe, expect, it } from "vitest";

import { CrewEventBus } from "../crew-core/event-bus.ts";
import { createCrewEvent } from "../crew-core/events.ts";
import { createAgentIdentity } from "../crew-core/identity.ts";
import { AgentIdentityStore } from "../storage/agent-identity-store.ts";
import { AgentInboxStore } from "../storage/agent-inbox-store.ts";
import { CrewDatabase } from "../storage/crew-database.ts";
import { AgentWakeupRouter } from "./wakeup-router.ts";

describe("AgentWakeupRouter", () => {
  it("routes relevant events into a persistent priority inbox and wakes the target", async () => {
    const database = new CrewDatabase(":memory:");
    try {
      new AgentIdentityStore(database).create(createAgentIdentity({ id: "agent-1", name: "Worker", role: "Build" }));
      const inbox = new AgentInboxStore(database);
      const bus = new CrewEventBus();
      const wakeups: string[] = [];
      const router = new AgentWakeupRouter(bus, inbox, (agentId, reason) => { wakeups.push(`${agentId}:${reason}`); });
      router.start();
      bus.publish(createCrewEvent({ id: "assigned", type: "task.assigned", projectId: "p", actor: { type: "system", id: "supervisor" }, payload: { agentId: "agent-1", taskId: "task-1" } }));
      bus.publish(createCrewEvent({ id: "approval", type: "approval.approved", projectId: "p", actor: { type: "human", id: "user" }, payload: { agentId: "agent-1", approvalId: "a" } }));
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(wakeups).toEqual(["agent-1:task.assigned", "agent-1:approval.approved"]);
      expect(inbox.queueLength("agent-1")).toBe(2);
      expect(inbox.claim("agent-1")?.sourceEventId).toBe("approval");
      router.stop();
    } finally {
      database.close();
    }
  });
});
