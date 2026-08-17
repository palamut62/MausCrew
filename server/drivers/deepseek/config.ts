// DeepSeek Harness driver configuration.
//
// Decoding is total: every field falls back to a safe default rather than
// throwing, so a config written by a newer build downgrades instead of
// turning the whole instance into a shadow snapshot. The one exception is
// a path that is present but unusable — an absolute-path violation is a
// security boundary (spec §61, §81), not a version skew, so it is rejected.
//
// The API key is deliberately absent from this shape. It arrives through
// DriverCreateInput.environment keyed by apiKeyEnv, the same seam grok.ts
// uses, so credentials never round-trip through config JSON (spec §11, §96).
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

/** The composition OpenMausBot ships (spec §37). It is the bundled runtime
 * default plus the approval gate, and it is the default for every instance:
 * a bot that composes no approval answerer runs the model's shell and file
 * tools unattended, which §36 does not permit. Pointing `cordis.configPath`
 * somewhere else is allowed and takes that responsibility on. */
export const BUNDLED_CORDIS_CONFIG = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "bridges",
  "deepseek",
  "openmaus.cordis.yml",
);

/** Which wire the driver speaks to the harness.
 *
 * `python` drives the Python SDK through `bridges/deepseek/bridge.py`;
 * `native` speaks the runtime's JSON-RPC directly and needs no Python at all
 * (spec §88). They are behaviourally equivalent by construction — the same
 * driver consumes the same BridgeMessage stream either way — and the parity
 * suite is what keeps that true. `python` stays the default until the live
 * acceptance runs have been done on both. */
export type TransportMode = "python" | "native";

/** Where the harness runtime lives relative to us. */
export type RuntimeMode = "bundled-python-sdk" | "external-python" | "wsl";

/** How much of the host the agent may touch. Only "workspace" is honored
 * before the approval broker exists (spec §36) — the wider modes decode
 * fine so the config survives, but the driver refuses to run in them. */
export type SandboxMode = "workspace" | "container" | "custom";

/** Session Log sharing with DeepSeek. Upstream's own default is `DISABLED`
 * and the two opt-in modes can upload complete session content, so this
 * mirrors their vocabulary rather than inventing a boolean that would hide
 * the difference between "feedback only" and "everything" (spec §57). */
export type TelemetryMode = "off" | "feedback-only" | "full";

export interface DeepSeekHarnessConfig {
  /** Explicit interpreter. Empty means "probe" (see process-manager). */
  pythonPath: string;
  provider: string;
  /** Empty means the SDK's own default endpoint. */
  baseUrl: string;
  apiKeyEnv: string;
  defaultModel: string;
  /** null = let the runtime decide. */
  maxTokens: number | null;
  runtime: { mode: RuntimeMode; executable: string; distribution: string };
  /** Which transport to use, plus how to launch the runtime when it is
   * `native`. `launchArgs` is the full argv of the JSON-RPC runtime — either
   * the single-file executable, or `node` plus the packaged bin. Empty means
   * "not configured", and a native instance without it cannot start: there is
   * no sensible guess, and guessing would spawn some other program. */
  transport: { mode: TransportMode; launchArgs: string[] };
  cordis: { configPath: string; preset: string };
  /** Empty means the driver picks ~/.openmausbot/deepseek-harness/sessions. */
  sessionRoot: string;
  sandbox: { mode: SandboxMode };
  /** How long one turn may run before the driver stops waiting (spec §45).
   * A ceiling, not a target: an agent doing real work legitimately takes
   * minutes, but a turn that never settles leaves the thread busy forever. */
  turnTimeoutMs: number;
  /** Off unless the user opts in. Never inferred from anything else. */
  telemetry: TelemetryMode;
  /** How tool calls that touch the world are gated (spec §37–§43). */
  approval: {
    /** `ask` routes dangerous calls to the user; `never` refuses them
     * outright, which is the honest setting for an unattended bot. There is
     * deliberately no "allow everything" — that is what a wider sandbox
     * mode is for, and it needs this layer working first (§95). */
    policy: ApprovalPolicy;
    /** How long a question may stay unanswered before it becomes a denial
     * (§43). A pending card must not outlive the call it belongs to. */
    timeoutMs: number;
  };
}

/** Mirrors upstream's vocabulary (`@deepseek-ai/dsh-user-approval`) rather
 * than inventing a boolean, so a policy written here means the same thing it
 * means one layer down. */
