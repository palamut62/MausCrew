import { describe, expect, it } from "vitest";

import { CREW_EVENT_TYPES, createCrewEvent } from "./events.ts";

describe("crew events", () => {
  it("registers every Phase 1 event type", () => {
    expect(CREW_EVENT_TYPES).toHaveLength(35);
    expect(CREW_EVENT_TYPES).toContain("agent.status_changed");
    expect(CREW_EVENT_TYPES).toContain("git.review_completed");
    expect(CREW_EVENT_TYPES).toContain("agent.heartbeat");
  });

  it("creates correlation-ready events", () => {
    const event = createCrewEvent({
      id: "event-1",
      type: "task.created",
      projectId: " project-1 ",
      actor: { type: "human", id: " user-1 " },
      payload: { title: "Implement" },
      createdAt: "2026-09-10T10:00:00.000Z",
      correlationId: "turn-1",
    });
    expect(event).toMatchObject({ id: "event-1", projectId: "project-1", actor: { id: "user-1" }, correlationId: "turn-1" });
  });

  it("fails closed for an unknown event type", () => {
    expect(() => createCrewEvent({
      type: "unknown.event" as "task.created",
      projectId: "project-1",
      actor: { type: "system", id: "core" },
      payload: {},
    })).toThrow("Unsupported crew event type");
  });
});
