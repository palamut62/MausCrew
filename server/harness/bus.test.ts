// The bus is the seam every client depends on: events must arrive
// stamped with their instanceId, cross-driver leaks must be dropped, and
// neither logging nor a broken listener may take down the stream.
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import { EVENTS_DIR, ensureDirs } from "../config.ts";
import type { RuntimeEvent } from "../contracts.ts";
import { makeFakeDriver } from "../testing/fake-driver.ts";
import { EventBus } from "./bus.ts";

const NEWLINE = "\n";

const testEvent = (over: Partial<RuntimeEvent> = {}): RuntimeEvent =>
  ({
    eventId: "ev-1",
    provider: "fake",
    threadId: "thread-1",
    createdAt: new Date().toISOString(),
    type: "turn.started",
    ...over,
  }) as RuntimeEvent;

async function liveInstance() {
  const fake = makeFakeDriver();
  await fake.driver.create({
    instanceId: "inst-1",
    displayName: undefined,
    environment: {},
    enabled: true,
    config: {},
  });
  return fake.created.get("inst-1")!;
}

describe("EventBus", () => {
  beforeEach(() => {
    rmSync(EVENTS_DIR, { recursive: true, force: true });
    ensureDirs();
  });

  it("stamps events from an attached adapter with the instanceId", async () => {
    const { instance, emit } = await liveInstance();
    const bus = new EventBus();
    bus.attach([instance]);
    const seen: RuntimeEvent[] = [];
    bus.subscribe((e) => seen.push(e));

    emit(testEvent());
    expect(seen).toHaveLength(1);
    expect(seen[0].providerInstanceId).toBe("inst-1");
  });

  it("drops events claiming a different driver kind (cross-driver invariant)", async () => {
    const { instance, emit } = await liveInstance();
    const bus = new EventBus();
    bus.attach([instance]);
    const seen: RuntimeEvent[] = [];
    bus.subscribe((e) => seen.push(e));

    emit(testEvent({ provider: "impostor" }));
    expect(seen).toHaveLength(0);
  });

  it("tees every published event to the per-thread NDJSON log", () => {
    const bus = new EventBus();
    bus.publish(testEvent({ threadId: "log-me" }));
    bus.flush();

    const logged = readFileSync(join(EVENTS_DIR, "log-me.ndjson"), "utf8")
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));
    expect(logged).toHaveLength(1);
    expect(logged[0].type).toBe("turn.started");
  });

  it("still delivers when the NDJSON log cannot be written", () => {
    rmSync(EVENTS_DIR, { recursive: true, force: true });
    const bus = new EventBus();
    const seen: RuntimeEvent[] = [];
    bus.subscribe((e) => seen.push(e));

    bus.publish(testEvent());
    expect(seen).toHaveLength(1);
    bus.flush();
    expect(existsSync(EVENTS_DIR)).toBe(false);
  });

  // The tee is batched so a token stream costs a handful of syscalls instead
  // of one per delta. Delivery must stay immediate, order must survive the
  // buffer, and threads must not bleed into each other's file.
  it("batches the log without delaying delivery, reordering, or mixing threads", () => {
    const bus = new EventBus();
    const seen: RuntimeEvent[] = [];
    bus.subscribe((e) => seen.push(e));

    for (let i = 0; i < 50; i++) {
      bus.publish(testEvent({ eventId: `a-${i}`, threadId: "batch-a" }));
      bus.publish(testEvent({ eventId: `b-${i}`, threadId: "batch-b" }));
    }
    expect(seen).toHaveLength(100);
    expect(existsSync(join(EVENTS_DIR, "batch-a.ndjson"))).toBe(false);

    bus.flush();
    const read = (thread: string) =>
      readFileSync(join(EVENTS_DIR, `${thread}.ndjson`), "utf8")
        .trim()
        .split(NEWLINE)
        .map((line) => JSON.parse(line).eventId);
    expect(read("batch-a")).toEqual(Array.from({ length: 50 }, (_, i) => `a-${i}`));
    expect(read("batch-b")).toEqual(Array.from({ length: 50 }, (_, i) => `b-${i}`));
  });

  it("discard drops a deleted thread's buffer so a later flush cannot resurrect its log", () => {
    const bus = new EventBus();
    bus.publish(testEvent({ threadId: "doomed" }));
    bus.publish(testEvent({ threadId: "kept" }));

    bus.discard("doomed");
    bus.flush();

    expect(existsSync(join(EVENTS_DIR, "doomed.ndjson"))).toBe(false);
    expect(existsSync(join(EVENTS_DIR, "kept.ndjson"))).toBe(true);
  });

  it("a throwing listener does not starve the others", () => {
    const bus = new EventBus();
    const seen: RuntimeEvent[] = [];
    bus.subscribe(() => {
      throw new Error("bad listener");
    });
    bus.subscribe((e) => seen.push(e));

    bus.publish(testEvent());
    expect(seen).toHaveLength(1);
  });

  it("unsubscribe and detachAll stop delivery", async () => {
    const { instance, emit } = await liveInstance();
    const bus = new EventBus();
    bus.attach([instance]);
    const seen: RuntimeEvent[] = [];
    const unsub = bus.subscribe((e) => seen.push(e));

    emit(testEvent());
    unsub();
    emit(testEvent());
    expect(seen).toHaveLength(1);

    const seenAfterDetach: RuntimeEvent[] = [];
    bus.subscribe((e) => seenAfterDetach.push(e));
    bus.detachAll();
    emit(testEvent());
    expect(seenAfterDetach).toHaveLength(0);
  });
});
