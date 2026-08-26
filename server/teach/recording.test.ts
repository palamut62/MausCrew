// A recording is only worth having if it beats reading the finished
// transcript, and it does so on two counts: it knows where the workflow began
// and ended, and it keeps the detail the transcript is about to throw away.
// Both are tested here, along with the guards that stop a forgotten recording
// collecting for days.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";

const dir = mkdtempSync(join(tmpdir(), "maus-teach-"));
vi.mock("../config.ts", () => ({ DATA_DIR: dir }));

const { MAX_RECORDING_MS, MAX_STEPS, active, discard, last, record, start, stop } = await import(
  "./recording.ts"
);
const { teachDraftFromRecording } = await import("./draft.ts");

afterAll(() => rmSync(dir, { recursive: true, force: true }));

const T0 = Date.UTC(2026, 7, 26, 9, 0);

describe("recording lifecycle", () => {
  it("captures only what happens on the thread being demonstrated", () => {
    start("bot-a", "thread-1", "Cut a release", T0);
    record("bot-a", "thread-1", { at: T0, kind: "action", tool: "Bash" }, T0);
    record("bot-a", "thread-OTHER", { at: T0, kind: "action", tool: "Read" }, T0);
    expect(active("bot-a", T0)!.steps.map((s) => s.tool)).toEqual(["Bash"]);
  });

  it("ignores a retried action rather than teaching it twice", () => {
    start("bot-b", "t", "x", T0);
    record("bot-b", "t", { at: T0, kind: "action", tool: "Bash", detail: "npm test" }, T0);
    record("bot-b", "t", { at: T0, kind: "action", tool: "Bash", detail: "npm test" }, T0);
    expect(active("bot-b", T0)!.steps).toHaveLength(1);
  });

  it("treats a recording nobody stopped as over", () => {
    start("bot-c", "t", "x", T0);
    expect(active("bot-c", T0 + 60_000)).not.toBeNull();
    expect(active("bot-c", T0 + MAX_RECORDING_MS + 1)).toBeNull();
  });

  it("stops collecting once a recording is stopped", () => {
    start("bot-d", "t", "x", T0);
    stop("bot-d", T0 + 1000);
    record("bot-d", "t", { at: T0, kind: "action", tool: "Bash" }, T0 + 2000);
    expect(last("bot-d")!.steps).toHaveLength(0);
    expect(active("bot-d", T0 + 2000)).toBeNull();
  });

  it("refuses to grow without bound", () => {
    start("bot-e", "t", "x", T0);
    for (let i = 0; i < MAX_STEPS + 50; i++) {
      record("bot-e", "t", { at: T0, kind: "action", tool: `Tool${i}` }, T0);
    }
    expect(active("bot-e", T0)!.steps.length).toBeLessThanOrEqual(MAX_STEPS);
  });

  it("leaves nothing behind when discarded", () => {
    start("bot-f", "t", "x", T0);
    record("bot-f", "t", { at: T0, kind: "action", tool: "Bash" }, T0);
    discard("bot-f");
    expect(active("bot-f", T0)).toBeNull();
    expect(last("bot-f")).toBeNull();
  });

  it("records nothing for a bot that never started one", () => {
    record("bot-never", "t", { at: T0, kind: "action", tool: "Bash" }, T0);
    expect(last("bot-never")).toBeNull();
  });
});

describe("the draft a recording produces", () => {
  it("keeps the command, which is the part a transcript loses", () => {
    const draft = teachDraftFromRecording({
      label: "Cut a release",
      steps: [
        { kind: "asked", detail: "Cut the release branch" },
        { kind: "approved", tool: "Bash", detail: "git checkout -b release/0.2" },
      ],
    });
    expect(draft.instructions).toContain("git checkout -b release/0.2");
    expect(draft.instructions).toContain("Approvals this workflow needs");
    expect(draft.name).toBe("cut-a-release");
  });

  it("marks a failed step so the recipe does not repeat it blindly", () => {
    const draft = teachDraftFromRecording({
      label: "Deploy",
      steps: [{ kind: "action", tool: "Bash", detail: "npm test", ok: false }],
    });
    expect(draft.instructions).toMatch(/failed; do not repeat/);
  });

  it("redacts a credential that was demonstrated by accident", () => {
    const draft = teachDraftFromRecording({
      label: "Set the key",
      steps: [{ kind: "approved", tool: "Bash", detail: "export API_TOKEN=super-secret-value" }],
    });
    expect(draft.instructions).not.toContain("super-secret-value");
    expect(draft.instructions).toContain("REDACTED");
  });

  it("says so plainly when nothing was captured", () => {
    const draft = teachDraftFromRecording({ label: "Empty", steps: [] });
    expect(draft.instructions).toMatch(/Nothing was captured/);
  });

  // The boundaries are the whole point: only what happened between start and
  // stop is in the recipe.
  it("contains only the steps inside the recording", () => {
    const draft = teachDraftFromRecording({
      label: "Narrow",
      steps: [{ kind: "action", tool: "Read", detail: "only-this-file.ts" }],
    });
    expect(draft.instructions).toContain("only-this-file.ts");
    expect(draft.instructions).not.toContain("omitted from the middle");
  });
});