export type ApprovalPolicy = "ask" | "never";

export const DEFAULT_PROVIDER = "deepseek-official";
export const DEFAULT_MODEL = "deepseek-v4-flash";
export const DEFAULT_API_KEY_ENV = "DEEPSEEK_API_KEY";

const TRANSPORT_MODES: readonly TransportMode[] = ["python", "native"];
const RUNTIME_MODES: readonly RuntimeMode[] = ["bundled-python-sdk", "external-python", "wsl"];
const SANDBOX_MODES: readonly SandboxMode[] = ["workspace", "container", "custom"];
const TELEMETRY_MODES: readonly TelemetryMode[] = ["off", "feedback-only", "full"];

/** 30 minutes (spec §45). Long enough for a real multi-tool turn, short
 * enough that a wedged runtime frees the thread the same day. */
export const DEFAULT_TURN_TIMEOUT_MS = 30 * 60 * 1000;
/** One second. The floor exists to stop a zero or a negative from making
 * every turn unrunnable, not to second-guess the number: someone who asks
 * for a short leash — a smoke test, a CI run, a deliberately impatient bot —
 * gets it. */
const MIN_TURN_TIMEOUT_MS = 1_000;
const MAX_TURN_TIMEOUT_MS = 6 * 60 * 60 * 1000;

const APPROVAL_POLICIES: readonly ApprovalPolicy[] = ["ask", "never"];
/** Five minutes (spec §43). Long enough to read what the agent wants to do
 * and think about it, short enough that a question asked while nobody was
 * looking does not authorize anything an hour later. */
export const DEFAULT_APPROVAL_TIMEOUT_MS = 5 * 60 * 1000;
const MIN_APPROVAL_TIMEOUT_MS = 5_000;
const MAX_APPROVAL_TIMEOUT_MS = 60 * 60 * 1000;

/** Rejected outright rather than sanitized: a NUL or newline in a value that
 * reaches argv or an env block is never a legitimate config, and quietly
 * stripping it hides the attempt (spec §81). */
const CONTROL_CHARS = /[\0\r\n]/;

export class DeepSeekConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeepSeekConfigError";
  }
}

function str(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  if (CONTROL_CHARS.test(value)) throw new DeepSeekConfigError("config values may not contain control characters");
  return value.trim();
}

/** A path we will hand to spawn() or to the runtime. Empty stays empty
 * (meaning "unset"); anything else must be absolute so a relative path can
 * never resolve against whatever cwd the server happens to hold. */
function absolutePath(value: unknown, field: string): string {
  const raw = str(value, "");
  if (!raw) return "";
  if (!isAbsolute(raw)) throw new DeepSeekConfigError(`${field} must be an absolute path, got "${raw}"`);
  return raw;
}

/** An argv array we will hand to spawn(). Every element goes through the
 * same control-character rejection as any other config string — this list
 * becomes a process, and it is the one place where a newline would be more
 * than a formatting problem (spec §25, §81). */
function argv(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const entry of value) {
    const item = str(entry, "");
    if (item) out.push(item);
  }
  return out;
}

function positiveInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const n = Math.floor(value);
  return n > 0 ? n : null;
}

/** Clamped rather than rejected: a nonsense timeout is a mistake, and the
 * clamp keeps the instance alive with a value that still bounds the turn. */
