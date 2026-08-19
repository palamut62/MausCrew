// Config + data dirs. One file, ~/.mauscrew/config.json, env fallbacks:
//   { "xai": {"key":"xai-…"}, "composio": {"apiKey":"ak_…"}, "box": {"token":"…"},
//     "instances": { "<instanceId>": {"driver":"grok", …} } }
import { readFileSync, mkdirSync, existsSync, renameSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { writeFileAtomic } from "./atomic.ts";
import type { InstanceConfigMap } from "./contracts.ts";

export interface AppConfig {
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
  /** Anthropic-compatible gateway for the `claude` CLI: DeepSeek's /anthropic
   * endpoint, a local CLIProxyAPI, OpenRouter. `authToken` is the credential
   * and is never echoed back; `baseUrl` and `models` are settings, echoed so
   * the UI can warn about where the token is sent. Empty `baseUrl` means the
   * CLI's own claude.ai login, which stays the default. */
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
  ] as const) {
    if (patch[key] && typeof patch[key] === "object") {
      disk[key] = { ...(disk[key] as object), ...patch[key] };
    }
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
    // Same rule for the Claude CLI's gateway: endpoint and model list are
    // settings, the token is a credential the driver reads from its config
    // and puts in the child's environment. Applied only when a base URL is
    // actually set, so a stray token can never be sent to Anthropic.
    if (entry.driver === "claudeAgent" && cfg.claudeGateway?.baseUrl) {
      const { baseUrl, authToken, models } = cfg.claudeGateway;
      entry.config = {
        baseUrl,
        ...(authToken ? { authToken } : {}),
        ...(models?.length ? { models } : {}),
        ...(typeof entry.config === "object" && entry.config !== null ? entry.config : {}),
      };
    }

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
  return map;
}
