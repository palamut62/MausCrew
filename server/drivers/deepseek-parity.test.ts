// Transport parity (spec §88, P4-03).
//
// The claim this file exists to defend is narrow and load-bearing: the native
// JSON-RPC transport and the Python bridge are interchangeable. Not "similar"
// — the same driver, the same events, in the same order, for the same
// scenario. Until that is demonstrated, removing the Python path (P4-04)
// would be a guess.
//
// Each transport is driven against its own scripted fake, and the two fakes
// are written to produce the same conversation:
//   * server/testing/fake-deepseek-bridge.ts — our newline protocol
//   * server/testing/fake-dsh-runtime.ts     — upstream's JSON-RPC wire
// So a difference in the RuntimeEvents out is a difference in the transport,
// which is exactly what these assertions are for.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ProviderInstance, RuntimeEvent } from "../contracts.ts";
import { recordEvents, type EventRecorder } from "../testing/events.ts";
import { createDeepSeekInstance } from "./deepseek-harness.ts";
import { decodeConfig } from "./deepseek/config.ts";

const here = dirname(fileURLToPath(import.meta.url));
const FAKE_BRIDGE = join(here, "..", "testing", "fake-deepseek-bridge.ts");
const FAKE_RUNTIME = join(here, "..", "testing", "fake-dsh-runtime.ts");

type Transport = "python" | "native";

interface Harness {
  instance: ProviderInstance;
  recorder: EventRecorder;
}

/** Build an instance on one transport. Everything except the transport row
 * is identical, so any behavioural difference has one possible cause. */
async function build(
  transport: Transport,
  environment: Record<string, string> = {},
  overrides: Record<string, unknown> = {},
): Promise<Harness> {
  const instance = await createDeepSeekInstance(
    {
      instanceId: `parity-${transport}`,
      displayName: `parity ${transport}`,
      environment: { DEEPSEEK_API_KEY: "sk-test", ...environment },
      enabled: true,
      config: decodeConfig({
        // the Python path runs its fake through "python"; process.execPath is
        // the interpreter that can actually run a .ts fake
        pythonPath: process.execPath,
        runtime: { mode: "external-python" },
        transport:
          transport === "native"
            ? { mode: "native", launchArgs: [process.execPath, FAKE_RUNTIME] }
            : { mode: "python" },
        ...overrides,
      }),
    },
    { scriptPath: FAKE_BRIDGE },
  );
  return { instance, recorder: recordEvents(instance.adapter) };
}

/** The comparable shape of an event stream: type plus the fields a user would
 * notice. Ids, timestamps and turn ids are per-run and deliberately dropped —
 * comparing those would only assert that two runs are two runs. */
function shape(events: RuntimeEvent[]): unknown[] {
  return events.map((event) => {
    const e = event as unknown as Record<string, unknown>;
    const out: Record<string, unknown> = { type: e.type };
    for (const field of ["streamKind", "delta", "ok", "stopReason", "itemType", "title", "text", "behavior"]) {
      if (e[field] !== undefined) out[field] = e[field];
    }
    return out;
  });
}

