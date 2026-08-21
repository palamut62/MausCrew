// DeepSeek Harness driver contract tests, run against the scripted fake in
// server/testing/fake-deepseek-bridge.ts.
//
// The fake is Node, not Python, so these run on a machine with neither
// Python nor the DeepSeek SDK installed. That is deliberate: what is under
// test is the Node half — correlation, normalization, settlement, and the
// refusals — not the SDK.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ProviderInstance } from "../contracts.ts";
import { recordEvents, type EventRecorder } from "../testing/events.ts";
import { createDeepSeekInstance, DeepSeekHarnessDriver, DRIVER_KIND } from "./deepseek-harness.ts";
import { BUILT_IN_DRIVERS } from "./builtIn.ts";
import { decodeConfig } from "./deepseek/config.ts";
import { runtimePath } from "./deepseek/process-manager.ts";

const FAKE_BRIDGE = join(dirname(fileURLToPath(import.meta.url)), "..", "testing", "fake-deepseek-bridge.ts");

describe("DeepSeekHarnessDriver registration", () => {
  it("is registered last, leaving the existing engine order untouched", () => {
    expect(BUILT_IN_DRIVERS.at(-1)?.driverKind).toBe(DRIVER_KIND);
    expect(BUILT_IN_DRIVERS.filter((d) => d.driverKind === DRIVER_KIND)).toHaveLength(1);
  });

  it("declares only capabilities it actually has", async () => {
    const instance = await createDeepSeekInstance(
      {
        instanceId: "caps",
        displayName: undefined,
        environment: { DEEPSEEK_API_KEY: "sk-test" },
        enabled: true,
        config: decodeConfig({ runtime: { mode: "external-python" } }),
      },
      { scriptPath: FAKE_BRIDGE },
    );
    // Integrations mount as mcp-client plugins in a generated composition
    // (P4-05/06/07), so all three are real here. The model still cannot be
    // switched inside a session: the runtime resolves it when the composition
    // is built, so a switch is a new process (§54).
    expect(instance.adapter.capabilities).toMatchObject({
      sessionModelSwitch: "unsupported",
      agentsMcp: true,
      computerMcp: true,
      composioMcp: true,
    });
    expect(instance.adapter.capabilities.effortLevels).toBeUndefined();
    await instance.dispose();
  });
});

