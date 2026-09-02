// Claude driver — upstream ClaudeDriver skeleton over agentcal's
// drivers/claude.js runtime (stream-json both directions, prompt over
// stdin, completion from a real `result` event — verified against
// claude 2.1.211 by agentcal). Per-turn CLI process; the conversation
// continues across turns via --resume <sessionId> (the resumeCursor).
//
// Integrations become MCP servers on the CLI:
//   - Composio Sessions (connected apps → tools) over streamable HTTP
//   - the bot's cloud computer (box.ascii.dev) via server/computer-proxy.ts
//     — screenshot/exec/open_url, the CUA-on-the-box bridge
import { existsSync, mkdtempSync, mkdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { createServer as createNetServer } from "node:net";
import { homedir, tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { DATA_DIR } from "../config.ts";
import { augmentedPath } from "../env-path.ts";
import { brokerSocketPath, describeSpawnFailure, execCli, killCliTree, spawnCli } from "../procs.ts";

import type {
  DriverCreateInput,
  ModelCatalog,
  ProviderDriver,
  ProviderInstance,
  ProviderSnapshot,
  RuntimeEvent,
  RuntimeEventListener,
  SendTurnInput,
} from "../contracts.ts";
import { computerProxyEnv } from "../container-computer.ts";
import { newEventId, newId } from "../contracts.ts";
import { appendNative } from "./native.ts";

/** Whether `claude` has been signed in.
 *
 * Credential storage is deliberately not inspected here. Claude Code uses the
 * macOS Keychain for OAuth, a JSON file on some platforms, and may gain other
 * backends over time. Presence checks also accept stale credentials. The CLI's
 * own machine-readable auth command is the source of truth for every backend.
 */
export function claudeSignedIn(
  cli: string,
  env: NodeJS.ProcessEnv,
  run: typeof execCli = execCli,
): Promise<boolean> {
  return new Promise((resolve) => {
    run(cli, ["auth", "status", "--json"], { timeout: 8000, env }, (_error, stdout) => {
      try {
        const status: unknown = JSON.parse(stdout);
        resolve(
          typeof status === "object" && status !== null && "loggedIn" in status && status.loggedIn === true,
        );
      } catch {
        resolve(false);
      }
    });
  });
}

/** The CLI environment shared by auth probes and real turns.
 *
 * Subscription users can be billed pay-as-you-go if an inherited API key
 * leaks through, and a nested CLI must not inherit this session's identity.
 * Keeping the probe and turn environments identical prevents setup from
 * claiming an API-key login that the turn itself would deliberately remove.
 */
function claudeEnvironment(config?: Pick<ClaudeConfig, "baseUrl" | "authToken" | "models">): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, PATH: augmentedPath(), NPM_CONFIG_LOGLEVEL: "error" };
  delete env.ANTHROPIC_API_KEY;
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_ENTRYPOINT;
  // The gateway variables are stripped for the same reason as the API key, and
  // it matters more here: an inherited ANTHROPIC_BASE_URL silently reroutes a
  // subscription instance to somebody else's endpoint, sending its whole
  // conversation there while still looking like plain Claude in the UI. Only
  // an instance that opted in via config gets them back, one line below.
  delete env.ANTHROPIC_BASE_URL;
  delete env.ANTHROPIC_AUTH_TOKEN;
  // Same argument for the tier overrides: an inherited mapping would make a
  // plain claude.ai instance quietly run somebody else's model ids.
  for (const key of TIER_MODEL_VARS) delete env[key];
  if (config?.baseUrl) {
    env.ANTHROPIC_BASE_URL = config.baseUrl;
    if (config.authToken) env.ANTHROPIC_AUTH_TOKEN = config.authToken;
    // `--model` names the model of the turn itself and nothing else. Claude
    // Code also makes its own calls — topic titles, file summaries, the
    // compaction pass — against its haiku/sonnet/opus TIERS, which resolve to
    // Anthropic ids a third-party endpoint has never heard of. That is the
    // "supported API model names are …" 400 arriving out of nowhere in the
    // middle of a working conversation. Pin every tier to something this
    // gateway actually serves.
    const tierModel = config.models?.[0];
    if (tierModel) for (const key of TIER_MODEL_VARS) env[key] = tierModel;
  }
  return env;
}

/** The tier→model mapping Claude Code reads. `ANTHROPIC_SMALL_FAST_MODEL` is
 * the deprecated spelling of the haiku one, set alongside it so an older CLI
 * on someone's PATH is covered too. */
const TIER_MODEL_VARS = [
  "ANTHROPIC_DEFAULT_HAIKU_MODEL",
  "ANTHROPIC_DEFAULT_SONNET_MODEL",
  "ANTHROPIC_DEFAULT_OPUS_MODEL",
  "ANTHROPIC_SMALL_FAST_MODEL",
] as const;

const DRIVER_KIND = "claudeAgent";