describe("transport parity: python bridge vs native JSON-RPC", () => {
  let live: ProviderInstance[] = [];
  let recorders: EventRecorder[] = [];
  let scratch: string;

  const open = async (transport: Transport, env?: Record<string, string>, overrides?: Record<string, unknown>) => {
    const harness = await build(transport, env, overrides);
    live.push(harness.instance);
    recorders.push(harness.recorder);
    return harness;
  };

  beforeEach(() => {
    scratch = mkdtempSync(join(tmpdir(), "omb-dsh-parity-"));
    live = [];
    recorders = [];
  });

  afterEach(async () => {
    for (const recorder of recorders) recorder.stop();
    for (const instance of live) await instance.dispose();
    try {
      rmSync(scratch, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    } catch {
      /* the OS will clean up %TEMP% eventually */
    }
  });

  it("produces the same event shape for a full turn on both transports", async () => {
    const results: Record<Transport, unknown[]> = { python: [], native: [] };
    for (const transport of ["python", "native"] as const) {
      const { instance, recorder } = await open(transport);
      await instance.adapter.sendTurn({ threadId: "t", text: "selam", cwd: scratch });
      await recorder.until((e) => e.type === "turn.completed");
      results[transport] = shape(recorder.events);
    }
    expect(results.native).toEqual(results.python);
  });

  it("reassembles the same multibyte text on both transports", async () => {
    for (const transport of ["python", "native"] as const) {
      const { instance, recorder } = await open(transport);
      await instance.adapter.sendTurn({ threadId: "t", text: "selam", cwd: scratch });
      await recorder.until((e) => e.type === "turn.completed");
      const text = recorder.events
        .filter((e) => e.type === "content.delta" && (e as { streamKind: string }).streamKind === "assistant_text")
        .map((e) => (e as { delta: string }).delta)
        .join("");
      expect(text, transport).toBe("Merhaba dünya 🌍");
    }
  });

  it("reports the same token usage on both transports", async () => {
    for (const transport of ["python", "native"] as const) {
      const { instance, recorder } = await open(transport);
      await instance.adapter.sendTurn({ threadId: "t", text: "selam", cwd: scratch });
      await recorder.until((e) => e.type === "turn.completed");
      const usage = recorder.events.find((e) => e.type === "thread.token-usage.updated") as
        | { input?: number; output?: number; totals?: { input?: number; output?: number } }
        | undefined;
      expect(usage, transport).toBeDefined();
      expect(JSON.stringify(usage), transport).toContain("12");
      expect(JSON.stringify(usage), transport).toContain("34");
    }
  });

  it("maps the same finish reason on both transports", async () => {
    for (const transport of ["python", "native"] as const) {
      const { instance, recorder } = await open(transport, { FAKE_DSH_MODE: "stopped-turn" });
      await instance.adapter.sendTurn({ threadId: "t", text: "selam", cwd: scratch });
      const done = (await recorder.until((e) => e.type === "turn.completed")) as { stopReason?: string };
      expect(done.stopReason, transport).toBe("length");
    }
  });

  it("reports subagent lifecycle identically on both transports", async () => {
    for (const transport of ["python", "native"] as const) {
      const { instance, recorder } = await open(transport, { FAKE_DSH_MODE: "subagent" });
      await instance.adapter.sendTurn({ threadId: "t", text: "delegate", cwd: scratch });
      await recorder.until((e) => e.type === "turn.completed");
      const chips = recorder.events.filter((e) => e.type === "item.started" || e.type === "item.completed");
      expect(chips.length, transport).toBeGreaterThan(0);
      expect(JSON.stringify(chips), transport).toContain("child-abcdef123456");
    }
  });

  it("reports tool activity identically on both transports", async () => {
    for (const transport of ["python", "native"] as const) {
      const { instance, recorder } = await open(transport, { FAKE_DSH_MODE: "tools" });
      await instance.adapter.sendTurn({ threadId: "t", text: "run it", cwd: scratch });
      await recorder.until((e) => e.type === "turn.completed");
      const started = recorder.events.find(
        (e) => e.type === "item.started" && (e as { itemType?: string }).itemType === "tool",
      ) as { title?: string } | undefined;
      expect(started, transport).toBeDefined();
      // the summary is built from the tool arguments on the native side and
      // shipped ready-made on the python side; both must name the command
      expect(started?.title, transport).toContain("ls -la");
      expect(recorder.events.some((e) => e.type === "item.completed"), transport).toBe(true);
    }
  });

  it("settles a turn on both transports when the runtime dies mid-turn", async () => {
    for (const transport of ["python", "native"] as const) {
      const { instance, recorder } = await open(transport, { FAKE_DSH_MODE: "crash-mid-turn" });
      await instance.adapter.sendTurn({ threadId: "t", text: "boom", cwd: scratch });
      const done = (await recorder.until((e) => e.type === "turn.completed")) as { ok: boolean };
      // A crash must never leave the thread busy; both transports settle it
      // as a failure rather than dropping it.
      expect(done.ok, transport).toBe(false);
    }
  });

  it("sends the same deterministic session id on both transports", async () => {
    const ids: string[] = [];
    for (const transport of ["python", "native"] as const) {
      const dump = join(scratch, `${transport}.json`);
      const { instance, recorder } = await open(transport, { FAKE_DSH_DUMP: dump });
      await instance.adapter.sendTurn({ threadId: "t-session", text: "hi", cwd: scratch });
      await recorder.until((e) => e.type === "turn.completed");
      const { commands, env } = JSON.parse(readFileSync(dump, "utf8"));
      // both fakes record what they were handed; the session id lives in a
      // different field because the wires differ, which is the point
      const sessionId =
        commands.find((c: Record<string, unknown>) => c.type === "turn.start")?.sessionId ??
        commands.find((c: Record<string, unknown>) => c.method === "session/prompt")?.params?.sessionId;
      ids.push(sessionId);
      // §12 holds on both transports: the key it needs, and nothing else
      expect(env.DEEPSEEK_API_KEY, transport).toBe("sk-test");
      expect(env.AWS_SECRET_ACCESS_KEY, transport).toBeUndefined();
      expect(env.GITHUB_TOKEN, transport).toBeUndefined();
      expect(env.SSH_AUTH_SOCK, transport).toBeUndefined();
    }
    expect(ids[0]).toBe("dsh:parity-python:t-session");
    expect(ids[1]).toBe("dsh:parity-native:t-session");
  });

  it("keeps one runtime process across turns on the native transport", async () => {
    const dump = join(scratch, "native-reuse.json");
    const { instance, recorder } = await open("native", { FAKE_DSH_DUMP: dump });
    await instance.adapter.sendTurn({ threadId: "t1", text: "a", cwd: scratch });
    await recorder.until((e) => e.type === "turn.completed" && e.threadId === "t1");
    await instance.adapter.sendTurn({ threadId: "t2", text: "b", cwd: scratch });
    await recorder.until((e) => e.type === "turn.completed" && e.threadId === "t2");

    const { commands } = JSON.parse(readFileSync(dump, "utf8"));
    // one handshake, two prompts: the same process served both turns
    expect(commands.filter((c: Record<string, unknown>) => c.method === "initialize")).toHaveLength(1);
    expect(commands.filter((c: Record<string, unknown>) => c.method === "session/prompt")).toHaveLength(2);
  });

  it("refuses a runtime that is not the DeepSeek harness", async () => {
    // The protocol has no version field; `serverInfo.name` is the only
    // identity on the wire, so it is the only thing that can catch a
    // misconfigured launchArgs pointing at some other program.
    const { instance } = await open("native", { FAKE_DSH_SERVER_NAME: "something-else" });
    await expect(instance.adapter.sendTurn({ threadId: "t", text: "hi", cwd: scratch })).rejects.toThrow(
      /identifies as "something-else"/,
    );
  });

  it("says what is missing instead of probing Python the native path never uses", async () => {
    const { instance } = await open("native", {}, { transport: { mode: "native", launchArgs: [] } });
    const snapshot = await instance.snapshot();
    expect(snapshot.state).toBe("unavailable");
    expect(snapshot.reason).toMatch(/runtime\.launchArgs/);
  });
});
