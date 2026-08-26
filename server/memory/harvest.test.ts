// Harvesting costs a real turn on the user's own engine, so the decision of
// WHEN to run one is the part worth testing: too eager and every conversation
// costs double, too shy and nothing is ever remembered.
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const dir = mkdtempSync(join(tmpdir(), "maus-harvest-"));
vi.mock("../config.ts", () => ({ DATA_DIR: dir }));

const {
  DISTIL_AFTER_ENTRIES,
  HARVEST_MIN_FOLDED,
  deterministicEntry,
  journalDate,
  planDistil,
  planHarvest,
  recordJournal,
} =
  await import("./harvest.ts");
const { appendJournal, readProfile } = await import("./store.ts");
const { recordDistil } = await import("./harvest.ts");

beforeAll(() => mkdirSync(join(dir, "memory"), { recursive: true }));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

type Msg = { id: string; role: "bot" | "user"; kind: string; text: string };
const thread = (n: number, chars = 900): Msg[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `m${i}`,
    role: i % 2 === 0 ? ("user" as const) : ("bot" as const),
    kind: "text",
    text: "x".repeat(chars),
  }));

describe("when to harvest", () => {
  it("does not spend a turn on a short conversation", () => {
    expect(planHarvest(thread(6))).toBeNull();
    expect(planHarvest([])).toBeNull();
  });

  it("harvests once a thread has real history behind it", () => {
    const plan = planHarvest(thread(120));
    expect(plan).not.toBeNull();
    expect(plan!.kind).toBe("journal");
    expect(plan!.foldedCount!).toBeGreaterThanOrEqual(HARVEST_MIN_FOLDED);
    expect(plan!.prompt).toContain("compacting");
  });

  it("does not re-summarise what a previous digest already covered", () => {
    const messages = thread(120);
    const previous = {
      text: "already known",
      throughMessageId: messages[110]!.id,
      messageCount: 110,
      at: 1,
    };
    expect(planHarvest(messages, previous)).toBeNull();
  });

  it("carries the previous brief forward rather than re-reading everything", () => {
    const messages = thread(200);
    const plan = planHarvest(messages, {
      text: "they prefer pnpm",
      throughMessageId: messages[20]!.id,
      messageCount: 20,
      at: 1,
    });
    expect(plan!.prompt).toContain("they prefer pnpm");
  });

  // An edited or rewound thread drops messages, so a stored cursor can point
  // at something no longer on the branch. Trusting it would skip the lot.
  it("folds from the top when the stored cursor is no longer in the thread", () => {
    const plan = planHarvest(thread(120), {
      text: "",
      throughMessageId: "message-from-an-abandoned-branch",
      messageCount: 5,
      at: 1,
    });
    expect(plan).not.toBeNull();
  });
});

describe("distillation", () => {
  it("waits until there is enough journal to be worth compressing", () => {
    appendJournal("bot-d", "2026-08-01", "- one");
    expect(planDistil("bot-d")).toBeNull();
  });

  it("compiles the whole journal once it has accumulated", () => {
    for (let i = 0; i < DISTIL_AFTER_ENTRIES; i++) {
      appendJournal("bot-e", `2026-08-1${i}`, `- entry ${i}`);
    }
    const plan = planDistil("bot-e")!;
    expect(plan.kind).toBe("distil");
    expect(plan.prompt).toContain("entry 0");
    expect(plan.prompt).toContain(`entry ${DISTIL_AFTER_ENTRIES - 1}`);
    expect(plan.prompt).toMatch(/No secrets/i);
  });

  it("writes the brief where the next turn will read it", () => {
    recordDistil("bot-f", "They deploy with pnpm.");
    expect(readProfile("bot-f")).toBe("They deploy with pnpm.");
  });
});

describe("journal dating", () => {
  it("files an entry under the day it happened", () => {
    const at = Date.UTC(2026, 7, 26, 15, 30);
    recordJournal("bot-g", "- did a thing", at);
    expect(journalDate(at)).toBe("2026-08-26");
  });
});

// This is what actually gets written today, so it carries the weight.
describe("the entry written without a model", () => {
  const say = (id: string, role: "user" | "bot", text: string, tool?: { name: string; ok?: boolean }) => ({
    id,
    role,
    kind: tool ? "activity" : "text",
    text,
    ...(tool ? { tool } : {}),
  });

  it("records what was asked, not what was answered", () => {
    const entry = deterministicEntry([
      say("1", "user", "Fix the permission broker"),
      say("2", "bot", "Sure, looking now"),
    ]);
    expect(entry).toContain("Fix the permission broker");
    expect(entry).not.toContain("Sure, looking now");
  });

  it("names the tools the session leaned on, and flags the ones that failed", () => {
    const entry = deterministicEntry([
      say("1", "user", "Deploy it"),
      say("2", "bot", "", { name: "Bash:git push", ok: true }),
      say("3", "bot", "", { name: "Bash:npm test", ok: false }),
      say("4", "bot", "", { name: "Read", ok: true }),
    ]);
    expect(entry).toMatch(/Bash \(1 failed\)/);
    expect(entry).toContain("Read");
  });

  it("prefers the task's title as the heading when there is one", () => {
    const entry = deterministicEntry([say("1", "user", "a very long rambling request")], {
      taskTitle: "Broker fix",
    });
    expect(entry.split("\n")[0]).toBe("## Broker fix");
  });

  it("writes nothing for a session with no request in it", () => {
    expect(deterministicEntry([say("1", "bot", "hello")])).toBe("");
    expect(deterministicEntry([])).toBe("");
  });

  it("keeps an entry short enough to survive distillation", () => {
    const entry = deterministicEntry([say("1", "user", "x".repeat(5000))]);
    expect(entry.length).toBeLessThan(400);
  });
});