describe("DeepSeekHarnessDriver turns (fake bridge)", () => {
  let instance: ProviderInstance;
  let recorder: EventRecorder;
  let scratch: string;

  // The fake's scenario travels through the instance environment, not
  // process.env — the bridge environment is an allowlist built from nothing,
  // so nothing else would reach the child. Which is itself the guarantee
  // under test everywhere else in this file.
  const create = async (environment: Record<string, string> = {}, overrides: Record<string, unknown> = {}) => {
    instance = await createDeepSeekInstance(
      {
        instanceId: "dsh-test",
        displayName: "DeepSeek Test",
        environment: { DEEPSEEK_API_KEY: "sk-test", ...environment },
        enabled: true,
        config: decodeConfig({
          // the fake is a Node script; process.execPath runs it
          pythonPath: process.execPath,
          runtime: { mode: "external-python" },
          ...overrides,
        }),
      },
      { scriptPath: FAKE_BRIDGE },
    );
    recorder = recordEvents(instance.adapter);
  };

  beforeEach(() => {
    scratch = mkdtempSync(join(tmpdir(), "mauscrew-dsh-test-"));
  });

  afterEach(async () => {
    recorder?.stop();
    await instance?.dispose();
    // taskkill reaps the tree asynchronously, and Windows refuses to remove
    // a directory that is still some process's cwd. Retry, then let it go —
    // a leftover temp directory is not what any of these tests assert.
    try {
      rmSync(scratch, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    } catch {
      /* the OS will clean up %TEMP% eventually */
    }
  });

  it("normalizes a full turn and preserves multibyte text", async () => {
    await create();
    const { turnId } = await instance.adapter.sendTurn({ threadId: "t-happy", text: "selam", cwd: scratch });

    await recorder.until((e) => e.type === "turn.completed");
    const types = recorder.events.map((e) => e.type);
    expect(types).toContain("turn.started");
    expect(types).toContain("session.started");
    expect(types).toContain("thread.token-usage.updated");

    const text = recorder.events
      .filter((e) => e.type === "content.delta" && e.streamKind === "assistant_text")
      .map((e) => (e as { delta: string }).delta)
      .join("");
    expect(text).toBe("Merhaba dünya 🌍");

    const completed = recorder.events.find((e) => e.type === "turn.completed") as { ok: boolean; turnId?: string };
    expect(completed.ok).toBe(true);
    expect(completed.turnId).toBe(turnId);
    expect(instance.adapter.hasSession("t-happy")).toBe(true);
  });

  it("sends a deterministic session id so a restart resumes the same thread", async () => {
    const dump = join(scratch, "dump.json");
    await create({ FAKE_DSH_DUMP: dump });
    await instance.adapter.sendTurn({ threadId: "t-session", text: "hi", cwd: scratch });
    await recorder.until((e) => e.type === "turn.completed");

    const { commands, env } = JSON.parse(readFileSync(dump, "utf8"));
    const start = commands.find((c: { type: string }) => c.type === "turn.start");
    expect(start.sessionId).toBe("dsh:dsh-test:t-session");
    // §12: the bridge sees the key it needs and nothing else of ours
    expect(env.DEEPSEEK_API_KEY).toBe("sk-test");
    expect(env.AWS_SECRET_ACCESS_KEY).toBeUndefined();
    expect(env.SSH_AUTH_SOCK).toBeUndefined();
  });

  it("runs different threads in parallel but refuses a second turn on one thread", async () => {
    await create();
    await instance.adapter.sendTurn({ threadId: "t-a", text: "one", cwd: scratch });
    // a second thread is fine — the runtime keys sessions independently
    await expect(instance.adapter.sendTurn({ threadId: "t-b", text: "two", cwd: scratch })).resolves.toBeTruthy();
    await expect(instance.adapter.sendTurn({ threadId: "t-a", text: "again", cwd: scratch })).rejects.toThrow(
      /already running/,
    );
    await recorder.until((e) => e.type === "turn.completed" && e.threadId === "t-b");
  });

  it("reuses one bridge process across turns", async () => {
    const dump = join(scratch, "dump.json");
    await create({ FAKE_DSH_DUMP: dump });
    await instance.adapter.sendTurn({ threadId: "t1", text: "a", cwd: scratch });
    await recorder.until((e) => e.type === "turn.completed" && e.threadId === "t1");
    await instance.adapter.sendTurn({ threadId: "t2", text: "b", cwd: scratch });
    await recorder.until((e) => e.type === "turn.completed" && e.threadId === "t2");

    // both turns landed in the same process's command log
    const { commands } = JSON.parse(readFileSync(dump, "utf8"));
    expect(commands.filter((c: { type: string }) => c.type === "turn.start")).toHaveLength(2);
  });

  it("sends only the new message, never a replayed transcript", async () => {
    // The runtime's session log is the model's context (spec §48), so the
    // driver must not also send history: doing both would duplicate every
    // earlier message and burn tokens on a conversation the model already has.
    const dump = join(scratch, "dump.json");
    await create({ FAKE_DSH_DUMP: dump });
    await instance.adapter.sendTurn({ threadId: "t-ctx", text: "first message", cwd: scratch });
    await recorder.until((e) => e.type === "turn.completed");
    await instance.adapter.sendTurn({ threadId: "t-ctx", text: "second message", cwd: scratch });
    await recorder.until((e) => e.type === "turn.completed" && recorder.events.filter((x) => x.type === "turn.completed").length === 2);

    const starts = JSON.parse(readFileSync(dump, "utf8")).commands.filter(
      (c: { type: string }) => c.type === "turn.start",
    ) as Array<{ prompt: string; sessionId: string }>;
    expect(starts).toHaveLength(2);
    expect(starts[1].prompt).toBe("second message");
    expect(starts[1].prompt).not.toContain("first message");
    // and both turns addressed the same session, which is what makes that safe
    expect(starts[1].sessionId).toBe(starts[0].sessionId);
  });

  it("settles the turn when the bridge reports an error", async () => {
    await create({ FAKE_DSH_MODE: "error-turn" });
    await instance.adapter.sendTurn({ threadId: "t-err", text: "hi", cwd: scratch });
    const error = (await recorder.until((e) => e.type === "runtime.error")) as { message: string; setup?: boolean };
    expect(error.message).toContain("rejected the API key");
    expect(error.setup).toBe(true);
    const done = (await recorder.until((e) => e.type === "turn.completed")) as { ok: boolean };
    expect(done.ok).toBe(false);
  });

  it("settles every in-flight turn when the bridge dies", async () => {
    await create({ FAKE_DSH_MODE: "crash-mid-turn" });
    await instance.adapter.sendTurn({ threadId: "t-crash", text: "hi", cwd: scratch });
    const done = (await recorder.until((e) => e.type === "turn.completed")) as { ok: boolean; stopReason?: string };
    expect(done.ok).toBe(false);
    expect(done.stopReason).toBe("bridge_crashed");
    expect(recorder.events.some((e) => e.type === "runtime.error")).toBe(true);
  });

  it("restarts a crashed bridge on the next turn, after its backoff", async () => {
    // Crash recovery has to be automatic — a dead bridge that stays dead
    // makes the bot permanently broken with no way back short of a restart
    // of the app. The backoff is what keeps that from becoming a spin.
    const dump = join(scratch, "dump.json");
    await create({ FAKE_DSH_MODE: "crash-mid-turn", FAKE_DSH_DUMP: dump });
    await instance.adapter.sendTurn({ threadId: "t-r1", text: "one", cwd: scratch });
    await recorder.until((e) => e.type === "turn.completed" && e.threadId === "t-r1");

    const began = Date.now();
    await instance.adapter.sendTurn({ threadId: "t-r2", text: "two", cwd: scratch });
    await recorder.until((e) => e.type === "turn.completed" && e.threadId === "t-r2", 15_000);
    // a fresh process took the second turn — the first one is dead
    expect(Date.now() - began).toBeGreaterThanOrEqual(900);
  }, 30_000);

  it("reports a missing SDK as a setup failure rather than a crash", async () => {
    await create({ FAKE_DSH_MODE: "sdk-missing" });
    await expect(instance.adapter.sendTurn({ threadId: "t-sdk", text: "hi", cwd: scratch })).rejects.toThrow();
    const error = (await recorder.until((e) => e.type === "runtime.error")) as { message: string; setup?: boolean };
    expect(error.message).toContain("deepseek-harness-sdk");
    expect(error.setup).toBe(true);
  });

  it("refuses a bridge whose protocol version it does not support", async () => {
    await create({ FAKE_DSH_PROTOCOL: "99" });
    await expect(instance.adapter.sendTurn({ threadId: "t-proto", text: "hi", cwd: scratch })).rejects.toThrow(
      /protocol version/,
    );
  });

  it("emits tool items with a bounded title", async () => {
    await create({ FAKE_DSH_MODE: "tools" });
    await instance.adapter.sendTurn({ threadId: "t-tools", text: "run", cwd: scratch });
    await recorder.until((e) => e.type === "turn.completed");
    const started = recorder.events.find((e) => e.type === "item.started") as { itemType: string; title: string };
    expect(started).toMatchObject({ itemType: "tool", title: "ls -la" });
    expect(recorder.events.find((e) => e.type === "item.completed" && (e as { itemType: string }).itemType === "tool"))
      .toMatchObject({ ok: true });
  });

  it("really stops an interrupted turn by killing the sole runtime", async () => {
    // "hang" accepts the prompt and never finishes it, so nothing but a kill
    // can end this turn. The bridge dying is the evidence the cancel was real
    // rather than the driver merely looking away (spec §44).
    await create({ FAKE_DSH_MODE: "hang" });
    await instance.adapter.sendTurn({ threadId: "t-int", text: "hi", cwd: scratch });
    await recorder.until((e) => e.type === "session.started");

    await instance.adapter.interruptTurn("t-int");
    const done = (await recorder.until((e) => e.type === "turn.completed")) as { ok: boolean; stopReason?: string };
    expect(done.ok).toBe(false);
    expect(done.stopReason).toBe("interrupted");

    // the kill is not charged to the restart budget: the next turn starts a
    // fresh process instead of counting against the crash limit
    await expect(instance.adapter.sendTurn({ threadId: "t-int", text: "retry", cwd: scratch })).resolves.toBeTruthy();
  });

  it("leaves the runtime alive when another thread is still working", async () => {
    // Killing here would cancel a turn nobody asked to cancel. The driver
    // takes the soft path instead and says so, rather than reporting a
    // detached turn as a stopped one.
    await create({ FAKE_DSH_MODE: "hang" });
    await instance.adapter.sendTurn({ threadId: "t-x", text: "one", cwd: scratch });
    await instance.adapter.sendTurn({ threadId: "t-y", text: "two", cwd: scratch });
    await recorder.until((e) => e.type === "session.started" && e.threadId === "t-y");

    await instance.adapter.interruptTurn("t-x");
    const done = (await recorder.until((e) => e.type === "turn.completed" && e.threadId === "t-x")) as {
      stopReason?: string;
    };
    expect(done.stopReason).toBe("interrupted");

    const note = recorder.events.find((e) => e.type === "runtime.error" && e.threadId === "t-x") as {
      message: string;
    };
    expect(note.message).toMatch(/background/i);
    // the sibling turn was not settled by the interrupt
    expect(recorder.events.some((e) => e.type === "turn.completed" && e.threadId === "t-y")).toBe(false);
  });

  it("stops a turn that produces nothing before its timeout", async () => {
    // The Python side blocks on the subscription with no deadline of its
    // own, so a hung runtime would otherwise hold the thread forever.
    await create({ FAKE_DSH_MODE: "hang" }, { turnTimeoutMs: 1_000 });
    await instance.adapter.sendTurn({ threadId: "t-slow", text: "hi", cwd: scratch });
    const done = (await recorder.until((e) => e.type === "turn.completed", 15_000)) as {
      ok: boolean;
      stopReason?: string;
    };
    expect(done.ok).toBe(false);
    expect(done.stopReason).toBe("timeout");
    expect(recorder.events.some((e) => e.type === "runtime.error" && /stopped/i.test((e as { message: string }).message)))
      .toBe(true);
  }, 30_000);

  it("shows a delegated run as one activity chip and never relays its deltas", async () => {
    await create({ FAKE_DSH_MODE: "subagent" });
    await instance.adapter.sendTurn({ threadId: "t-sub", text: "delegate", cwd: scratch });
    await recorder.until((e) => e.type === "turn.completed");

    const opened = recorder.events.filter(
      (e) => e.type === "item.started" && (e as { itemId?: string }).itemId?.startsWith("subagent:"),
    ) as Array<{ itemId: string; title: string; subagent?: { status: string; childSessionId: string } }>;
    const closed = recorder.events.filter(
      (e) => e.type === "item.completed" && (e as { itemId?: string }).itemId?.startsWith("subagent:"),
    ) as Array<{ itemId: string; ok: boolean }>;
    expect(opened).toHaveLength(1);
    expect(closed).toHaveLength(1);
    // same item id, so the UI closes the chip it opened rather than leaving
    // one spinning and adding a second
    expect(closed[0].itemId).toBe(opened[0].itemId);
    expect(closed[0].ok).toBe(true);
    expect(opened[0].title).toContain("agent");
    expect(opened[0].subagent).toMatchObject({ status: "running", childSessionId: "child-abcdef123456" });
    expect((closed[0] as { subagent?: unknown }).subagent).toMatchObject({
      status: "completed",
      provider: "local",
      agentId: "researcher",
      lastAssistantMessage: expect.stringContaining("delegated files"),
    });
  });

  // ── integration mounts (spec §52, §53; P4-05/06/07) ────────────────────

  const COMPOSIO = {
    composio: { url: "https://mcp.composio.dev/x", headers: { "x-api-key": "ck_live_1" } },
  } as const;

  it("points the runtime at a generated composition when a turn brings integrations", async () => {
    const dump = join(scratch, "dump.json");
    await create({ FAKE_DSH_DUMP: dump });
    await instance.adapter.sendTurn({
      threadId: "t-mcp",
      text: "hi",
      cwd: scratch,
      integrations: { ...COMPOSIO },
    });
    await recorder.until((e) => e.type === "turn.completed");

    const { env } = JSON.parse(readFileSync(dump, "utf8"));
    const composition = env.DSH_CORDIS_CONFIG as string;
    expect(composition).toMatch(/mauscrew\.generated\.cordis\.yml$/);
    const text = readFileSync(composition, "utf8");
    // the base composition is still there — mounting adds tools, it does not
    // replace the model, the files, or the approval gate
    expect(text).toContain("@deepseek-ai/dsh-llm-deepseek");
    expect(text).toContain("mauscrew-mcp-composio");
    expect(text).toContain("https://mcp.composio.dev/x");
  });

  it("leaves the configured composition alone when a turn brings nothing", async () => {
    const dump = join(scratch, "dump.json");
    await create({ FAKE_DSH_DUMP: dump });
    await instance.adapter.sendTurn({ threadId: "t-plain", text: "hi", cwd: scratch });
    await recorder.until((e) => e.type === "turn.completed");

    const { env } = JSON.parse(readFileSync(dump, "utf8"));
    expect(env.DSH_CORDIS_CONFIG).toMatch(/mauscrew\.cordis\.yml$/);
    expect(env.DSH_CORDIS_CONFIG).not.toMatch(/generated/);
  });

  it("mounts the host-only Dynamic Cordis toolset for an opted-in turn", async () => {
    const dump = join(scratch, "dump.json");
    await create({ FAKE_DSH_DUMP: dump });
    await instance.adapter.sendTurn({
      threadId: "t-cordis",
      text: "hi",
      cwd: scratch,
      runtimeFeatures: { dynamicCordis: true },
    });
    await recorder.until((e) => e.type === "turn.completed");

    const { env } = JSON.parse(readFileSync(dump, "utf8"));
    const composition = readFileSync(env.DSH_CORDIS_CONFIG as string, "utf8");
    expect(composition).toContain("@deepseek-ai/dsh-cordis-host-runner");
    expect(composition).toContain("@deepseek-ai/dsh-tool-cordis");
    expect(composition).not.toContain("cordis-client-runner");
  });

  it("restarts the runtime when the mounted set changes between turns", async () => {
    const dump = join(scratch, "dump.json");
    await create({ FAKE_DSH_DUMP: dump });
    await instance.adapter.sendTurn({ threadId: "t-m1", text: "a", cwd: scratch });
    await recorder.until((e) => e.type === "turn.completed" && e.threadId === "t-m1");

    // DSH_CORDIS_CONFIG is read once at startup, so a new tool set is a new
    // process. The fake rewrites its dump on every command, so the env in the
    // file is the env of whichever process wrote last.
    await instance.adapter.sendTurn({
      threadId: "t-m2",
      text: "b",
      cwd: scratch,
      integrations: { ...COMPOSIO },
    });
    await recorder.until((e) => e.type === "turn.completed" && e.threadId === "t-m2");

    const { env } = JSON.parse(readFileSync(dump, "utf8"));
    expect(env.DSH_CORDIS_CONFIG).toMatch(/generated/);
  }, 30_000);

  it("keeps a sibling turn alive rather than restarting for a new tool set", async () => {
    // One runtime serves every thread on the instance. Restarting to add a
    // tool to this turn would kill the other one, so the trade is stated in
    // the thread instead of made silently.
    await create({ FAKE_DSH_MODE: "hang" });
    await instance.adapter.sendTurn({ threadId: "t-busy", text: "one", cwd: scratch });
    await instance.adapter.sendTurn({
      threadId: "t-late",
      text: "two",
      cwd: scratch,
      integrations: { ...COMPOSIO },
    });

    const note = recorder.events.find(
      (e) => e.type === "runtime.error" && (e as { message: string }).message.includes("different set of tools"),
    ) as { threadId: string } | undefined;
    expect(note).toBeDefined();
    expect(note?.threadId).toBe("t-late");
  });
});

describe("DeepSeekHarnessDriver refusals", () => {
  const base = {
    instanceId: "refuse",
    displayName: undefined,
    enabled: true,
  };

  let scratch: string;
  beforeEach(() => {
    scratch = mkdtempSync(join(tmpdir(), "dsh-refuse-"));
  });
  afterEach(() => rmSync(scratch, { recursive: true, force: true }));

  it("runs with an explicitly selected upstream sandbox policy", async () => {
    const instance = await createDeepSeekInstance(
      {
        ...base,
        environment: { DEEPSEEK_API_KEY: "sk-test" },
        config: decodeConfig({
          pythonPath: process.execPath,
          sandbox: { mode: "read-only" },
          runtime: { mode: "external-python" },
        }),
      },
      { scriptPath: FAKE_BRIDGE },
    );
    const recorder = recordEvents(instance.adapter);
    await expect(instance.adapter.sendTurn({ threadId: "t", text: "hi", cwd: scratch })).resolves.toBeTruthy();
    await recorder.until((event) => event.type === "turn.completed");
    recorder.stop();
    await instance.dispose();
  });

  it("will not start a turn with no API key", async () => {
    const instance = await createDeepSeekInstance(
      { ...base, environment: {}, config: decodeConfig({ runtime: { mode: "external-python" } }) },
      { scriptPath: FAKE_BRIDGE },
    );
    await expect(instance.adapter.sendTurn({ threadId: "t", text: "hi" })).rejects.toThrow(/API key/i);
    const snapshot = await instance.snapshot();
    expect(snapshot.state).toBe("unavailable");
    expect(snapshot.authenticated).toBe(false);
    await instance.dispose();
  });

  it("says so instead of pretending to answer when no broker is composed", async () => {
    // A user's own composition may gate tools better than ours does, but we
    // cannot know that, so we do not claim to be able to answer for it.
    const instance = await createDeepSeekInstance(
      {
        ...base,
        environment: { DEEPSEEK_API_KEY: "sk-test" },
        config: decodeConfig({
          runtime: { mode: "external-python" },
          cordis: { configPath: join(scratch, "their-own.cordis.yml") },
        }),
      },
      { scriptPath: FAKE_BRIDGE },
    );
    await expect(instance.adapter.respondToRequest("t", "req-1", { behavior: "allow" })).rejects.toThrow(
      /approval broker/i,
    );
    await instance.dispose();
  });

  it("refuses Dynamic Cordis when the MausCrew approval composition is not active", async () => {
    const customComposition = join(scratch, "their-own.cordis.yml");
    writeFileSync(customComposition, "- id: custom\n  name: '@example/custom'\n");
    const dump = join(scratch, "dump.json");
    const instance = await createDeepSeekInstance(
      {
        ...base,
        environment: { DEEPSEEK_API_KEY: "sk-test", FAKE_DSH_DUMP: dump },
        config: decodeConfig({
          pythonPath: process.execPath,
          runtime: { mode: "external-python" },
          cordis: { configPath: customComposition },
        }),
      },
      { scriptPath: FAKE_BRIDGE },
    );
    const recorder = recordEvents(instance.adapter);
    await instance.adapter.sendTurn({
      threadId: "t-custom-cordis",
      text: "hi",
      cwd: scratch,
      runtimeFeatures: { dynamicCordis: true },
    });
    await recorder.until((event) => event.type === "turn.completed");

    expect(recorder.events.some(
      (event) => event.type === "runtime.error" && /Dynamic Cordis was not enabled/.test((event as { message: string }).message),
    )).toBe(true);
    const { env } = JSON.parse(readFileSync(dump, "utf8"));
    expect(env.DSH_CORDIS_CONFIG).toBe(customComposition);
    recorder.stop();
    await instance.dispose();
  });

  it("exposes the configured model in its catalog", () => {
    expect(DeepSeekHarnessDriver.models.default).toBe("deepseek-v4-flash");
    expect(DeepSeekHarnessDriver.decodeConfig({}).defaultModel).toBe("deepseek-v4-flash");
  });
});

describe("DeepSeekHarnessDriver session survival and hostile input", () => {
  let scratch: string;

  const build = async (instanceId: string, environment: Record<string, string>) =>
    createDeepSeekInstance(
      {
        instanceId,
        displayName: undefined,
        environment: { DEEPSEEK_API_KEY: "sk-test", ...environment },
        enabled: true,
        config: decodeConfig({ pythonPath: process.execPath, runtime: { mode: "external-python" } }),
      },
      { scriptPath: FAKE_BRIDGE },
    );

  beforeEach(() => {
    scratch = mkdtempSync(join(tmpdir(), "mauscrew-dsh-sess-"));
  });

  afterEach(() => {
    try {
      rmSync(scratch, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    } catch {
      /* see above */
    }
  });

  it("replays the active conversation into a fresh runtime session after recreation", async () => {
    // rc6's JSON-RPC server cannot resume an existing id across processes;
    // it calls agents.create rather than agents.resume. A fresh incarnation
    // avoids that collision and receives the active MausCrew transcript once.
    const read = (dump: string) =>
      JSON.parse(readFileSync(dump, "utf8")).commands.find((c: { type: string }) => c.type === "turn.start")
        .sessionId as string;

    const first = join(scratch, "first.json");
    const a = await build("survivor", { FAKE_DSH_DUMP: first });
    const ra = recordEvents(a.adapter);
    await a.adapter.sendTurn({ threadId: "t-keep", text: "one", cwd: scratch });
    await ra.until((e) => e.type === "turn.completed");
    ra.stop();
    await a.dispose();

    const second = join(scratch, "second.json");
    const b = await build("survivor", { FAKE_DSH_DUMP: second });
    const rb = recordEvents(b.adapter);
    await b.adapter.sendTurn({
      threadId: "t-keep",
      text: "two",
      cwd: scratch,
      transcript: [
        { role: "user", text: "one" },
        { role: "assistant", text: "hello from fake" },
      ],
    });
    await rb.until((e) => e.type === "turn.completed");
    rb.stop();
    await b.dispose();

    expect(read(second)).not.toBe(read(first));
    expect(read(second)).toMatch(/^dsh:survivor:t-keep:replay-[0-9a-f]{12}$/);
    const secondTurn = JSON.parse(readFileSync(second, "utf8")).commands.find(
      (c: { type: string }) => c.type === "turn.start",
    );
    expect(secondTurn.prompt).toContain("<conversation-history>");
    expect(secondTurn.prompt).toContain("hello from fake");
  });

  it("keeps two bots on the same thread name completely separate", async () => {
    // supportsMultipleInstances is true, so two DeepSeek bots can be
    // configured at once. They must not share a session log: the instance id
    // is in the session id for exactly this reason, and a collision would
    // mean one bot reading the other's conversation.
    const dumpA = join(scratch, "a.json");
    const dumpB = join(scratch, "b.json");
    const a = await build("bot-a", { FAKE_DSH_DUMP: dumpA });
    const b = await build("bot-b", { FAKE_DSH_DUMP: dumpB });
    const ra = recordEvents(a.adapter);
    const rb = recordEvents(b.adapter);

    // same threadId on purpose
    await a.adapter.sendTurn({ threadId: "shared", text: "one", cwd: scratch });
    await b.adapter.sendTurn({ threadId: "shared", text: "two", cwd: scratch });
    await ra.until((e) => e.type === "turn.completed");
    await rb.until((e) => e.type === "turn.completed");

    const sessionOf = (dump: string) =>
      JSON.parse(readFileSync(dump, "utf8")).commands.find((c: { type: string }) => c.type === "turn.start")
        .sessionId as string;
    expect(sessionOf(dumpA)).toBe("dsh:bot-a:shared");
    expect(sessionOf(dumpB)).toBe("dsh:bot-b:shared");

    // and every event carried its own instance id, so the UI can tell them apart
    expect([...new Set(ra.events.map((e) => e.providerInstanceId))]).toEqual(["bot-a"]);
    expect([...new Set(rb.events.map((e) => e.providerInstanceId))]).toEqual(["bot-b"]);

    ra.stop();
    rb.stop();
    await a.dispose();
    await b.dispose();
  });

  it("treats shell metacharacters in a workspace path as text, never as a command", async () => {
    // Metacharacters only — no quotes or redirects, which Windows rejects in
    // a filename outright and which would make this a filesystem test rather
    // than an injection one. If any of it were assembled into a shell string,
    // `id`/`whoami` would run and the directory would not be created verbatim.
    const hostile = join(scratch, "ws && echo pwned; $(id) `whoami`");
    const dump = join(scratch, "dump.json");

    const instance = await build("hostile", { FAKE_DSH_DUMP: dump });
    const recorder = recordEvents(instance.adapter);
    await instance.adapter.sendTurn({ threadId: "t-hostile", text: "hi", cwd: hostile });
    await recorder.until((e) => e.type === "turn.completed");
    recorder.stop();
    await instance.dispose();

    // the whole string became one directory, not a command and its arguments
    expect(existsSync(hostile)).toBe(true);
    const { commands } = JSON.parse(readFileSync(dump, "utf8"));
    expect(commands.find((c: { type: string }) => c.type === "turn.start").cwd).toBe(hostile);
  });
});

// Opt-in: runs only with a real key and a real SDK, because it costs money
// and needs an interpreter this repo cannot assume exists.
const LIVE = process.env.DEEPSEEK_API_KEY && process.env.MAUSCREW_DEEPSEEK_LIVE === "1";
describe.skipIf(!LIVE)("DeepSeekHarnessDriver against the real SDK", () => {
  it("completes a turn end to end", async () => {
    const scratch = mkdtempSync(join(tmpdir(), "mauscrew-dsh-live-"));
    const strategy = process.env.MAUSCREW_DEEPSEEK_RUNTIME_STRATEGY || "system";
    const instance = await createDeepSeekInstance({
      instanceId: `live-${strategy}`,
      displayName: undefined,
      environment: { DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY! },
      enabled: true,
      config: decodeConfig({
        pythonPath: process.env.MAUSCREW_DEEPSEEK_PYTHON || "",
        runtime: { mode: "wsl", distribution: "Ubuntu", strategy },
      }),
    });
    const recorder = recordEvents(instance.adapter);
    try {
      await instance.adapter.sendTurn({ threadId: `t-live-${strategy}`, text: "Reply with exactly: ok", cwd: scratch });
      const done = (await recorder.until((e) => e.type === "turn.completed", 120_000)) as { ok: boolean };
      expect(
        done.ok,
        JSON.stringify(
          recorder.events.map((event) => ({
            type: event.type,
            ...(event.type === "turn.completed" ? { stopReason: event.stopReason } : {}),
            ...(event.type === "runtime.error" ? { message: event.message } : {}),
          })),
        ),
      ).toBe(true);
    } finally {
      recorder.stop();
      await instance.dispose();
      rmSync(scratch, { recursive: true, force: true });
    }
  }, 180_000);

  it("retains a real native session after the provider process restarts", async () => {
    const scratch = mkdtempSync(join(tmpdir(), "mauscrew-dsh-live-resume-"));
    const phrase = `quartz-${Date.now().toString(36)}`;
    const config = decodeConfig({
      sessionRoot: join(scratch, "sessions"),
      runtime: { mode: "wsl", distribution: "Ubuntu", strategy: "bundled" },
    });
    const create = () =>
      createDeepSeekInstance({
        instanceId: "live-native-resume",
        displayName: undefined,
        environment: { DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY! },
        enabled: true,
        config,
      });
    const run = async (
      instance: Awaited<ReturnType<typeof create>>,
      text: string,
      transcript?: Array<{ role: "user" | "assistant"; text: string }>,
    ) => {
      const recorder = recordEvents(instance.adapter);
      try {
        await instance.adapter.sendTurn({ threadId: "t-live-resume", text, cwd: scratch, transcript });
        const done = (await recorder.until((e) => e.type === "turn.completed", 120_000)) as { ok: boolean };
        expect(
          done.ok,
          JSON.stringify(
            recorder.events.map((event) => ({
              type: event.type,
              ...(event.type === "turn.completed" ? { stopReason: event.stopReason } : {}),
              ...(event.type === "runtime.error" ? { message: event.message } : {}),
              ...(event.type === "item.completed" && event.itemType === "assistant_text"
                ? { text: event.text }
                : {}),
            })),
          ),
        ).toBe(true);
        return recorder.events
          .filter((event) => event.type === "item.completed" && event.itemType === "assistant_text")
          .map((event) => ("text" in event ? event.text : ""))
          .join("\n");
      } finally {
        recorder.stop();
      }
    };

    let first = await create();
    try {
      await run(first, `Remember this exact phrase for the next turn: ${phrase}. Reply only: stored`);
    } finally {
      await first.dispose();
    }

    const second = await create();
    try {
      const answer = await run(
        second,
        "What exact phrase did I ask you to remember in the previous turn?",
        [
          { role: "user", text: `Remember this exact phrase for the next turn: ${phrase}. Reply only: stored` },
          { role: "assistant", text: "stored" },
        ],
      );
      expect(answer).toContain(phrase);
    } finally {
      await second.dispose();
      if (process.env.MAUSCREW_KEEP_DEEPSEEK_LIVE_SCRATCH !== "1") {
        rmSync(scratch, { recursive: true, force: true });
      } else {
        console.error(`kept live DeepSeek scratch: ${scratch}`);
      }
    }
  }, 240_000);
});

const LIVE_BUNDLED_SANDBOX = LIVE && process.env.MAUSCREW_DEEPSEEK_RUNTIME_STRATEGY === "bundled";
describe.skipIf(!LIVE_BUNDLED_SANDBOX)("DeepSeekHarnessDriver real sandbox", () => {
  it("allows a workspace file edit and denies an adjacent escape", async () => {
    const scratch = mkdtempSync(join(tmpdir(), "mauscrew-dsh-sandbox-"));
    const outside = `${scratch}-escape.txt`;
    const config = decodeConfig({
      runtime: { mode: "wsl", distribution: "Ubuntu", strategy: "bundled" },
      sandbox: { mode: "workspace-write" },
    });
    const instance = await createDeepSeekInstance({
      instanceId: "live-sandbox",
      displayName: undefined,
      environment: { DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY! },
      enabled: true,
      config,
    });
    const recorder = recordEvents(instance.adapter);
    const runApprovedEdit = async (threadId: string, target: string, content: string) => {
      let approvalChain = Promise.resolve();
      let approvalCount = 0;
      // A model may inspect or correct its edit with more than one tool call.
      // Approve every card from this test turn so the assertion measures the
      // sandbox boundary, not the model's chosen number of editor calls.
      const stopApproving = instance.adapter.onEvent((event) => {
        if (event.type !== "request.opened" || event.threadId !== threadId || !event.requestId) return;
        const requestId = event.requestId;
        approvalCount += 1;
        approvalChain = approvalChain.then(() =>
          instance.adapter.respondToRequest(threadId, requestId, { behavior: "allow" }),
        );
      });
      try {
        await instance.adapter.sendTurn({
          threadId,
          cwd: scratch,
          text: `Do not use bash. Use the filesystem/string-replace editor tool to create exactly this file: ${runtimePath(config, target)} with exact content: ${content}`,
        });
        const done = await recorder.until(
          (e) => e.type === "turn.completed" && e.threadId === threadId,
          120_000,
        );
        await approvalChain;
        expect(approvalCount).toBeGreaterThan(0);
        return done;
      } finally {
        stopApproving();
      }
    };
    try {
      const insidePath = join(scratch, "inside.txt");
      const insideDone = (await runApprovedEdit("t-live-sandbox-inside", insidePath, "inside")) as { ok: boolean };
      expect(insideDone.ok).toBe(true);
      expect(
        existsSync(insidePath),
        `${scratch} ` + JSON.stringify(
          recorder.events.map((event) => ({
            type: event.type,
            ...(event.type === "item.started" ? { title: event.title } : {}),
            ...(event.type === "item.completed"
              ? {
                  itemType: event.itemType,
                  ok: "ok" in event ? event.ok : undefined,
                  text: "text" in event ? event.text : undefined,
                }
              : {}),
            ...(event.type === "runtime.error" ? { message: event.message } : {}),
          })),
        ),
      ).toBe(true);
      expect(readFileSync(insidePath, "utf8")).toBe("inside");

      await runApprovedEdit("t-live-sandbox-escape", outside, "outside");
      expect(existsSync(outside)).toBe(false);
    } finally {
      recorder.stop();
      await instance.dispose();
      rmSync(scratch, { recursive: true, force: true });
      rmSync(outside, { force: true });
    }
  }, 180_000);
});

// Dynamic Cordis (P4-14) was tested against fakes only — the composition and
// approval plumbing, never the real model actually reaching for
// `cordis_run`. This is the live half: a real turn on the bundled/native
// runtime that must ask the model to define and execute a package, approve
// that one-time call through the real mailbox, and check the numeric answer
// only that package could have produced — so a model that just guessed
// cannot pass silently.
describe.skipIf(!LIVE_BUNDLED_SANDBOX)("DeepSeekHarnessDriver real Dynamic Cordis", () => {
  it("defines and runs a package via cordis_run, approved through the live mailbox", async () => {
    const scratch = mkdtempSync(join(tmpdir(), "mauscrew-dsh-cordis-"));
    const config = decodeConfig({
      runtime: { mode: "wsl", distribution: "Ubuntu", strategy: "bundled" },
    });
    const instance = await createDeepSeekInstance({
      instanceId: "live-dynamic-cordis",
      displayName: undefined,
      environment: { DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY! },
      enabled: true,
      config,
    });
    const recorder = recordEvents(instance.adapter);
    const threadId = "t-live-dynamic-cordis";
    const cordisRunApprovals: string[] = [];
    const stopApproving = instance.adapter.onEvent((event) => {
      if (event.type !== "request.opened" || event.threadId !== threadId || !event.requestId) return;
      if (event.tool === "cordis_run") cordisRunApprovals.push(event.requestId);
      // Approve every card this turn opens — a model may look before it
      // leaps, and what is under test is the mount and the answer, not the
      // exact number of tool calls it takes to get there.
      void instance.adapter.respondToRequest(threadId, event.requestId, { behavior: "allow" });
    });
    try {
      await instance.adapter.sendTurn({
        threadId,
        cwd: scratch,
        runtimeFeatures: { dynamicCordis: true },
        text:
          "Use the cordis_run tool to define and execute a brand-new package that computes 19 * 37 " +
          "and prints only the result. Do not compute it yourself or in your head — the printed " +
          "output of that package is the only source for your final answer. Reply with exactly that number and nothing else.",
      });
      const done = (await recorder.until((e) => e.type === "turn.completed", 180_000)) as { ok: boolean };
      expect(
        done.ok,
        JSON.stringify(
          recorder.events.map((event) => ({
            type: event.type,
            ...(event.type === "turn.completed" ? { stopReason: event.stopReason } : {}),
            ...(event.type === "runtime.error" ? { message: event.message } : {}),
            ...(event.type === "request.opened" ? { tool: event.tool } : {}),
          })),
        ),
      ).toBe(true);

      // The approval broker actually saw and gated a cordis_run call — proof
      // the runtime mounted dsh-cordis-host-runner/dsh-tool-cordis for real,
      // not just that dynamicCordis was requested.
      expect(cordisRunApprovals.length).toBeGreaterThan(0);

      const finalText = recorder.events
        .filter((event) => event.type === "item.completed" && event.itemType === "assistant_text")
        .map((event) => ("text" in event ? event.text : ""))
        .join("\n");
      expect(finalText).toContain("703");
    } finally {
      stopApproving();
      recorder.stop();
      await instance.dispose();
      rmSync(scratch, { recursive: true, force: true });
    }
  }, 240_000);
});
