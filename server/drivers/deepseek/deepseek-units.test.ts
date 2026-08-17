// Unit tests for the DeepSeek Harness driver's pure pieces: config decoding,
// the wire protocol, session id mapping, the event mapping table, and the
// environment allowlist. None of these need a process, which is exactly why
// they were kept free of one.
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_TURN_TIMEOUT_MS,
  DeepSeekConfigError,
  decodeConfig,
  defaultConfig,
  describeBaseUrl,
} from "./config.ts";
import { discoverModels } from "./model-catalog.ts";
import { LineSplitter, checkHandshake, parseMessage, serializeCommand } from "./bridge-protocol.ts";
import { defaultWorkspaceFor, parseSessionId, sessionIdFor, sessionRootFor } from "./session-manager.ts";
import { mapMessage, isTerminal } from "./event-mapper.ts";
import { classifyError, describeError } from "./errors.ts";
import {
  buildBridgeEnv,
  checkCordisConfig,
  pythonCandidates,
  resolveBundledRuntime,
  runtimePath,
  toWslPath,
  withWslForwarding,
} from "./process-manager.ts";

const ctx = {
  provider: "deepseek-harness",
  providerInstanceId: "inst-1",
  threadId: "t-1",
  turnId: "turn-1",
};

describe("decodeConfig", () => {
  it("fills every field from an empty object", () => {
    const config = defaultConfig();
    expect(config.provider).toBe("deepseek-official");
    expect(config.apiKeyEnv).toBe("DEEPSEEK_API_KEY");
    expect(config.sandbox.mode).toBe("workspace-write");
    expect(config.runtime.strategy).toBe("bundled");
    expect(config.transport.mode).toBe("native");
    expect(config.maxTokens).toBeNull();
  });

  it("keeps an explicit legacy Python setup on the compatibility transport", () => {
    const config = decodeConfig({ pythonPath: "python3", transport: { mode: "python" } });
    expect(config.runtime.strategy).toBe("system");
    expect(config.transport.mode).toBe("python");
  });

  it("downgrades unknown enum values instead of throwing", () => {
    // a config from a newer build must still produce a usable instance
    expect(decodeConfig({ runtime: { mode: "quantum" } }).runtime.mode).toMatch(/wsl|external-python/);
    expect(decodeConfig({ sandbox: { mode: "yolo" } }).sandbox.mode).toBe("workspace-write");
    expect(decodeConfig({ sandbox: { mode: "workspace" } }).sandbox.mode).toBe("workspace-write");
  });

  it("rejects control characters and relative paths", () => {
    expect(() => decodeConfig({ provider: "a\nb" })).toThrow(DeepSeekConfigError);
    expect(() => decodeConfig({ sessionRoot: "relative/dir" })).toThrow(DeepSeekConfigError);
  });

  it("never carries an API key in the config shape", () => {
    expect(JSON.stringify(decodeConfig({ apiKey: "sk-leaked" }))).not.toContain("sk-leaked");
  });
});

describe("describeBaseUrl", () => {
  it("warns that the key travels to a custom host", () => {
    const result = describeBaseUrl("https://proxy.example.com/v1");
    expect(result.ok).toBe(true);
    expect(result.warning).toContain("proxy.example.com");
  });

  it("calls out plaintext HTTP", () => {
    expect(describeBaseUrl("http://proxy.example.com").warning).toContain("unencrypted");
  });

  it("stays quiet for localhost and rejects non-http schemes", () => {
    expect(describeBaseUrl("http://localhost:8080").warning).toBeUndefined();
    expect(describeBaseUrl("file:///etc/passwd").ok).toBe(false);
  });
});

describe("bridge protocol", () => {
  it("ignores message types it has never heard of", () => {
    expect(parseMessage({ type: "quantum.entangled", requestId: "r" })).toBeNull();
    expect(parseMessage("not an object")).toBeNull();
  });

  it("drops turn-scoped messages with no correlation id", () => {
    expect(parseMessage({ type: "assistant.delta", delta: "hi" })).toBeNull();
    // bridge-level messages need none
    expect(parseMessage({ type: "error", code: "x", message: "y" })).not.toBeNull();
  });

  it("gates on protocol version in both directions", () => {
    expect(checkHandshake({ protocolVersion: 1 }).ok).toBe(true);
    expect(checkHandshake({ protocolVersion: 0 }).ok).toBe(false);
    expect(checkHandshake({ protocolVersion: 99 }).reason).toContain("update MausCrew");
  });

  it("serializes commands as one newline-terminated line", () => {
    const line = serializeCommand({ type: "shutdown" });
    expect(line.endsWith("\n")).toBe(true);
    expect(line.trim().includes("\n")).toBe(false);
  });
});

