import { describe, expect, it } from "vitest";

import { AgentStatusMachine, InvalidAgentStatusTransitionError, canTransitionAgentStatus } from "./status-machine.ts";

describe("AgentStatusMachine", () => {
  it("routes transitions through one guarded state machine and emits evidence", () => {
    const events: unknown[] = [];
    const machine = new AgentStatusMachine((event) => events.push(event));
    machine.transition({ agentId: "agent-1", projectId: "project-1", to: "idle", actor: { type: "system", id: "runtime" } });
    machine.transition({ agentId: "agent-1", projectId: "project-1", to: "queued", actor: { type: "system", id: "router" }, taskId: "task-1" });
    expect(machine.get("agent-1")).toBe("queued");
    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({ type: "agent.status_changed", payload: { from: "idle", to: "queued", taskId: "task-1" } });
  });

  it("rejects impossible transitions without mutating state", () => {
    const machine = new AgentStatusMachine();
    expect(() => machine.transition({ agentId: "agent-1", projectId: "project-1", to: "completed", actor: { type: "system", id: "runtime" } }))
      .toThrow(InvalidAgentStatusTransitionError);
    expect(machine.get("agent-1")).toBe("offline");
  });

  it("treats a repeated status as an idempotent no-op", () => {
    expect(canTransitionAgentStatus("working", "working")).toBe(true);
    const machine = new AgentStatusMachine();
    expect(machine.transition({ agentId: "agent-1", projectId: "project-1", to: "offline", actor: { type: "system", id: "runtime" } })).toBeNull();
  });
});
