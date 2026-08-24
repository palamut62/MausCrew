// Approval broker contract tests (spec §37–§43, §82, §87, §103).
//
// These drive the driver's half of the mailbox directly: the test plays the
// Cordis plugin, writing the request file the plugin would write and reading
// the response file it would read. That is the entire contract between the
// two processes, so exercising it here covers the real seam without needing a
// Node runtime, the Python SDK, or WSL.
//
// Every case asserts the RESPONSE FILE, not just the event. An approval that
// looks right in the UI and never reaches the runtime is the failure mode
// worth testing for.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import type { ProviderInstance } from "../contracts.ts";
import { recordEvents, type EventRecorder } from "../testing/events.ts";
import { createDeepSeekInstance } from "./deepseek-harness.ts";
import { decodeConfig } from "./deepseek/config.ts";

const FAKE_BRIDGE = join(dirname(fileURLToPath(import.meta.url)), "..", "testing", "fake-deepseek-bridge.ts");
const INSTANCE_ID = "approve";

describe("DeepSeekHarnessDriver approvals", () => {
  let instance: ProviderInstance;
  let recorder: EventRecorder;
  let scratch: string;
  let mailboxDir: string;

  const build = async (overrides: Record<string, unknown> = {}) =>
    createDeepSeekInstance(
      {
        instanceId: INSTANCE_ID,
        displayName: undefined,
        enabled: true,
        // "hang" keeps the turn open, which is what a real turn waiting on an
        // approval looks like from here.
        environment: { DEEPSEEK_API_KEY: "sk-test", FAKE_DSH_MODE: "hang" },
        config: decodeConfig({
          // the fake is a Node script; process.execPath runs it
          pythonPath: process.execPath,
          runtime: { mode: "external-python" },
          sessionRoot: join(scratch, "sessions", INSTANCE_ID),
          approval: { timeoutMs: 60_000 },
          ...overrides,
        }),
      },
      { scriptPath: FAKE_BRIDGE },
    );

  const start = async (overrides: Record<string, unknown> = {}) => {
    scratch = mkdtempSync(join(tmpdir(), "dsh-approve-"));
    // sessionRootFor() scopes the configured root by instance; the mailbox
    // is a directory inside that.
    mailboxDir = join(scratch, "sessions", INSTANCE_ID, `instance-${INSTANCE_ID}`, "approvals");
    instance = await build(overrides);
    recorder = recordEvents(instance.adapter);
  };

  afterEach(async () => {
    recorder?.stop();
    await instance?.dispose();
    // Windows will not remove a directory that is still a dying process's
    // cwd, and a leftover temp directory is not what any of these assert.
    try {
      rmSync(scratch, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    } catch {
      /* the OS will clean up %TEMP% eventually */
    }
  });

  const writeRequest = (threadId: string, id: string, tool = "bash", extra: Record<string, unknown> = {}) => {
    writeFileSync(
      join(mailboxDir, `${id}.req.json`),
      JSON.stringify({
        v: 1,
        id,
        sessionId: `dsh:${INSTANCE_ID}:${threadId}`,
        tool,
        summary: `${tool}: rm -rf /`,
        createdAt: Date.now(),
        ...extra,
      }),
    );
  };

  /** Play the plugin: start a turn, ask, wait for the card. */
  const askFor = async (threadId: string, id: string, tool = "bash", extra: Record<string, unknown> = {}) => {
    await instance.adapter.sendTurn({ threadId, text: "do it", cwd: scratch });
    writeRequest(threadId, id, tool, extra);
    return recorder.until((e) => e.type === "request.opened");
  };

  /** The plugin's read side. */
  const answer = (id: string): { decision: string; message?: string } | null => {
    const path = join(mailboxDir, `${id}.res.json`);
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, "utf8"));
  };

  const settleFor = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  it("shows a dangerous call as a permission request and allows it exactly once", async () => {
    await start();
    const opened = (await askFor("t-allow", "id-allow-01")) as unknown as {
      requestId?: string;
      tool: string;
      summary: string;
      requestType: string;
    };
    expect(opened.requestType).toBe("permission");
    expect(opened.requestId).toBe("id-allow-01");
    expect(opened.tool).toBe("bash");
    expect(opened.summary).toContain("rm -rf");

    await instance.adapter.respondToRequest("t-allow", "id-allow-01", { behavior: "allow" });
    expect(answer("id-allow-01")).toMatchObject({ decision: "allow" });

    // Exactly once: answering the same id again writes nothing new, so a
    // second click cannot re-authorize a later call that reuses the id.
    await instance.adapter.respondToRequest("t-allow", "id-allow-01", { behavior: "deny" });
    expect(answer("id-allow-01")).toMatchObject({ decision: "allow" });
  });

  it("writes a denial the runtime can act on", async () => {
    await start();
    await askFor("t-deny", "id-deny-01");
    await instance.adapter.respondToRequest("t-deny", "id-deny-01", { behavior: "deny", message: "no" });
    expect(answer("id-deny-01")).toMatchObject({ decision: "deny", message: "no" });
    expect(recorder.events.some((e) => e.type === "request.resolved")).toBe(true);
  });

  it("does not take a free-text answer as consent", async () => {
    await start();
    await askFor("t-answer", "id-answer-01");
    // `answer` is the shape a question takes, and this broker asks none.
    await instance.adapter.respondToRequest("t-answer", "id-answer-01", { behavior: "answer", message: "sure" });
    expect(answer("id-answer-01")).toMatchObject({ decision: "deny" });
  });

  it("shows ask_user_question choices and returns the selected answer", async () => {
    await start();
    const opened = await askFor("t-question", "id-question-01", "ask_user_question", {
      kind: "question",
      summary: "Should I continue?",
      choices: ["Yes", "No"],
    });
    expect(opened).toMatchObject({
      requestType: "question",
      summary: "Should I continue?",
      choices: ["Yes", "No"],
    });

    await instance.adapter.respondToRequest("t-question", "id-question-01", {
      behavior: "answer",
      message: "Yes",
    });
    expect(answer("id-question-01")).toMatchObject({ decision: "answer", message: "Yes" });
  });

  it("refuses an approval that comes from a different conversation", async () => {
    await start();
    await askFor("t-owner", "id-cross-01");
    // The card was shown in t-owner. Somebody answering from t-other never
    // saw what they were authorizing (§87).
    await instance.adapter.respondToRequest("t-other", "id-cross-01", { behavior: "allow" });
    expect(answer("id-cross-01")).toBeNull();
    // and the conversation that was actually asked can still answer
    await instance.adapter.respondToRequest("t-owner", "id-cross-01", { behavior: "allow" });
    expect(answer("id-cross-01")).toMatchObject({ decision: "allow" });
  });

  it("denies a request whose conversation is not waiting for anything", async () => {
    await start();
    await instance.adapter.sendTurn({ threadId: "t-live", text: "do it", cwd: scratch });
    writeRequest("t-gone", "id-orphan-01");
    await settleFor(900);
    expect(answer("id-orphan-01")).toMatchObject({ decision: "deny" });
    expect(recorder.events.some((e) => e.type === "request.opened")).toBe(false);
  });

  it("denies a request it cannot read rather than ignoring it", async () => {
    await start();
    await instance.adapter.sendTurn({ threadId: "t-junk", text: "do it", cwd: scratch });
    writeFileSync(join(mailboxDir, "id-junk-01.req.json"), "{not json");
    await settleFor(900);
    expect(answer("id-junk-01")).toMatchObject({ decision: "deny" });
  });

  it("denies a request from a protocol version it does not know", async () => {
    await start();
    await instance.adapter.sendTurn({ threadId: "t-ver", text: "do it", cwd: scratch });
    writeRequest("t-ver", "id-ver-01", "bash", { v: 99 });
    await settleFor(900);
    expect(answer("id-ver-01")).toMatchObject({ decision: "deny" });
  });

  it("closes an unanswered request when its turn ends", async () => {
    await start();
    await askFor("t-end", "id-end-01");
    await instance.adapter.interruptTurn("t-end");
    expect(answer("id-end-01")).toMatchObject({ decision: "deny" });
    // and the card is retracted rather than left open on a finished turn
    expect(
      recorder.events.some((e) => e.type === "request.resolved" && (e as { behavior: string }).behavior === "deny"),
    ).toBe(true);
  });

  it("never honours an approval id left behind by a previous run", async () => {
    await start();
    await askFor("t-stale", "id-stale-01");
    await instance.dispose();
    // Disposal denies it, which leaves a response on disk. A fresh instance
    // over the same session root must not let that file answer a new
    // question that happens to reuse the id (§103).
    expect(answer("id-stale-01")).toMatchObject({ decision: "deny" });

    recorder.stop();
    instance = await build();
    recorder = recordEvents(instance.adapter);
    await instance.adapter.sendTurn({ threadId: "t-stale", text: "again", cwd: scratch });
    expect(existsSync(join(mailboxDir, "id-stale-01.res.json"))).toBe(false);
  });

  it("expires a question nobody answered in time", async () => {
    await start({ approval: { timeoutMs: 5_000 } });
    await instance.adapter.sendTurn({ threadId: "t-old", text: "do it", cwd: scratch });
    // Written well before this instance existed: the asker is long gone.
    writeRequest("t-old", "id-old-01", "bash", { createdAt: Date.now() - 60_000 });
    await settleFor(900);
    expect(answer("id-old-01")).toMatchObject({ decision: "deny" });
    expect(recorder.events.some((e) => e.type === "request.opened")).toBe(false);
  });

  it("asks nobody and opens no mailbox when the policy is never", async () => {
    await start({ approval: { policy: "never" } });
    await instance.adapter.sendTurn({ threadId: "t-never", text: "do it", cwd: scratch });
    // The plugin refuses locally under this policy, so there is no channel to
    // watch and nothing for the user to answer.
    expect(existsSync(mailboxDir)).toBe(false);
    await expect(instance.adapter.respondToRequest("t-never", "id-never-01", { behavior: "allow" })).rejects.toThrow(
      /approval broker/i,
    );
  });
});
