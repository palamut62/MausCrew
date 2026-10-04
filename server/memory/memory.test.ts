// Memory is prepended to every turn, so its failure modes are quiet and
// expensive: a budget that does not hold costs tokens on every request
// forever, and a distillation that eats hand-written notes destroys trust in
// the whole feature. Both are tested here.
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const dir = mkdtempSync(join(tmpdir(), "maus-memory-"));
vi.mock("../config.ts", () => ({ DATA_DIR: dir }));

const {
  MEMORY_BUDGET_CHARS,
  SHARED_PATH,
  appendJournal,
  memoryBlock,
  readJournal,
  readProfile,
  writeProfile,
} = await import("./store.ts");

beforeAll(() => mkdirSync(join(dir, "memory"), { recursive: true }));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("memory block", () => {
  it("says nothing at all when there is nothing remembered", () => {
    expect(memoryBlock("empty-bot").text).toBe("");
  });

  it("presents memory as knowledge rather than transcript", () => {
    writeProfile("bot-1", "They deploy with pnpm, never npm.");
    const block = memoryBlock("bot-1");
    expect(block.text).toContain("pnpm");
    expect(block.text).toMatch(/not a transcript/i);
    expect(block.truncated).toBe(false);
  });

  it("keeps the user's own words even when the bot's notes are enormous", () => {
    writeFileSync(SHARED_PATH, "Dev. Windows 11. Projects live in C:/Users/dev/Projects.", "utf8");
    writeProfile("bot-2", "x".repeat(MEMORY_BUDGET_CHARS * 3));
    const block = memoryBlock("bot-2");
    expect(block.text).toContain("C:/Users/dev/Projects");
    expect(block.truncated).toBe(true);
  });

  // The whole point of the cap: this text rides on every single request.
  it("never exceeds the budget, whatever is on disk", () => {
    writeProfile("bot-3", "y".repeat(MEMORY_BUDGET_CHARS * 10));
    const block = memoryBlock("bot-3");
    expect(block.chars).toBeLessThanOrEqual(MEMORY_BUDGET_CHARS);
  });

  it("admits to the bot when its notes were cut short", () => {
    writeProfile("bot-4", "z".repeat(MEMORY_BUDGET_CHARS * 2));
    expect(memoryBlock("bot-4").text).toMatch(/cut short/i);
  });
});

describe("journal", () => {
  it("collects a day's sessions into one entry", () => {
    appendJournal("bot-j", "2026-08-26", "- Fixed the broker address.");
    appendJournal("bot-j", "2026-08-26", "- Learned the pipe name was per thread.");
    const [entry] = readJournal("bot-j");
    expect(entry!.date).toBe("2026-08-26");
    expect(entry!.body).toContain("broker address");
    expect(entry!.body).toContain("per thread");
  });

  it("ignores an empty summary rather than writing a blank day", () => {
    appendJournal("bot-blank", "2026-08-26", "   ");
    expect(readJournal("bot-blank")).toHaveLength(0);
  });

  it("returns entries oldest first, and only the recent window", () => {
    for (const day of ["2026-08-01", "2026-08-02", "2026-08-03"]) {
      appendJournal("bot-w", day, `- work on ${day}`);
    }
    const recent = readJournal("bot-w", 2);
    expect(recent.map((e) => e.date)).toEqual(["2026-08-02", "2026-08-03"]);
  });
});

describe("generated vs authored", () => {
  // Distillation overwrites profile.md. The file has to say so in itself,
  // or someone will eventually hand-edit it and lose the work.
  it("marks the distilled file as machine-written and points elsewhere", () => {
    writeProfile("bot-5", "distilled notes");
    const raw = readProfile("bot-5");
    expect(raw).toBe("distilled notes");
    const onDisk = readFileSync(
      join(dir, "memory", "bots", "bot-5", "profile.md"),
      "utf8",
    );
    expect(onDisk).toMatch(/lost on the next distillation/i);
    expect(onDisk).toContain("shared.md");
  });

  it("replaces the profile on rewrite instead of accumulating", () => {
    writeProfile("bot-6", "first");
    writeProfile("bot-6", "second");
    expect(readProfile("bot-6")).toBe("second");
  });
});

// Reading the machine's existing vault is what makes a bot as informed as the
// terminal beside it. Writing to it is what would make it dangerous.
describe("the borrowed vault", () => {
  const vaultPath = join(dir, "vault-active.md");

  it("is ignored entirely when none is configured", () => {
    delete process.env.MAUSCREW_MEMORY_VAULT;
    writeFileSync(SHARED_PATH, "own notes", "utf8");
    expect(memoryBlock("bot-v0").text).toContain("own notes");
  });

  it("is read alongside our own notes, vault first", () => {
    writeFileSync(vaultPath, "Projects live in C:/Users/dev/Projects.", "utf8");
    writeFileSync(SHARED_PATH, "own notes", "utf8");
    process.env.MAUSCREW_MEMORY_VAULT = vaultPath;
    const text = memoryBlock("bot-v1").text;
    expect(text).toContain("C:/Users/dev/Projects");
    expect(text).toContain("own notes");
    expect(text.indexOf("C:/Users/dev/Projects")).toBeLessThan(text.indexOf("own notes"));
  });

  it("drops the do-not-edit banner a generated vault opens with", () => {
    writeFileSync(vaultPath, "<!-- generated, do not edit -->\n\nReal fact.", "utf8");
    process.env.MAUSCREW_MEMORY_VAULT = vaultPath;
    const text = memoryBlock("bot-v2").text;
    expect(text).toContain("Real fact.");
    expect(text).not.toContain("do not edit");
  });

  it("cannot crowd out the bot's own notes however large it is", () => {
    writeFileSync(vaultPath, "v".repeat(50_000), "utf8");
    process.env.MAUSCREW_MEMORY_VAULT = vaultPath;
    expect(memoryBlock("bot-v3").chars).toBeLessThanOrEqual(MEMORY_BUDGET_CHARS);
    delete process.env.MAUSCREW_MEMORY_VAULT;
  });

  it("never writes to the vault — only under our own directory", () => {
    writeFileSync(vaultPath, "untouched", "utf8");
    process.env.MAUSCREW_MEMORY_VAULT = vaultPath;
    writeProfile("bot-v4", "a distilled brief");
    appendJournal("bot-v4", "2026-08-26", "- a session");
    expect(readFileSync(vaultPath, "utf8")).toBe("untouched");
    delete process.env.MAUSCREW_MEMORY_VAULT;
  });
});