function timeoutMs(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_TURN_TIMEOUT_MS;
  return Math.min(MAX_TURN_TIMEOUT_MS, Math.max(MIN_TURN_TIMEOUT_MS, Math.floor(value)));
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** Windows has no native runtime wheel — the SDK ships linux-x64,
 * linux-arm64 and macos-arm64 only — so "wsl" is the only mode that can
 * actually start there (spec §8, deviation D2). Defaulting to it beats
 * defaulting to something guaranteed to fail. */
function defaultRuntimeMode(): RuntimeMode {
  return process.platform === "win32" ? "wsl" : "external-python";
}

export function decodeConfig(raw: unknown): DeepSeekHarnessConfig {
  const o = (raw ?? {}) as Record<string, unknown>;
  const runtime = (o.runtime ?? {}) as Record<string, unknown>;
  const transport = (o.transport ?? {}) as Record<string, unknown>;
  const cordis = (o.cordis ?? {}) as Record<string, unknown>;
  const sandbox = (o.sandbox ?? {}) as Record<string, unknown>;
  const approval = (o.approval ?? {}) as Record<string, unknown>;

  return {
    // not absolutePath: a bare "python3" resolved through PATH is the normal
    // case, and env-path's resolver is what makes that safe
    pythonPath: str(o.pythonPath, ""),
    provider: str(o.provider, DEFAULT_PROVIDER) || DEFAULT_PROVIDER,
    baseUrl: checkedBaseUrl(o.baseUrl),
    apiKeyEnv: str(o.apiKeyEnv, DEFAULT_API_KEY_ENV) || DEFAULT_API_KEY_ENV,
    defaultModel: str(o.defaultModel, DEFAULT_MODEL) || DEFAULT_MODEL,
    maxTokens: positiveInt(o.maxTokens),
    runtime: {
      mode: oneOf(runtime.mode, RUNTIME_MODES, defaultRuntimeMode()),
      executable: str(runtime.executable, ""),
      distribution: str(runtime.distribution, ""),
    },
    transport: {
      mode: oneOf(transport.mode, TRANSPORT_MODES, "python"),
      launchArgs: argv(transport.launchArgs),
    },
    cordis: {
      // Empty means "ours", not "the runtime's built-in default": the
      // built-in composes no approval answerer at all.
      configPath: absolutePath(cordis.configPath, "cordis.configPath") || BUNDLED_CORDIS_CONFIG,
      preset: str(cordis.preset, ""),
    },
    sessionRoot: absolutePath(o.sessionRoot, "sessionRoot"),
    sandbox: { mode: oneOf(sandbox.mode, SANDBOX_MODES, "workspace") },
    turnTimeoutMs: timeoutMs(o.turnTimeoutMs),
    // an unrecognized mode reads as "off", never as an opt-in
    telemetry: oneOf(o.telemetry, TELEMETRY_MODES, "off"),
    approval: {
      // an unrecognized policy reads as "ask": the stricter of the two for
      // the agent, and the one that still lets the user work
      policy: oneOf(approval.policy, APPROVAL_POLICIES, "ask"),
      timeoutMs: approvalTimeoutMs(approval.timeoutMs),
    },
  };
}

function approvalTimeoutMs(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_APPROVAL_TIMEOUT_MS;
  return Math.min(MAX_APPROVAL_TIMEOUT_MS, Math.max(MIN_APPROVAL_TIMEOUT_MS, Math.floor(value)));
}

/** Whether this instance actually has an approval broker in the loop.
 *
 * True only for the composition OpenMausBot ships, because that is the only
 * one we can know composes the gate. A user's own composition may well have
 * something better, but "may well" is not a basis for widening a sandbox
 * (spec §54, §95) — the driver stays workspace-only in that case. */
export function approvalsActive(config: DeepSeekHarnessConfig): boolean {
  return config.cordis.configPath === BUNDLED_CORDIS_CONFIG;
}

/** A base URL is where the user's API key gets sent, so a scheme we cannot
 * vouch for is rejected at decode rather than warned about later: `file:`
 * or a typo would otherwise reach the runtime with the credential attached
 * (spec §31, §97). The http-vs-https judgement stays a warning — a local
 * proxy on plain HTTP is a legitimate setup. */
function checkedBaseUrl(value: unknown): string {
  const raw = str(value, "");
  if (!raw) return "";
  const verdict = describeBaseUrl(raw);
  if (!verdict.ok) throw new DeepSeekConfigError(verdict.reason ?? `baseUrl "${raw}" is not usable`);
  return raw;
}

export function defaultConfig(): DeepSeekHarnessConfig {
  return decodeConfig({});
}

/** A base URL the user typed. Returned reasons are shown verbatim, so they
 * say what will happen rather than that something is "invalid" (spec §97). */
export function describeBaseUrl(baseUrl: string): { ok: boolean; warning?: string; reason?: string } {
  if (!baseUrl) return { ok: true };
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return { ok: false, reason: `"${baseUrl}" is not a valid URL` };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: `base URL must be http or https, got "${url.protocol}"` };
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
  if (url.protocol === "http:" && !local) {
    // the key travels to whatever host this names, in the clear
    return {
      ok: true,
      warning: `${url.host} is plain HTTP — your DeepSeek API key will be sent to it unencrypted.`,
    };
  }
  if (!local) {
    return { ok: true, warning: `Your DeepSeek API key will be sent to ${url.host}.` };
  }
  return { ok: true };
}
