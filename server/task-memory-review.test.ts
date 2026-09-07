import { describe, expect, it } from "vitest";
import { Store } from "./store.ts";
import { taskMemoryBlock } from "./memory/store.ts";
import { captureTaskNotes } from "./task-notes.ts";

const selection = () => ({ instanceId: "codex", model: "review-model" });

describe("task memory independent acceptance", () => {
  it("captures separate tasks on the same day and does not resurrect corrected or deleted notes", () => {
    const store = new Store(selection);
    const bot = store.createBot({ modelSelection: selection() });
    const first = bot.threadId;
    const message = store.appendMessage(first, { role: "bot", kind: "text", text: "Decisions:\n- Use blue\nRemaining work:\n- Test upload" });
    captureTaskNotes(store, bot.id, first, [message]);
    const decision = store.taskMemory(bot.id, first).find((entry) => entry.kind === "decision")!;
    store.upsertTaskMemory(bot.id, first, { id: decision.id, kind: "decision", text: "Use green" });
    const remaining = store.taskMemory(bot.id, first).find((entry) => entry.kind === "remaining")!;
    store.deleteTaskMemory(bot.id, first, remaining.id);
    captureTaskNotes(store, bot.id, first, [message]);
    expect(store.taskMemory(bot.id, first)).toMatchObject([{ text: "Use green" }]);
    const other = store.createTask(bot.id)!;
    const next = store.appendMessage(other.threadId, { role: "bot", kind: "text", text: "Decisions:\n- Use red" });
    captureTaskNotes(store, bot.id, other.threadId, [next]);
    expect(store.taskMemory(bot.id, other.threadId)).toMatchObject([{ text: "- Use red" }]);
    const reloaded = new Store(selection);
    captureTaskNotes(reloaded, bot.id, first, [message]);
    expect(reloaded.taskMemory(bot.id, first)).toHaveLength(1);
  });
  it("keeps two tasks on the same bot isolated after restart", () => {
    const store = new Store(selection);
    const bot = store.createBot({ modelSelection: selection() });
    const first = bot.threadId;
    const source = store.appendMessage(first, { role: "user", kind: "text", text: "Use the blue design" });
    store.upsertTaskMemory(bot.id, first, { kind: "decision", text: "Use the blue design", sourceMessageId: source.id });
    const second = store.createTask(bot.id, "Separate task")!;
    const reloaded = new Store(selection);
    expect(reloaded.taskMemory(bot.id, first)).toHaveLength(1);
    expect(reloaded.taskMemory(bot.id, second.threadId)).toEqual([]);
    expect(taskMemoryBlock(reloaded.taskMemory(bot.id, second.threadId))).not.toContain("blue");
    expect(taskMemoryBlock(reloaded.taskMemory(bot.id, first))).toContain(source.id);
  });

  it("preserves a correction and deletion across restart without duplicate entries", () => {
    const store = new Store(selection);
    const bot = store.createBot({ modelSelection: selection() });
    const entry = store.upsertTaskMemory(bot.id, bot.threadId, { kind: "remaining", text: "Check report" })!;
    store.upsertTaskMemory(bot.id, bot.threadId, { id: entry.id, kind: "remaining", text: "Check final PDF" });
    const reloaded = new Store(selection);
    expect(reloaded.taskMemory(bot.id, bot.threadId)).toMatchObject([{ id: entry.id, text: "Check final PDF" }]);
    expect(reloaded.deleteTaskMemory(bot.id, bot.threadId, entry.id)).toBe(true);
    expect(new Store(selection).taskMemory(bot.id, bot.threadId)).toEqual([]);
  });

  it("rejects attempts to mutate another bot's task", () => {
    const store = new Store(selection);
    const owner = store.createBot({ modelSelection: selection() });
    const other = store.createBot({ modelSelection: selection() });
    expect(store.upsertTaskMemory(other.id, owner.threadId, { kind: "decision", text: "Wrong task" })).toBeNull();
    expect(store.taskMemory(owner.id, owner.threadId)).toEqual([]);
  });
});
