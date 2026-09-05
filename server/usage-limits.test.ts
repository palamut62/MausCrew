import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { UsageLimiter } from "./usage-limits.ts";
import type { RuntimeEvent } from "./contracts.ts";
const event = (input: number, eventId: string, usageSessionId = "session"): Extract<RuntimeEvent, { type: "thread.token-usage.updated" }> => ({ type: "thread.token-usage.updated", threadId: "task", provider: "codex", createdAt: new Date().toISOString(), eventId, input, output: 0, cumulative: true, usageSessionId });
it("counts cumulative reports once, including duplicates and restart", () => {
  const file = join(mkdtempSync(join(tmpdir(), "usage-")), "usage.json");
  const limits = new UsageLimiter(file);
  expect(limits.record(event(100, "a")).input).toBe(100);
  expect(limits.record(event(150, "b")).input).toBe(50);
  expect(limits.record(event(150, "b")).input).toBe(0);
  const restarted = new UsageLimiter(file);
  expect(restarted.record(event(150, "c")).input).toBe(0);
  expect(restarted.record(event(30, "d", "new-session")).input).toBe(30);
  expect(restarted.snapshot().today.tokens).toBe(180);
});
it("enforces task and daily limits while resetting only daily counters", () => {
  const file = join(mkdtempSync(join(tmpdir(), "usage-")), "usage.json");
  let now = new Date(2026, 8, 5);
  const limits = new UsageLimiter(file, () => now);
  limits.configure({ dailyTurns: 1, taskTurns: 2, dailyTokens: 150, taskTokens: 0 });
  limits.begin("task");
  expect(() => limits.begin("other")).toThrow();
  now = new Date(2026, 8, 6);
  limits.begin("task");
  now = new Date(2026, 8, 7);
  expect(() => limits.begin("task")).toThrow();
  expect(limits.record(event(150, "a")).exceeded).toBe(true);
  expect(() => limits.begin("other")).toThrow();
});

it("keeps the ledger bounded so a long-lived install does not grow forever", () => {
  const file = join(mkdtempSync(join(tmpdir(), "usage-")), "usage.json");
  let now = new Date(2026, 0, 1);
  const limits = new UsageLimiter(file, () => now);
  for (let day = 0; day < 200; day++) {
    now = new Date(2026, 0, 1 + day);
    limits.begin(`task-${day}`);
  }
  const snapshot = limits.snapshot();
  expect(Object.keys(snapshot.tasks).length).toBeLessThanOrEqual(500);
  // 200 days ran, but only the most recent season is retained.
  expect(Object.keys((limits as unknown as { data: { days: object } }).data.days).length).toBe(90);
  // The active day survives pruning with its count intact.
  expect(snapshot.today.turns).toBe(1);
});

it("ages out the oldest tasks rather than the busiest ones", () => {
  const file = join(mkdtempSync(join(tmpdir(), "usage-")), "usage.json");
  const limits = new UsageLimiter(file);
  limits.begin("still-running");
  for (let i = 0; i < 400; i++) limits.begin(`filler-${i}`);
  // Touched again, which moves it back to the recent end of the ledger.
  limits.begin("still-running");
  for (let i = 400; i < 600; i++) limits.begin(`filler-${i}`);
  const tasks = limits.snapshot().tasks;
  expect(Object.keys(tasks).length).toBe(500);
  // Survived a full cap's worth of newer tasks because it stayed active.
  expect(tasks["still-running"].turns).toBe(2);
  expect(tasks["filler-0"]).toBeUndefined();
  expect(tasks["filler-599"].turns).toBe(1);
});
