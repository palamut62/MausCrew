// Config + data dirs. One file, ~/.mauscrew/config.json, env fallbacks:
//   { "xai": {"key":"xai-…"}, "composio": {"apiKey":"ak_…"}, "box": {"token":"…"},
//     "instances": { "<instanceId>": {"driver":"grok", …} } }
import { readFileSync, mkdirSync, existsSync, renameSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { writeFileAtomic } from "./atomic.ts";
import type { InstanceConfigMap } from "./contracts.ts";

export interface ClaudeGateway {
  /** Stable routing key — `claude-<id>` is the instance a bot points at. */
  id: string;
  /** Shown on the picker rail. Falls back to the endpoint's host. */
  label?: string;
  baseUrl: string;
  authToken?: string;
  /** Model ids this endpoint serves. Empty means the Claude list, which a
   * third-party gateway will reject — the UI warns about exactly that. */
  models?: string[];
}

/** The instance id a gateway occupies. Prefixed so it cannot collide with a
 * built-in or with a hand-written `instances` entry. */
export function gatewayInstanceId(id: string): string {
  return `claude-${id}`;
}

/** One list from both the current and the legacy shape, so a config written
 * before gateways were plural still produces its instance. */
export function claudeGateways(cfg: AppConfig): ClaudeGateway[] {
  const list = (cfg.claudeGateways ?? []).filter((gw) => gw?.id && gw.baseUrl);
  if (!list.some((gw) => gw.id === "default") && cfg.claudeGateway?.baseUrl) {
    list.unshift({ id: "default", ...cfg.claudeGateway, baseUrl: cfg.claudeGateway.baseUrl });
  }
  return list;
}

export interface AppConfig {
  /** Default host workspace shared by bots that do not choose a private one. */
  sharedWorkspacePath?: string;
  /** Optional HTTPS address exposed by a local trusted reverse proxy such as
   * Tailscale Serve. The harness itself remains bound to loopback. */
  remoteAccess?: { enabled?: boolean; publicUrl?: string };
  /** Remote agents that speak the open AG-UI HTTP/SSE protocol. Auth values
   * are held by Electron safeStorage; this list contains metadata only. */
  aguiAgents?: Array<{
    id: string;
    label: string;
    endpoint: string;
    authHeader?: string;
    authConfigured?: boolean;
  }>;
  /** Custom stdio MCP servers. Values for envNames live only in Electron's
   * encrypted credential store and reach the harness as process env. */
  mcpServers?: Array<{
    id: string;
    name: string;
    command: string;
    args: string[];
    envNames: string[];
    allowedBots: string[];
    enabled?: boolean;
  }>;
  xai?: { key?: string; url?: string };
  /** Project key used for Sessions, catalog and agent tools. userId/sessionId
   * are non-secret local identifiers used to reuse one Composio Session. */
  composio?: {
    apiKey?: string;
    userId?: string;
    sessionId?: string;
  };
  box?: { token?: string };
  /** OpenCode Go key; persisted write-only and passed only to its child. */
  opencodeGo?: { apiKey?: string };
  /** DeepSeek Harness. `apiKey` is write-only and reaches the bridge process
   * as an environment variable, never the renderer (spec §96). `baseUrl` and
   * `telemetry` are settings rather than secrets: the endpoint is echoed back
   * so the UI can warn that a custom host receives this key (§97), and
   * telemetry defaults to off unless the user opts in (§57). */
  deepseekHarness?: {
    apiKey?: string;
    baseUrl?: string;
    telemetry?: "off" | "feedback-only" | "full";
    sandboxMode?: "read-only" | "workspace-write" | "danger-full-access";
    runtimeStrategy?: "system" | "managed" | "bundled";
  };
  /** Anthropic-compatible gateways for the `claude` CLI: DeepSeek's
   * /anthropic endpoint, OpenRouter, Kimi, a local CLIProxyAPI. Several are
   * allowed because the CLI speaks to one endpoint per process, so each
   * gateway is its own engine in the picker rather than a mode of one.
   *
   * Each becomes an extra `claudeAgent` instance, added to the fleet rather
   * than replacing the plain `claude` entry — signing in to claude.ai and
   * running DeepSeek through the same CLI are not mutually exclusive, and
   * the earlier single-gateway shape made them so.
   *
   * `authToken` is the credential and is never echoed back. `id` is a stable
   * routing key: bots store `instanceId`, so it must survive a rename. */
  claudeGateways?: ClaudeGateway[];
  /**
   * Engines to fall through when one runs out, in the user's own order.
   *
   * Every engine here is a subscription or a balance and they all run out. A
   * turn that dies on "usage limit reached" can usually finish on the next one
   * seconds later, so this is a preference list rather than a load balancer:
   * first entry is tried first, and an engine is only skipped when it is
   * genuinely unavailable.
   */
  fallbackChain?: string[];
  /** Browser control on this machine via Playwright. Off unless enabled: it
   * needs a separate install, and most bots never open a browser. */
  pcBrowser?: { enabled?: boolean; headless?: boolean };
  /** Superseded by `claudeGateways`; still read so a config written by an
   * older build keeps working, and migrated on first save. */
  claudeGateway?: { baseUrl?: string; authToken?: string; models?: string[] };
  /** Voice (ElevenLabs). `key` is the credential and is never echoed back;
   * `voice` is the chosen voice id, which is a setting, not a secret. */
  tts?: { key?: string; voice?: string };
  /** The person using the app (collected in onboarding, shown in the
   * sidebar). Not a secret — echoed back by GET /api/config. */
  profile?: { name?: string; email?: string };
  /** Product usage analytics (PostHog). A setting, not a secret. It lives on
   * the harness rather than in renderer localStorage so that turning it off
   * survives a cache clear, and so a headless host can refuse it before any
   * renderer exists. */
  analytics?: { enabled?: boolean };
  instances?: InstanceConfigMap;
}

/** Whether the renderer may load PostHog at all.
 *
 * Two ways to say no, and they are not equal. MAUSCREW_DISABLE_ANALYTICS is a
 * hard refusal that config.json cannot re-enable — it is how a packaged build,
 * a CI rig or an always-on host opts out for everyone. The stored flag is the
 * user's own switch. Absent means enabled: this is an opt-OUT, and changing
 * that default is a product decision, not a code one. */
export function analyticsEnabled(cfg: AppConfig): boolean {
  return !analyticsLocked() && cfg.analytics?.enabled !== false;
}

/** The env refusal is in force, so the UI toggle has nothing to offer. */
export function analyticsLocked(): boolean {
  const off = process.env.MAUSCREW_DISABLE_ANALYTICS;
  return off === "1" || off?.toLowerCase() === "true";
}

// MAUSCREW_DATA_DIR isolates test/soak rigs from the user's real fleet.
// OMB_DATA_DIR remains a compatibility alias for existing scripts.
export const DATA_DIR =
  process.env.MAUSCREW_DATA_DIR ?? process.env.OMB_DATA_DIR ?? join(homedir(), ".mauscrew");
const LEGACY_DATA_DIRS = [join(homedir(), ".openmausbot"), join(homedir(), ".opengrokbot")];
export const EVENTS_DIR = join(DATA_DIR, "events");
export const NATIVE_DIR = join(DATA_DIR, "native");

export function ensureDirs() {
  // one-time migration from the pre-rename data dir — bots, transcripts,
  // config and keys all carry over
  if (!existsSync(DATA_DIR)) {
    for (const legacyDataDir of LEGACY_DATA_DIRS) {
      if (!existsSync(legacyDataDir)) continue;
      try {
        renameSync(legacyDataDir, DATA_DIR);
        break;
      } catch {
        /* cross-device or busy — try the next legacy path */
      }
    }
  }
  for (const dir of [DATA_DIR, EVENTS_DIR, NATIVE_DIR]) mkdirSync(dir, { recursive: true });
}

export function loadConfig(): AppConfig {
  let cfg: AppConfig = {};
  try {
    cfg = JSON.parse(readFileSync(join(DATA_DIR, "config.json"), "utf8"));
  } catch {
    /* first run — env fallbacks below */
  }
  cfg.xai = { key: process.env.XAI_API_KEY, ...cfg.xai };
  cfg.composio = {
    ...cfg.composio,
    ...(process.env.COMPOSIO_API_KEY !== undefined ? { apiKey: process.env.COMPOSIO_API_KEY } : {}),
  };
  cfg.box = { token: process.env.BOX_TOKEN, ...cfg.box };
  cfg.opencodeGo = { apiKey: process.env.OPENCODE_API_KEY, ...cfg.opencodeGo };
  cfg.deepseekHarness = { apiKey: process.env.DEEPSEEK_API_KEY, ...cfg.deepseekHarness };
  cfg.tts = { key: process.env.MAUSCREW_TTS_KEY ?? process.env.OMB_TTS_KEY, ...cfg.tts };
  return cfg;
}

/** Merge a partial config into ~/.mauscrew/config.json (secrets never
 * echoed back — callers report configured-or-not booleans only). */
export function saveConfig(patch: Partial<AppConfig>): void {
  const p = join(DATA_DIR, "config.json");
  let disk: Record<string, unknown> = {};
  try {
    disk = JSON.parse(readFileSync(p, "utf8"));
  } catch {
    /* first write */
  }
  for (const key of [
    "xai",
    "composio",
    "box",
    "opencodeGo",
    "deepseekHarness",
    "claudeGateway",
    "tts",
    "profile",
    "remoteAccess",
    "analytics",
  ] as const) {
    if (patch[key] && typeof patch[key] === "object") {
      disk[key] = { ...(disk[key] as object), ...patch[key] };
    }
  }
  // A list is replaced, not merged: removing a gateway is expressed by it
  // being absent from the array, which a per-key merge would silently undo.
  // The legacy single-gateway key is dropped once the list has taken over,
  // so the two shapes cannot disagree about what is configured.
  if (patch.claudeGateways) {
    disk.claudeGateways = patch.claudeGateways;
    delete disk.claudeGateway;
  }
  if (patch.aguiAgents) disk.aguiAgents = patch.aguiAgents;
  if (patch.mcpServers) disk.mcpServers = patch.mcpServers;
  if (patch.sharedWorkspacePath !== undefined) {
    const sharedWorkspacePath = patch.sharedWorkspacePath.trim();
    if (sharedWorkspacePath) disk.sharedWorkspacePath = sharedWorkspacePath;
    else delete disk.sharedWorkspacePath;
  }
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileAtomic(p, JSON.stringify(disk, null, 2), { mode: 0o600 });
}

// Default fleet: one instance per built-in driver (upstream
// defaultInstanceIdForDriver — instanceId defaults to the driver kind).
// Config-file keys are injected as per-instance environment so drivers
// see them without needing real process env vars.
export function instanceConfigs(cfg: AppConfig): InstanceConfigMap {
  // The default `grok` instance rides the `grokAgent` driver, not the API-key
  // one: like claude and codex it needs no credential from us, just the CLI
  // installed and logged in (it shows up unavailable otherwise). The API-key
  // `grok` driver stays registered but out of the default fleet — that key is
  // a credential Milind doesn't want to manage; an `instances` entry brings
  // it back anytime.
  //
  // Google rides `antigravityAgent` (the `agy` CLI), not `geminiAgent`:
  // Google retired Gemini CLI for the free/Pro/Ultra tiers on 2026-06-18
  // (developers.googleblog.com, "transitioning Gemini CLI to Antigravity
  // CLI"), so a default `gemini` instance could only ever show unavailable.
  // The driver stays registered for enterprise licences, which keep Gemini
  // CLI — `{"instances": {"gemini": {"driver": "geminiAgent"}}}` restores it.
  //
  // DeepSeek is not in that retired category: its runtime is installable, so
  // the default `deepseek` instance is how the engine reaches the model
  // picker at all. It shows unavailable until the SDK is present, exactly
  // like droid, claude and opencodeGo — that is the intended shape.
  const map: InstanceConfigMap =
    cfg.instances && Object.keys(cfg.instances).length
      ? cfg.instances
      : {
          grok: { driver: "grokAgent" },
          kimi: { driver: "kimiAgent" },
          droid: { driver: "droidAgent" },
          claude: { driver: "claudeAgent" },
          codex: { driver: "codex" },
          antigravity: { driver: "antigravityAgent" },
          opencodeGo: { driver: "opencodeGo" },
          computer: { driver: "boxAgent" },
          deepseek: { driver: "deepseek-harness" },
        };
  for (const entry of Object.values(map)) {
    entry.environment = {
      // Scoped to the drivers that consume them — an xAI key belongs to the
      // API-key Grok driver and a Box token to the box agent, not to every
      // child process in the fleet (same rule as the DeepSeek key below,
      // spec §12). Anything else needs a hand-written `environment` escape.
      ...(entry.driver === "grok" && cfg.xai?.key ? { XAI_API_KEY: cfg.xai.key } : {}),
      ...(entry.driver === "boxAgent" && cfg.box?.token ? { BOX_TOKEN: cfg.box.token } : {}),
      ...(entry.driver === "opencodeGo" && cfg.opencodeGo?.apiKey
        ? { OPENCODE_API_KEY: cfg.opencodeGo.apiKey }
        : {}),
      // Scoped to the driver that needs it: a DeepSeek key has no business
      // in a Codex or Claude child process (spec §12).
      ...(entry.driver === "deepseek-harness" && cfg.deepseekHarness?.apiKey
        ? { DEEPSEEK_API_KEY: cfg.deepseekHarness.apiKey }
        : {}),
      ...entry.environment,
    };

    // Endpoint and telemetry are settings, not credentials, so they travel in
    // the driver config rather than the environment. The instance's own
    // `config` still wins: someone who hand-edited config.json for one bot
    // meant it, and the Settings form is the default for bots that have not.
    if (entry.driver === "deepseek-harness" && cfg.deepseekHarness) {
      const { baseUrl, telemetry, sandboxMode, runtimeStrategy } = cfg.deepseekHarness;
      entry.config = {
        ...(baseUrl ? { baseUrl } : {}),
        ...(telemetry ? { telemetry } : {}),
        ...(sandboxMode ? { sandbox: { mode: sandboxMode } } : {}),
        ...(runtimeStrategy ? { runtime: { strategy: runtimeStrategy } } : {}),
        ...(typeof entry.config === "object" && entry.config !== null ? entry.config : {}),
      };
    }
  }

  // Gateways are appended, never merged into the built-in `claude` entry:
  // one `claude` CLI process talks to one endpoint, so two endpoints are two
  // engines. Appending also puts them at the end of the picker rail, after
  // the engines that ship with the app, and leaves the plain claude.ai
  // sign-in working beside them.
  //
  // A hand-written `instances` entry with the same id wins — that map is the
  // escape hatch, and Settings should not overwrite it.
  for (const gateway of claudeGateways(cfg)) {
    const instanceId = gatewayInstanceId(gateway.id);
    if (map[instanceId]) continue;
    map[instanceId] = {
      driver: "claudeAgent",
      displayName: gateway.label?.trim() || gatewayHost(gateway.baseUrl),
      config: {
        baseUrl: gateway.baseUrl,
        ...(gateway.authToken ? { authToken: gateway.authToken } : {}),
        ...(gateway.models?.length ? { models: gateway.models } : {}),
      },
    };
  }
  for (const agent of cfg.aguiAgents ?? []) {
    const instanceId = `agui-${agent.id}`;
    if (map[instanceId]) continue;
    const authEnv = aguiAuthEnv(agent.id);
    map[instanceId] = {
      driver: "agui",
      displayName: agent.label.trim() || gatewayHost(agent.endpoint),
      environment: process.env[authEnv] ? { [authEnv]: process.env[authEnv]! } : {},
      config: {
        endpoint: agent.endpoint,
        authHeader: agent.authHeader || "Authorization",
        authEnv,
        allowPrivateHosts: true,
      },
    };
  }
  return map;
}

export function aguiAuthEnv(id: string): string {
  return `MAUSCREW_AGUI_AUTH_${id.replace(/[^A-Za-z0-9]/g, "_").toUpperCase()}`;
}

/** A readable fallback name: the endpoint's host, which is what distinguishes
 * two gateways when the user did not bother to name them. */
function gatewayHost(baseUrl: string): string {
  try {
    return new URL(baseUrl).host;
  } catch {
    return baseUrl;
  }
}
