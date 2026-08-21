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
  /** Superseded by `claudeGateways`; still read so a config written by an
   * older build keeps working, and migrated on first save. */
  claudeGateway?: { baseUrl?: string; authToken?: string; models?: string[] };
  /** Voice (ElevenLabs). `key` is the credential and is never echoed back;
   * `voice` is the chosen voice id, which is a setting, not a secret. */
  tts?: { key?: string; voice?: string };
  /** The person using the app (collected in onboarding, shown in the
   * sidebar). Not a secret — echoed back by GET /api/config. */
  profile?: { name?: string; email?: string };
  instances?: InstanceConfigMap;
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
      ...(cfg.xai?.key ? { XAI_API_KEY: cfg.xai.key } : {}),
      ...(cfg.box?.token ? { BOX_TOKEN: cfg.box.token } : {}),
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