export interface ClaudeConfig {
  cli: string;
  permissionMode: "acceptEdits" | "auto" | "manual" | "bypassPermissions";
  /** Anthropic-compatible gateway this instance talks to instead of
   * api.anthropic.com — DeepSeek's /anthropic endpoint, a local CLIProxyAPI,
   * OpenRouter, anything speaking the same wire format. Absent means the CLI's
   * own claude.ai login, which stays the default. */
  baseUrl?: string;
  /** Bearer token for `baseUrl`. Ignored without one, so a stray token can
   * never be sent to Anthropic. */
  authToken?: string;
  /** Model ids the gateway serves. The built-in Claude catalog is meaningless
   * against a third-party endpoint, so an instance that sets `baseUrl` almost
   * always sets this too; the first entry becomes the default. */
  models?: string[];
}

// model catalog ported from upstream packages/contracts/src/model.ts
const MODELS = {
  default: "claude-sonnet-5",
  options: [
    { id: "claude-fable-5", label: "Claude Fable 5" },
    { id: "claude-opus-5", label: "Claude Opus 5" },
    { id: "claude-sonnet-5", label: "Claude Sonnet 5" },
    { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
  ],
};

/** A gateway instance advertises what its gateway serves, not Claude's
 * catalog. Ids are shown verbatim: only the operator knows what
 * `deepseek-v4-pro` or `gpt-5.6-sol` should be called.
 *
 * A gateway that named no models gets an EMPTY catalog rather than Claude's.
 * Offering "Claude Sonnet 5" on someone's DeepSeek endpoint is an invitation
 * to pick a model that endpoint will reject — an error one turn later and
 * nowhere near the picker that caused it. Empty is honest, and `extensible`
 * keeps a hand-written selection working until that list exists.
 *
 * Once the list DOES exist it is closed, unlike the other extensible catalogs
 * here. The difference is who wrote it: xAI's list is ours and may lag their
 * private builds, but a gateway's list is the operator's own answer to what
 * this endpoint serves. A selection outside it is a stale id — from an earlier
 * edit, or from another gateway — and closing the catalog is what lets
 * model-selection.ts repair the bot instead of shipping that id as `--model`
 * and turning it into a raw provider 400. Adding a model is one line in
 * Settings → Claude gateways. */
function modelsFor(config: ClaudeConfig): ModelCatalog {
  if (!config.baseUrl) return MODELS;
  if (!config.models?.length) return { default: "", options: [], extensible: true };
  return { default: config.models[0], options: config.models.map((id) => ({ id, label: id })) };
}

/** Whether this failure is the endpoint refusing the model id rather than
 * anything a retry could fix. Matched on the sentence because that is all the
 * CLI passes through — the HTTP body never reaches us — and these are the
 * spellings DeepSeek, OpenRouter and the CLI itself actually use. Returns the
 * provider's own words, so the advice can quote the source. */
function modelRejection(text: string): string | null {
  const line = text.trim();
  if (!line) return null;
  const rejected =
    /supported api model names/i.test(line) ||
    /issue with the selected model/i.test(line) ||
    /\bmodel[_ ]not[_ ]found\b/i.test(line) ||
    /(unknown|invalid|unsupported|no such) model/i.test(line);
  return rejected ? line.slice(0, 300) : null;
}

/**
 * The refusal that is about the endpoint, not the model id.
 *
 * Claude Code declares MCP tools by reference and leaves their schemas out of
 * `tools[]`, expecting the endpoint to resolve them on demand. An endpoint
 * that speaks Anthropic's wire format without implementing that part refuses
 * the whole turn with a 400 — and since every MausCrew bot mounts MCP tools,
 * such a pairing can never run a single turn. It surfaced as a raw API error
 * that reads like a MausCrew fault, and the model-id advice next door would
 * have sent the user to correct a setting that was already right.
 */
function deferralRefusal(text: string): string | null {
  if (!/deferred custom tools/i.test(text)) return null;
  const model = text.match(/Received ([^\s.]+)/i)?.[1];
  return `this endpoint does not implement Claude Code's deferred tool calls${model ? ` for "${model}"` : ""}, and every bot here mounts tools that way.`;
}

/** Aggregators namespace their ids (`deepseek/deepseek-v4-pro`); a vendor's own
 * endpoint serves bare ones (`deepseek-v4-pro`). Pasting one convention into
 * the other is the most common way a correctly configured gateway rejects every
 * turn, so name it rather than leave the user comparing two strings that differ
 * by a prefix. */
function namingHint(baseUrl: string, model: string): string {
  if (!model) return "";
  let host: string;
  try {
    host = new URL(baseUrl).hostname;
  } catch {
    host = "";
  }
  const aggregator = /(^|\.)(openrouter\.ai|llmgateway\.io|together\.xyz)$/i.test(host);
  const namespaced = model.includes("/");
  if (!aggregator && namespaced) {
    const bare = model.split("/").slice(1).join("/");
    return ` ${host || "This endpoint"} serves bare model ids — "${bare}", not "${model}". The namespaced form is OpenRouter's.`;
  }
  if (aggregator && !namespaced) return ` ${host} needs a namespaced id — "vendor/${model}", not "${model}".`;
  return "";
}

/** The sentence shown beside a provider's refusal: what was asked for, who
 * refused it, and the one screen that changes it. */
function gatewayModelAdvice(config: ClaudeConfig, engine: string, model: string | undefined, complaint: string): string {
  const asked = model || modelsFor(config).default;
  if (!config.baseUrl) return `${engine} rejected the model "${asked}": ${complaint}`;
  return `${engine} rejected the model "${asked}".${namingHint(config.baseUrl, asked)} Fix the id in Settings → Claude gateways — every bot on this engine uses that list. The endpoint said: ${complaint}`;
}

/** Same shape as the advice above, for the refusal that no model id can fix:
 * the endpoint is the wrong kind, so the answer is a different model family
 * or a different engine. */
function gatewayCapabilityAdvice(engine: string, model: string | undefined, complaint: string): string {
  const asked = model ? `"${model}"` : "this model";
  return `${engine} could not run ${asked}: ${complaint} Pick a model this endpoint serves in Anthropic's own format — on an aggregator that means an \`anthropic/…\` id — or run the bot on an engine that talks to the vendor directly.`;
}

// proxy entry files live next to this one as .ts in dev (node type
// stripping) and .js in the compiled dist-server the packaged app ships
const proxyPath = (basename: string) => {
  const ts = join(dirname(fileURLToPath(import.meta.url)), "..", `${basename}.ts`);
  return existsSync(ts) ? ts : ts.replace(/\.ts$/, ".js");
};
const PROXY_PATH = proxyPath("computer-proxy");
const PERM_PROXY_PATH = proxyPath("permission-proxy");
const DWEB_PROXY_PATH = proxyPath("drivers/dweb-proxy");
// in the packaged app process.execPath is the Electron binary — this env
// makes it behave as plain node for the spawned MCP proxies (harmless in dev)
const NODE_ENV_FLAG = { ELECTRON_RUN_AS_NODE: "1" };

// Kept as a tiny standalone ESM program because Claude executes hook
// commands out-of-process and sends the hook JSON over stdin. It deliberately
// knows only the broker socket: policy classification and audit recording stay
// in the harness, never in a provider-specific script.
const PRE_TOOL_USE_HOOK = String.raw`import { connect } from "node:net";
import { randomUUID } from "node:crypto";

const socketPath = __SOCKET__;
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  let payload = {};
  try { payload = JSON.parse(input); } catch {}
  const tool = String(payload.tool_name ?? "tool");
  const toolInput = payload.tool_input && typeof payload.tool_input === "object" ? payload.tool_input : {};
  const id = randomUUID();
  let buffer = "";
  let finished = false;
  const finish = (decision, reason) => {
    if (finished) return;
    finished = true;
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: decision, permissionDecisionReason: reason } }) + "\n");
    process.exit(0);
  };
  const conn = connect(socketPath);
  conn.setTimeout(900000, () => finish("deny", "MausCrew approval timed out"));
  conn.on("error", () => finish("deny", "MausCrew permission broker unavailable"));
  conn.on("data", (chunk) => {
    buffer += chunk;
    let nl;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, nl); buffer = buffer.slice(nl + 1);
      let answer;
      try { answer = JSON.parse(line); } catch { continue; }
      if (answer.t === "answer" && answer.id === id) {
        finish(answer.behavior === "allow" ? "allow" : "deny", String(answer.message ?? "MausCrew approval required"));
        conn.end();
      }
    }
  });
  conn.on("connect", () => {
    conn.write(JSON.stringify({ t: "ask", id, tool, input: toolInput }) + "\n");
  });
});`;

// ── permission broker (ported from agentcal drivers/claude.js) ─────────
// A headless run that hits a permission acceptEdits doesn't cover should
// neither stall silently NOR get blanket-denied — it should ask the user.
// The broker is a net server on a per-turn socket; the proxy (spawned by
// the claude CLI) forwards asks over it and waits. Unanswered permission
// asks deny after timeoutMs with a keep-moving note; unanswered questions
// answer with "use your best judgment" — guidance, never a block.
interface Ask {
  id: string;
  kind: "permission" | "question";
  tool: string;
  input: Record<string, unknown>;
  at: number;
}

const DENY_TIMEOUT_NOTE =
  "MausCrew: nobody answered this permission request in time. Skip this action and finish what you can without it.";
const QUESTION_TIMEOUT_NOTE = "MausCrew: nobody answered in time. Use your best judgment and continue.";

/** One human-readable line for an ask — what the card subtitle shows. */
function askSummary(ask: Ask): string {
  const input = ask.input ?? {};
  if (typeof input.question === "string") return input.question.slice(0, 300);
  if (typeof input.command === "string") return input.command.slice(0, 200);
  if (typeof input.url === "string") return input.url.slice(0, 200);
  const text = JSON.stringify(input);
  return text === "{}" ? (ask.tool ?? "tool") : text.slice(0, 200);
}

/**
 * One address per TURN, not per thread.
 *
 * Naming it after the thread meant every turn in a conversation reused the
 * same address. Closing a server stops it accepting new connections but does
 * not drop the ones already open, so while the previous turn's CLI was still
 * exiting it kept the address held — and the next turn's listen failed. That
 * turn then ran with no broker at all: its proxy could not connect, and every
 * approval came back "permission broker unavailable". Commands the policy
 * already allowed still worked, which is what made it look like certain
 * commands were blocked rather than approvals being broken.
 */
export function permissionSocketPath(threadId: string, turnId: string) {
  const tag = `${threadId.replace(/[^\w-]/g, "").slice(0, 8)}-${turnId.replace(/[^\w-]/g, "").slice(0, 8)}`;
  return brokerSocketPath(DATA_DIR, tag);
}

function createPermissionBroker(opts: {
  socketPath: string;
  onAsk: (ask: Ask) => void;
  onResolve: (resolved: Ask & { behavior: string; source: string }) => void;
  timeoutMs?: number;
}) {
  const timeoutMs = opts.timeoutMs ?? 15 * 60_000;
  const pending = new Map<string, { ask: Ask; finish: (behavior: string, message: string | undefined, source: string) => void }>();
  try {
    unlinkSync(opts.socketPath);
  } catch {}
  const server = createNetServer((conn) => {
    conn.on("error", () => {});
    let buf = "";
    conn.on("data", (chunk) => {
      buf += chunk;
      let nl;
      while ((nl = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        let msg: any;
        try {
          msg = JSON.parse(line);
        } catch {
          continue;
        }
        if (msg.t !== "ask") continue;
        const askId = String(msg.id ?? newId());
        const kind = msg.kind === "question" ? ("question" as const) : ("permission" as const);
        const ask: Ask = { id: askId, kind, tool: msg.tool ?? "tool", input: msg.input ?? {}, at: Date.now() };
        const finish = (behavior: string, message: string | undefined, source: string) => {
          if (!pending.delete(askId)) return;
          clearTimeout(timer);
          try {
            conn.write(JSON.stringify({ t: "answer", id: askId, behavior, message }) + "\n");
          } catch {}
          opts.onResolve({ ...ask, behavior, source });
        };
        const timer = setTimeout(
          () =>
            kind === "question"
              ? finish("answer", QUESTION_TIMEOUT_NOTE, "timeout")
              : finish("deny", DENY_TIMEOUT_NOTE, "timeout"),
          timeoutMs,
        );
        timer.unref?.();
        pending.set(askId, { ask, finish });
        opts.onAsk(ask);
      }
    });
  });
  // A broker that never came up used to be silent — every approval then
  // timed out into a deny nobody could explain. Keep the turn fail-closed,
  // but leave an actionable diagnostic.
  server.on("error", (error) => {
    console.error(`permission broker unavailable on ${opts.socketPath}: ${error.message}`);
  });
  server.listen(opts.socketPath);
  return {
    answer(askId: string, behavior: string, message?: string): boolean {
      const p = pending.get(askId);
      if (!p) return false;
      const valid = p.ask.kind === "question" ? ["answer"] : ["allow", "deny"];
      if (!valid.includes(behavior)) return false;
      p.finish(behavior, message, "user");
      return true;
    },
    close() {
      for (const p of [...pending.values()]) {
        if (p.ask.kind === "question") p.finish("answer", "MausCrew: the turn is ending — wrap up.", "shutdown");
        else p.finish("deny", "MausCrew: the turn ended", "shutdown");
      }
      try {
        server.close();
      } catch {}
      try {
        unlinkSync(opts.socketPath);
      } catch {}
    },
  };
}

function decodeConfig(raw: unknown): ClaudeConfig {
  const o = (raw ?? {}) as Record<string, unknown>;
  const mode = o.permissionMode;
  if (mode !== undefined && mode !== "acceptEdits" && mode !== "auto" && mode !== "manual" && mode !== "bypassPermissions") {
    throw new Error(`claude: invalid permissionMode ${JSON.stringify(mode)}`);
  }
  // A malformed gateway URL must fail here rather than at spawn time: the CLI
  // treats an unparseable base URL as a network error, which reads as "the
  // provider is down" instead of "this setting is wrong".
  let baseUrl: string | undefined;
  if (o.baseUrl !== undefined && o.baseUrl !== "") {
    if (typeof o.baseUrl !== "string") throw new Error(`claude: invalid baseUrl ${JSON.stringify(o.baseUrl)}`);
    let parsed: URL;
    try {
      parsed = new URL(o.baseUrl);
    } catch {
      throw new Error(`claude: baseUrl is not a URL: ${o.baseUrl}`);
    }
    // http is allowed only for loopback — that is the local-gateway case
    // (CLIProxyAPI on 127.0.0.1). Anywhere else it would put the token and the
    // whole conversation on the wire in clear text.
    const loopback = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost" || parsed.hostname === "[::1]";
    if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && loopback)) {
      throw new Error(`claude: baseUrl must be https (or http on loopback): ${o.baseUrl}`);
    }
    baseUrl = o.baseUrl;
  }

  const models = Array.isArray(o.models) ? o.models.filter((m): m is string => typeof m === "string" && m !== "") : undefined;

  return {
    cli: typeof o.cli === "string" ? o.cli : "claude",
    // Manual is Claude Code's permission-gated mode. Keeping it as the
    // default makes the Security panel truthful: filesystem and shell asks
    // reach MausCrew instead of being silently accepted by acceptEdits.
    permissionMode: (mode as ClaudeConfig["permissionMode"]) ?? "manual",
    baseUrl,
    authToken: typeof o.authToken === "string" && o.authToken !== "" ? o.authToken : undefined,
    models: models?.length ? models : undefined,
  };
}