describe("LineSplitter", () => {
  it("reassembles a line split across chunks", () => {
    const splitter = new LineSplitter();
    expect(splitter.push('{"a":')).toEqual([]);
    expect(splitter.push('1}\n')).toEqual(['{"a":1}']);
  });

  it("emits several lines from one chunk and skips blanks", () => {
    expect(new LineSplitter().push("a\n\nb\n")).toEqual(["a", "b"]);
  });

  it("drops a runaway line rather than growing without bound", () => {
    const splitter = new LineSplitter(16);
    expect(splitter.push("x".repeat(64))).toEqual([]);
    expect(splitter.push("tail\n")).toEqual(["tail"]);
  });
});

describe("session mapping", () => {
  it("is deterministic, so a restart lands on the same session", () => {
    expect(sessionIdFor("inst", "thread")).toBe(sessionIdFor("inst", "thread"));
    expect(sessionIdFor("inst", "thread")).toBe("dsh:inst:thread");
  });

  it("folds away path-escaping characters", () => {
    // dots survive (they are legal in a name); the separators that would
    // make them a traversal do not
    expect(sessionIdFor("../etc", "a/b")).toBe("dsh:..-etc:a-b");
    expect(sessionIdFor("..\\..\\win", "t")).not.toContain("\\");
  });

  it("round-trips and refuses foreign cursors", () => {
    expect(parseSessionId(sessionIdFor("i", "t"))).toEqual({ instanceId: "i", threadId: "t" });
    expect(parseSessionId("claude:abc")).toBeNull();
  });

  it("never puts a workspace in the home directory itself", () => {
    const workspace = defaultWorkspaceFor("inst", "thread");
    expect(workspace).toContain("workspaces");
    expect(workspace.endsWith("thread")).toBe(true);
    expect(sessionRootFor("inst", "")).toContain("instance-inst");
  });
});

describe("event mapping", () => {
  it("maps deltas to canonical content.delta with the right stream kind", () => {
    const [assistant] = mapMessage({ type: "assistant.delta", requestId: "r", delta: "hi" }, ctx);
    expect(assistant).toMatchObject({ type: "content.delta", streamKind: "assistant_text", delta: "hi" });
    const [reasoning] = mapMessage({ type: "reasoning.delta", requestId: "r", delta: "hm" }, ctx);
    expect(reasoning).toMatchObject({ streamKind: "reasoning_text" });
  });

  it("treats a non-completion finish reason as a failed turn", () => {
    const [ok] = mapMessage(
      { type: "turn.completed", requestId: "r", finishReason: "completed", finalResponse: "" },
      ctx,
    );
    expect(ok).toMatchObject({ type: "turn.completed", ok: true, stopReason: null });
    const [bad] = mapMessage(
      { type: "turn.completed", requestId: "r", finishReason: "length", finalResponse: "" },
      ctx,
    );
    expect(bad).toMatchObject({ ok: false, stopReason: "length" });
  });

  it("keeps delegated-run metadata for the rich activity card", () => {
    const [started] = mapMessage(
      {
        type: "subagent.started",
        requestId: "r",
        parentSessionId: "root",
        childSessionId: "child-123456789",
      },
      ctx,
    );
    expect(started).toMatchObject({
      type: "item.started",
      subagent: { childSessionId: "child-123456789", parentSessionId: "root", status: "running" },
    });

    const [finished] = mapMessage(
      {
        type: "subagent.finished",
        requestId: "r",
        parentSessionId: "root",
        childSessionId: "child-123456789",
        provider: "local",
        agentId: "researcher",
        ok: true,
        stopReason: "completed",
        lastAssistantMessage: "Found the issue.",
      },
      ctx,
    );
    expect(finished).toMatchObject({
      type: "item.completed",
      ok: true,
      subagent: {
        provider: "local",
        agentId: "researcher",
        status: "completed",
        lastAssistantMessage: "Found the issue.",
      },
    });
  });

  it("produces nothing for the handshake and marks terminals", () => {
    expect(
      mapMessage(
        {
          type: "bridge.ready",
          protocolVersion: 1,
          sdkVersion: "1",
          capabilities: { streaming: true, sessions: true, cancel: false, approvals: false },
        },
        ctx,
      ),
    ).toEqual([]);
    expect(isTerminal({ type: "turn.completed", requestId: "r", finishReason: null, finalResponse: "" })).toBe(true);
    expect(isTerminal({ type: "assistant.delta", requestId: "r", delta: "x" })).toBe(false);
  });
});

