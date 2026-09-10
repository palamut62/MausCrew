import { describe, expect, it } from "vitest";

import { CrewEventBus } from "./event-bus.ts";
import { createCrewEvent } from "./events.ts";

const event = (id: string) => createCrewEvent({
  id,
  type: "message.created",
  projectId: "project-1",
  actor: { type: "agent", id: "agent-1" },
  payload: { id },
  createdAt: "2026-09-10T10:00:00.000Z",
});

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

describe("CrewEventBus", () => {
  it("filters subscriptions and preserves order", async () => {
    const bus = new CrewEventBus();
    const received: string[] = [];
    bus.subscribe("messages", (item) => {
      received.push(item.id);
    }, ["message.created"]);
    bus.publish(event("one"));
    bus.publish(event("two"));
    bus.publish(createCrewEvent({ type: "task.created", projectId: "project-1", actor: { type: "system", id: "core" }, payload: {} }));
    await flush();
    expect(received).toEqual(["one", "two"]);
  });

  it("reports bounded-queue overflow without growing the queue", async () => {
    let release: (() => void) | undefined;
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    const bus = new CrewEventBus({ maxQueueSize: 1, overflowPolicy: "reject-new" });
    bus.subscribe("slow", async () => blocked);
    expect(bus.publish(event("one"))).toEqual([]);
    expect(bus.publish(event("two"))).toEqual(["slow"]);
    expect(bus.queueLength("slow")).toBe(1);
    release?.();
    await flush();
  });

  it("contains listener failures and continues delivery", async () => {
    const errors: string[] = [];
    const received: string[] = [];
    const bus = new CrewEventBus({ onListenerError: (_error, item) => errors.push(item.id) });
    bus.subscribe("consumer", (item) => {
      received.push(item.id);
      if (item.id === "one") throw new Error("broken projection");
    });
    bus.publish(event("one"));
    bus.publish(event("two"));
    await flush();
    expect(errors).toEqual(["one"]);
    expect(received).toEqual(["one", "two"]);
  });
});