function firstText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((b) => b?.type === "text" && b.text)
      .map((b) => b.text)
      .join("");
  }
  return "";
}

export const ClaudeDriver: ProviderDriver<ClaudeConfig> = {
  driverKind: DRIVER_KIND,
  metadata: { displayName: "Claude", supportsMultipleInstances: true },
  // npm on all three: the one recipe that is genuinely cross-platform. The
  // native installers differ per OS and would need verifying separately.
  install: {
    command: {
      darwin: "npm install -g @anthropic-ai/claude-code",
      linux: "npm install -g @anthropic-ai/claude-code",
      win32: "npm install -g @anthropic-ai/claude-code",
    },
    needsNode: true,
    docsUrl: "https://claude.com/claude-code",
    signInCommand: "claude",
  },
  models: MODELS,
  decodeConfig,
  defaultConfig: () => decodeConfig({}),

  async create(input: DriverCreateInput<ClaudeConfig>): Promise<ProviderInstance> {
    const { instanceId, config } = input;
    const listeners = new Set<RuntimeEventListener>();
    // one active turn per thread; a second send while busy is a caller bug
    const active = new Map<string, { stop: () => void; turnId: string; broker?: ReturnType<typeof createPermissionBroker> }>();

    const emit = (event: RuntimeEvent) => {
      for (const l of [...listeners]) l(event);
    };
    const base = (threadId: string, turnId: string) => ({
      eventId: newEventId(),
      provider: DRIVER_KIND,
      threadId,
      turnId,
      createdAt: new Date().toISOString(),
    });

    const sendTurn = async (turn: SendTurnInput) => {
      const { threadId } = turn;
      if (active.has(threadId)) throw new Error("a turn is already running on this thread");
      const turnId = newId();
      const sessionId = typeof turn.resumeCursor === "string" ? turn.resumeCursor : null;
      const newSessionId = sessionId ? null : newId();

      const args = [
        "-p",
        "--output-format", "stream-json",
        "--input-format", "stream-json",
        "--verbose", // required by stream-json output
        // token-level streaming: content_block_delta events between the
        // whole-message frames, so the bubble grows as the model writes
        "--include-partial-messages",
        // A bot must not inherit the user's connector registry or permissive
        // ~/.claude/settings.json. Authentication is still owned by Claude's
        // normal credential store, while settings and MCP servers are scoped
        // to this invocation and the integrations we explicitly compose.
        "--setting-sources", "project,local",
        "--strict-mcp-config",
        "--permission-mode", config.permissionMode === "auto" ? "acceptEdits" : config.permissionMode,
      ];
      if (sessionId) args.push("--resume", sessionId);
      else args.push("--session-id", newSessionId!);
      if (turn.model) args.push("--model", turn.model);
      if (turn.effort) args.push("--effort", turn.effort);
      if (turn.system) args.push("--append-system-prompt", turn.system);

      // integrations → MCP servers; pre-allow their tools (a headless
      // acceptEdits run silently denies anything unlisted)
      const mcpServers: Record<string, unknown> = {};
      const allowed: string[] = [];
      if (turn.integrations?.composio) {
        mcpServers.composio = {
          type: "http",
          url: turn.integrations.composio.url,
          headers: turn.integrations.composio.headers,
        };
        allowed.push("mcp__composio");
      }
      if (turn.integrations?.computer) {
        mcpServers.computer = {
          command: process.execPath,
          args: [PROXY_PATH],
          env: { ...NODE_ENV_FLAG, ...computerProxyEnv(turn.integrations.computer) },
        };
        allowed.push("mcp__computer");
      } else if (turn.integrations?.localComputer) {
        // A direct Cua Driver MCP connection. This can be the Electron-owned
        // host daemon or the isolated Local VM; the agent sees the same
        // "computer" server either way.
        mcpServers.computer = { ...turn.integrations.localComputer };
        allowed.push("mcp__computer");
      }
      if (turn.integrations?.pcBrowser) {
        mcpServers.pcbrowser = { ...turn.integrations.pcBrowser };
        allowed.push("mcp__pcbrowser");
      }
      // peer-agent comms (list_bots/ask_bot) — the harness builds the whole
      // spawn contract (command/args/env incl. the boot token) in
      // agentsIntegration(); pre-allowing matters doubly here, or the CLI's
      // own ListAgents look-alike shadows it and "@Bot" asks go nowhere
      if (turn.integrations?.agents) {
        mcpServers.agents = { ...turn.integrations.agents };
        allowed.push("mcp__agents");
      }
      // the bot's own Automations calendar via server/drivers/routines-proxy.ts.
      // Pre-allowed like agents: an approval card on every create_routine
      // would put the schedule back in the user's hands, which is the manual
      // step this integration exists to remove. The routine shows up live in
      // Automations, where the user can pause or delete it.
      if (turn.integrations?.routines) {
        mcpServers.routines = { ...turn.integrations.routines };
        allowed.push("mcp__routines");
      }
      // dweb network daemon (status / repo / opencode model access) via
      // server/drivers/dweb-proxy.ts — points at the configured dweb instance
      if (turn.integrations?.dweb) {
        mcpServers.dweb = {
          command: process.execPath,
          args: [DWEB_PROXY_PATH],
          env: {
            ...NODE_ENV_FLAG,
            DWEB_URL: turn.integrations.dweb.url,
          },
        };
        allowed.push("mcp__dweb");
      }
      // Custom MCP tools deliberately are NOT added to --allowedTools. The
      // Claude permission prompt therefore reaches MausCrew's broker and the
      // central Governance Gateway before each call.
      for (const custom of turn.integrations?.mcp ?? []) {
        mcpServers[custom.name] = {
          command: custom.command,
          args: custom.args,
          env: custom.env,
        };
      }
      // permission broker: anything acceptEdits would silently deny becomes
      // an Allow/Deny card in chat, and the agent gets ask_user. Skipped in
      // bypassPermissions (fullAuto) — nothing would ever ask.
      let broker: ReturnType<typeof createPermissionBroker> | undefined;
      if (config.permissionMode !== "bypassPermissions") {
        const socketPath = permissionSocketPath(threadId, turnId);
        broker = createPermissionBroker({
          socketPath,
          onAsk: (ask) =>
            emit({
              ...base(threadId, turnId),
              type: "request.opened",
              requestId: ask.id,
              requestType: ask.kind,
              tool: ask.tool,
              summary: askSummary(ask),
              // Marks the whole chain — event, card, transcript — as carrying
              // a credential, so nothing downstream writes the value down.
              ...(ask.input && (ask.input as { secret?: boolean }).secret ? { secret: true } : {}),
              choices: Array.isArray(ask.input?.choices) ? (ask.input.choices as string[]).slice(0, 5) : undefined,
            }),
          onResolve: (resolved) =>
            emit({
              ...base(threadId, turnId),
              type: "request.resolved",
              requestId: resolved.id,
              behavior: resolved.behavior,
              source: resolved.source,
            }),
        });
        args.push("--permission-prompt-tool", "mcp__mauscrew__approve");
        mcpServers.mauscrew = { command: process.execPath, args: [PERM_PROXY_PATH, socketPath], env: { ...NODE_ENV_FLAG } };
        allowed.push("mcp__mauscrew");
      }
      // Claude's acceptEdits/manual permission handler only covers what the
      // CLI itself decides to ask about. A PreToolUse hook is the authoritative
      // boundary for shell and file tools: it forwards every such call to the
      // same MausCrew broker, so the policy/audit card cannot be bypassed by a
      // provider-side auto-allow.
      let hookDir: string | null = null;
      if (config.permissionMode !== "bypassPermissions") {
        hookDir = mkdtempSync(join(tmpdir(), "mauscrew-hooks-"));
        const hookPath = join(hookDir, "pre-tool-use.mjs");
        const settingsPath = join(hookDir, "settings.json");
        writeFileSync(
          hookPath,
          PRE_TOOL_USE_HOOK.replace("__SOCKET__", JSON.stringify(permissionSocketPath(threadId, turnId))),
          { mode: 0o600 },
        );
        writeFileSync(
          settingsPath,
          JSON.stringify({
            hooks: {
              PreToolUse: [{ matcher: "Bash|Write|Edit|MultiEdit|NotebookEdit", hooks: [{ type: "command", command: `${JSON.stringify(process.execPath)} ${JSON.stringify(hookPath)}` }] }],
            },
          }),
          { mode: 0o600 },
        );
        args.push("--settings", settingsPath);
      }
      // The MCP config carries credentials — a Composio consumer key in a
      // header, the box token in the computer proxy's env, the comms token in
      // the agents proxy's env. On argv every one of those is world-readable
      // through `ps` for the life of the turn, to any local process. The CLI
      // accepts a FILE for this flag, so the secrets go in a 0600 file that
      // is removed when the turn settles.
      let mcpConfigPath: string | null = null;
      if (Object.keys(mcpServers).length) {
        mcpConfigPath = join(mkdtempSync(join(tmpdir(), "mauscrew-mcp-")), "mcp.json");
        writeFileSync(mcpConfigPath, JSON.stringify({ mcpServers }), { mode: 0o600 });
        args.push("--mcp-config", mcpConfigPath);
        args.push("--allowedTools", allowed.join(","));
      }

      const env = claudeEnvironment(config);

      const cwd = turn.cwd ?? homedir();
      mkdirSync(cwd, { recursive: true });
      const child = spawnCli(config.cli, args, {
        cwd,
        env,
        stdio: ["pipe", "pipe", "pipe"],
      });

      // Writing to a CLI that dies mid-turn surfaces EPIPE asynchronously, as
      // an 'error' event on the pipe — an unhandled one takes the whole server
      // down with it (same guard as acp/core.ts). The race is normal, not
      // exceptional: an interrupt kills the process while a prompt may still
      // be in flight, and the child's own exit path settles the turn either way.
      child.stdin.on("error", () => {});

      let settled = false;
      const settle = (ok: boolean, stopReason: string | null, cost: number | null = null) => {
        if (settled) return;
        settled = true;
        broker?.close();
        // the config file holds live credentials — it must not outlive the turn
        if (mcpConfigPath) {
          try {
            rmSync(dirname(mcpConfigPath), { recursive: true, force: true });
          } catch {}
        }
        if (hookDir) {
          try {
            rmSync(hookDir, { recursive: true, force: true });
          } catch {}
        }
        active.delete(threadId);
        emit({ ...base(threadId, turnId), type: "turn.completed", ok, stopReason, cost });
      };

      // token streaming: true while --include-partial-messages is delivering
      // text deltas for the current assistant message, so the whole-message
      // frame that follows doesn't re-emit the same text as one big delta
      let sawStreamDelta = false;
      // last thing the model (or the CLI, speaking for it) said this turn
      let lastAssistantText = "";

      const handleLine = (line: string) => {
        let o: any;
        try {
          o = JSON.parse(line);
        } catch {
          return;
        }
        appendNative(threadId, { dir: "in", source: "claude.sdk.message", msg: o });
        switch (o.type) {
          case "system":
            if (o.subtype === "init") {
              emit({ ...base(threadId, turnId), type: "session.started", sessionId: o.session_id, model: o.model });
            } else if (o.subtype === "thinking_tokens") {
              emit({ ...base(threadId, turnId), type: "item.updated", itemType: "reasoning", tokens: o.estimated_tokens });
            }
            break;
          case "stream_event": {
            // subagent narration is dropped — N parallel Tasks would
            // interleave their prose into one bubble (upstream-verified bug)
            if (o.parent_tool_use_id) break;
            const ev = o.event ?? {};
            if (ev.type !== "content_block_delta") break;
            const d = ev.delta ?? {};
            if (d.type === "text_delta" && typeof d.text === "string" && d.text) {
              sawStreamDelta = true;
              emit({ ...base(threadId, turnId), type: "content.delta", streamKind: "assistant_text", delta: d.text });
            } else if (d.type === "thinking_delta" && typeof d.thinking === "string" && d.thinking) {
              emit({ ...base(threadId, turnId), type: "content.delta", streamKind: "reasoning_text", delta: d.thinking });
            }
            break;
          }
          case "assistant": {
            const msg = o.message ?? {};
            const text = firstText(msg.content);
            // kept for the result branch: a provider refusal arrives as
            // ordinary assistant prose, so this is the only legible copy of it
            if (text.trim()) lastAssistantText = text;
            if (text.trim()) {
              // fallback delta for CLIs/paths that never streamed the block
              if (!sawStreamDelta) {
                emit({ ...base(threadId, turnId), type: "content.delta", streamKind: "assistant_text", delta: text });
              }
              sawStreamDelta = false;
              emit({ ...base(threadId, turnId), type: "item.completed", itemType: "assistant_text", text });
            }
            for (const b of Array.isArray(msg.content) ? msg.content : []) {
              if (b.type === "tool_use") {
                emit({ ...base(threadId, turnId), type: "item.started", itemType: "tool", itemId: b.id, title: b.name });
              }
            }
            if (msg.usage) {
              emit({
                ...base(threadId, turnId),
                type: "thread.token-usage.updated",
                input: (msg.usage.input_tokens || 0) + (msg.usage.cache_read_input_tokens || 0),
                output: msg.usage.output_tokens || 0,
              });
            }
            break;
          }
          case "user":
            for (const b of Array.isArray(o.message?.content) ? o.message.content : []) {
              if (b.type === "tool_result") {
                emit({ ...base(threadId, turnId), type: "item.completed", itemType: "tool", itemId: b.tool_use_id, ok: !b.is_error });
              }
            }
            break;
          case "result": {
            // A model the endpoint does not serve comes back as one line of
            // prose and nothing else: no code, no setup flag, nothing naming
            // the setting that caused it. Say what to change, and where.
            const providerFailure =
              o.is_error === true
                ? (typeof o.result === "string" ? o.result : lastAssistantText).trim()
                : "";
            const complaint = providerFailure ? modelRejection(providerFailure) : null;
            const capability = providerFailure ? deferralRefusal(providerFailure) : null;
            if (complaint || capability) {
              emit({
                ...base(threadId, turnId),
                type: "runtime.error",
                setup: true,
                message: capability
                  ? gatewayCapabilityAdvice(input.displayName ?? instanceId, turn.model, capability)
                  : gatewayModelAdvice(config, input.displayName ?? instanceId, turn.model, complaint!),
              });
            } else if (o.is_error === true) {
              // Claude Code reports provider throttling/billing failures as a
              // failed `result`, not stderr or a process failure. Without a
              // canonical error event the harness cannot classify the failure
              // and its configured engine fallback chain is unreachable.
              emit({
                ...base(threadId, turnId),
                type: "runtime.error",
                message: providerFailure || "Claude reported a failed turn without an error message",
              });
            }
            settle(o.is_error !== true, o.stop_reason ?? o.terminal_reason ?? null, o.total_cost_usd ?? null);
            break;
          }
        }
      };

      let buf = "";
      // decode as UTF-8 across chunk boundaries — a raw `buf += chunk` splits
      // multibyte characters that straddle two reads and corrupts the text
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        buf += chunk;
        let nl;
        while ((nl = buf.indexOf("\n")) !== -1) {
          const line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.trim()) handleLine(line);
        }
      });

      let stderr = "";
      child.stderr.on("data", (c) => {
        stderr += c;
        if (stderr.length > 8192) stderr = stderr.slice(-8192);
      });

      child.on("error", (e) => {
        emit({ ...base(threadId, turnId), type: "runtime.error", ...describeSpawnFailure(e, config.cli) });
        settle(false, "spawn_error");
      });

      child.on("close", (code) => {
        if (!settled) {
          emit({
            ...base(threadId, turnId),
            type: "runtime.error",
            message: `claude exited ${code} before result${stderr ? `: ${stderr.trim().slice(-300)}` : ""}`,
          });
          settle(false, "exit_before_result");
        }
      });

      const stop = () => killCliTree(child);
      active.set(threadId, { stop, turnId, broker });
      emit({ ...base(threadId, turnId), type: "turn.started" });

      // prompt over stdin as a stream-json message — never argv (ARG_MAX)
      const promptMsg = { type: "user", message: { role: "user", content: turn.text } };
      child.stdin.write(JSON.stringify(promptMsg) + "\n");
      child.stdin.end();
      appendNative(threadId, { dir: "out", source: "claude.sdk.message", msg: promptMsg });

      return { turnId };
    };

    const snapshot = async (): Promise<ProviderSnapshot> => {
      const env = claudeEnvironment(config);
      const version = await new Promise<string | null>((resolve) => {
        execCli(config.cli, ["--version"], { timeout: 8000, env }, (err, stdout) =>
          resolve(err ? null : stdout.trim()),
        );
      });
      if (!version) return { state: "unavailable", reason: `\`${config.cli}\` CLI not found` };
      // A configured gateway token IS this instance's credential. `claude auth
      // status` only ever reports on the claude.ai login, so asking it here
      // would report "signed out" for a perfectly working gateway instance and
      // the UI would refuse to run it.
      const authenticated = config.baseUrl && config.authToken ? true : await claudeSignedIn(config.cli, env);
      // Available, working, and unusable until it is told what to run — the
      // one state that looks fine everywhere else, so it is said out loud.
      const reason =
        config.baseUrl && !config.models?.length
          ? "No model ids yet — add them in Settings → Claude gateways."
          : undefined;
      return { state: "available", version, authenticated, ...(reason ? { reason } : {}) };
    };

    return {
      instanceId,
      driverKind: DRIVER_KIND,
      displayName: input.displayName,
      enabled: input.enabled,
      models: modelsFor(config),
      snapshot,
      adapter: {
        provider: DRIVER_KIND,
        capabilities: {
          sessionModelSwitch: "in-session",
          agentsMcp: true,
          routinesMcp: true,
          computerMcp: true,
          composioMcp: true,
          genericMcp: true,
          effortLevels: ["low", "medium", "high", "xhigh", "max"],
        },
        sendTurn,
        interruptTurn: async (threadId) => active.get(threadId)?.stop(),
        respondToRequest: async (threadId, requestId, decision) => {
          const broker = active.get(threadId)?.broker;
          if (!broker) throw new Error("no active turn with a permission broker on this thread");
          const behavior = decision.behavior === "answer" ? "answer" : decision.behavior;
          if (!broker.answer(requestId, behavior, decision.message)) {
            throw new Error("no such pending request (it may have timed out)");
          }
        },
        hasSession: (threadId) => active.has(threadId),
        stopAll: async () => {
          for (const { stop } of active.values()) stop();
        },
        onEvent: (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      },
      generateText: (prompt: string) =>
        new Promise((resolve, reject) => {
          // Haiku is the cheap model of the claude.ai catalog and of no other
          // one — naming it against a gateway is a guaranteed rejection, and it
          // is what made thread titles fail on a DeepSeek endpoint. A gateway
          // asks for its own default instead; one that has named no models yet
          // passes no --model at all and lets the endpoint choose.
          const cheapModel = config.baseUrl ? modelsFor(config).default : "claude-haiku-4-5";
          execCli(
            config.cli,
            ["-p", prompt, ...(cheapModel ? ["--model", cheapModel] : []), "--output-format", "text"],
            // same environment as every other claude invocation in this driver:
            // stripped routing vars, plus the instance's own gateway if it has
            // one — a bare process.env silently reroutes a gateway instance
            { timeout: 60_000, env: claudeEnvironment(config) },
            (err, stdout) => (err ? reject(err) : resolve(stdout.trim())),
          );
        }),
      dispose: async () => {
        for (const { stop } of active.values()) stop();
        listeners.clear();
      },
    };
  },
};