describe("error classification", () => {
  it("routes install failures to setup and transient ones to retry", () => {
    expect(classifyError(new Error("spawn python ENOENT"))).toBe("python_missing");
    expect(classifyError(new Error("ModuleNotFoundError: no module"))).toBe("sdk_missing");
    expect(classifyError(new Error("401 Unauthorized"))).toBe("unauthorized");
    expect(describeError("sdk_missing").setup).toBe(true);
    expect(describeError("upstream").setup).toBe(false);
  });

  it("leaves an unrecognized failure unknown rather than guessing", () => {
    expect(classifyError(new Error("something odd happened"))).toBe("unknown");
  });
});

describe("bridge environment", () => {
  const config = decodeConfig({ baseUrl: "https://api.example.com" });

  it("passes only the allowlisted variables, never the server's own secrets", () => {
    const before = { AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY, GITHUB_TOKEN: process.env.GITHUB_TOKEN };
    process.env.AWS_SECRET_ACCESS_KEY = "aws-should-not-leak";
    process.env.GITHUB_TOKEN = "gh-should-not-leak";
    try {
      const env = buildBridgeEnv({ config, apiKey: "sk-test", sessionRoot: "/tmp/sessions", instanceEnv: {} });
      const serialized = JSON.stringify(env);
      expect(serialized).not.toContain("aws-should-not-leak");
      expect(serialized).not.toContain("gh-should-not-leak");
      expect(env.AWS_SECRET_ACCESS_KEY).toBeUndefined();
      expect(env.SSH_AUTH_SOCK).toBeUndefined();
      expect(env.DEEPSEEK_API_KEY).toBe("sk-test");
      expect(env.DEEPSEEK_BASE_URL).toBe("https://api.example.com");
      expect(env.DSH_SANDBOX_MODE).toBe("workspace-write");
    } finally {
      if (before.AWS_SECRET_ACCESS_KEY === undefined) delete process.env.AWS_SECRET_ACCESS_KEY;
      else process.env.AWS_SECRET_ACCESS_KEY = before.AWS_SECRET_ACCESS_KEY;
      if (before.GITHUB_TOKEN === undefined) delete process.env.GITHUB_TOKEN;
      else process.env.GITHUB_TOKEN = before.GITHUB_TOKEN;
    }
  });

  it("will not let an instance override shadow the API key or smuggle newlines", () => {
    const env = buildBridgeEnv({
      config,
      apiKey: "sk-real",
      sessionRoot: "/tmp/s",
      instanceEnv: {
        DEEPSEEK_API_KEY: "sk-stale",
        DSH_SANDBOX_MODE: "danger-full-access",
        EVIL: "a\nPATH=/tmp",
        FINE: "ok",
      },
    });
    expect(env.DEEPSEEK_API_KEY).toBe("sk-real");
    expect(env.EVIL).toBeUndefined();
    expect(env.FINE).toBe("ok");
    expect(env.DSH_SANDBOX_MODE).toBe("workspace-write");
  });

  it("forwards allowlisted bridge variables into WSL without replacing Linux host paths", () => {
    const env = withWslForwarding({
      PATH: "C:\\Windows\\System32",
      HOME: "C:\\Users\\example",
      DEEPSEEK_API_KEY: "sk-test",
      DSH_CWD: "/mnt/c/workspace",
      CUSTOM_PROVIDER_TOKEN: "token",
    });

    expect(env.WSLENV.split(":")).toEqual([
      "DEEPSEEK_API_KEY",
      "DSH_CWD",
      "CUSTOM_PROVIDER_TOKEN",
    ]);
    expect(env.WSLENV).not.toContain("PATH");
    expect(env.WSLENV).not.toContain("HOME");
    expect(env.WSLENV).not.toContain("sk-test");
  });
});

describe("telemetry switches", () => {
  it("hard-disables by default, because opting a user in silently is not ours to do", () => {
    const env = buildBridgeEnv({
      config: decodeConfig({}),
      apiKey: "sk",
      sessionRoot: "/tmp/s",
      instanceEnv: {},
    });
    // DSH_TELEMETRY_DISABLED is the pre-load hard opt-out and outranks every
    // configured mode upstream, so it is the switch that actually guarantees
    // the default rather than merely requesting it.
    expect(env.DSH_TELEMETRY_DISABLED).toBe("1");
    expect(env.DSH_TELEMETRY_MODE).toBeUndefined();
  });

  it("sends a mode only when the user chose one", () => {
    const full = buildBridgeEnv({
      config: decodeConfig({ telemetry: "full" }),
      apiKey: "sk",
      sessionRoot: "/tmp/s",
      instanceEnv: {},
    });
    expect(full.DSH_TELEMETRY_MODE).toBe("FULL");
    expect(full.DSH_TELEMETRY_DISABLED).toBeUndefined();

    const feedback = buildBridgeEnv({
      config: decodeConfig({ telemetry: "feedback-only" }),
      apiKey: "sk",
      sessionRoot: "/tmp/s",
      instanceEnv: {},
    });
    expect(feedback.DSH_TELEMETRY_MODE).toBe("FEEDBACK_ONLY");
  });

  it("cannot be reversed by an instance env override", () => {
    // Otherwise a config entry could quietly undo a privacy choice made in
    // the UI, which is the one direction this must never travel.
    const env = buildBridgeEnv({
      config: decodeConfig({}),
      apiKey: "sk",
      sessionRoot: "/tmp/s",
      instanceEnv: { DSH_TELEMETRY_DISABLED: "", DSH_TELEMETRY_MODE: "FULL" },
    });
    expect(env.DSH_TELEMETRY_DISABLED).toBe("1");
    expect(env.DSH_TELEMETRY_MODE).toBeUndefined();
  });
});

describe("turn timeout config", () => {
  it("defaults to 30 minutes and clamps nonsense instead of throwing", () => {
    expect(decodeConfig({}).turnTimeoutMs).toBe(DEFAULT_TURN_TIMEOUT_MS);
    expect(decodeConfig({ turnTimeoutMs: "soon" }).turnTimeoutMs).toBe(DEFAULT_TURN_TIMEOUT_MS);
    // 0 would mean "every turn times out immediately" — the floor is what
    // keeps a typo from making the bot unusable
    expect(decodeConfig({ turnTimeoutMs: 0 }).turnTimeoutMs).toBe(1_000);
    expect(decodeConfig({ turnTimeoutMs: 999_999_999 }).turnTimeoutMs).toBe(6 * 60 * 60 * 1000);
  });

  it("rejects an unusable base URL at decode time rather than at the first turn", () => {
    expect(() => decodeConfig({ baseUrl: "ftp://models.example.com" })).toThrow(DeepSeekConfigError);
  });
});

describe("WSL path translation", () => {
  it("translates every path the bridge environment carries, not just the cwd", () => {
    // A Linux interpreter given C:\... writes the session log somewhere the
    // driver will never look again, so the thread silently loses its history.
    const env = buildBridgeEnv({
      config: decodeConfig({ runtime: { mode: "wsl" }, cordis: { configPath: "C:\\conf\\mauscrew.cordis.yml" } }),
      apiKey: "sk",
      sessionRoot: "C:\\Users\\u\\.mauscrew\\sessions",
      instanceEnv: {},
    });
    expect(env.DSH_SESSION_ROOT).toBe("/mnt/c/Users/u/.mauscrew/sessions");
    expect(env.DSH_CORDIS_CONFIG).toBe("/mnt/c/conf/mauscrew.cordis.yml");
  });

  it("leaves paths alone for a native interpreter", () => {
    const env = buildBridgeEnv({
      config: decodeConfig({ runtime: { mode: "external-python" } }),
      apiKey: "sk",
      sessionRoot: "C:\\Users\\u\\sessions",
      instanceEnv: {},
    });
    expect(env.DSH_SESSION_ROOT).toBe("C:\\Users\\u\\sessions");
  });
});

describe("cordis composition check", () => {
  it("names the missing file instead of letting the runtime fail obscurely", () => {
    const config = decodeConfig({
      runtime: { mode: "external-python" },
      cordis: { configPath: join(tmpdir(), "mauscrew-does-not-exist-mauscrew.cordis.yml") },
    });
    expect(() => checkCordisConfig(config)).toThrow(/missing/i);
  });

  it("says nothing when no composition is configured", () => {
    expect(() => checkCordisConfig(decodeConfig({}))).not.toThrow();
  });
});

describe("model discovery", () => {
  const ok = (ids: string[]) =>
    (async () =>
      new Response(JSON.stringify({ data: ids.map((id) => ({ id })) }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as unknown as typeof fetch;

  it("returns what the endpoint serves and keeps the configured model selectable", async () => {
    const catalog = await discoverModels({
      baseUrl: "https://api.example.com",
      apiKey: "sk",
      defaultModel: "private-build",
      fetchImpl: ok(["deepseek-v4-flash", "deepseek-v4-pro"]),
    });
    expect(catalog?.default).toBe("private-build");
    // an unadvertised model can still be servable; dropping it here would
    // silently switch the bot to something the user did not pick
    expect(catalog?.options.map((o) => o.id)).toContain("private-build");
    expect(catalog?.options.map((o) => o.id)).toContain("deepseek-v4-pro");
  });

  it("returns null on failure so the caller keeps its previous catalog", async () => {
    const boom = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    expect(
      await discoverModels({ baseUrl: "https://api.example.com", apiKey: "sk", defaultModel: "m", fetchImpl: boom }),
    ).toBeNull();
    // and never sends the key when there is no key to send
    expect(await discoverModels({ baseUrl: "", apiKey: "", defaultModel: "m", fetchImpl: ok(["x"]) })).toBeNull();
  });

  it("bounds a hostile response instead of pouring it into the picker", async () => {
    const flood = Array.from({ length: 5_000 }, (_, i) => `m-${i}`);
    const catalog = await discoverModels({
      baseUrl: "https://api.example.com",
      apiKey: "sk",
      defaultModel: "m-0",
      fetchImpl: ok(flood),
    });
    expect(catalog?.options.length).toBeLessThanOrEqual(100);
  });
});

describe("interpreter resolution", () => {
  it("builds a wsl argv array with no shell string anywhere", () => {
    const config = decodeConfig({ runtime: { mode: "wsl", distribution: "Ubuntu-22.04", strategy: "system" } });
    expect(pythonCandidates(config)[0]).toEqual(["wsl.exe", "-d", "Ubuntu-22.04", "--", "python3"]);
  });

  it("lets a configured interpreter win outright", () => {
    const config = decodeConfig({ pythonPath: "/usr/local/bin/python3.12", runtime: { mode: "external-python" } });
    expect(pythonCandidates(config)).toEqual([["/usr/local/bin/python3.12"]]);
  });

  it("uses the MausCrew-owned venv when managed runtime is selected", () => {
    const config = decodeConfig({ runtime: { mode: "wsl", strategy: "managed", distribution: "Ubuntu" } });
    const argv = pythonCandidates(config)[0];
    expect(argv.slice(0, 7)).toEqual(["wsl.exe", "-d", "Ubuntu", "--cd", "~", "--exec", "./.mauscrew/runtimes/deepseek/venv/bin/python"]);
    expect(argv.join(" ")).toContain(".mauscrew/runtimes/deepseek/venv/bin/python");
  });

  it("uses the runtime executable directly when bundled strategy names one", async () => {
    const config = decodeConfig({ runtime: { strategy: "bundled", executable: "/opt/dsh/runtime" } });
    expect(config.transport.mode).toBe("native");
    await expect(resolveBundledRuntime(config)).resolves.toEqual({ launchArgs: ["/opt/dsh/runtime"] });
  });

  it("translates Windows paths for a Linux interpreter", () => {
    expect(toWslPath("C:\\Users\\u\\ws")).toBe("/mnt/c/Users/u/ws");
    expect(toWslPath("/already/posix")).toBe("/already/posix");
    expect(runtimePath(decodeConfig({ runtime: { mode: "wsl" } }), "C:\\repo")).toBe("/mnt/c/repo");
    expect(runtimePath(decodeConfig({ runtime: { mode: "external-python" } }), "C:\\repo")).toBe("C:\\repo");
  });
});
