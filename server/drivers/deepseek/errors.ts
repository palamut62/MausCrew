// Error classification for the DeepSeek Harness driver.
//
// Two audiences, deliberately separated. classifyError maps a failure onto
// the canonical ProviderErrorCode the harness already understands, and
// describeError produces the sentence a user reads (spec §98, §99).
// "spawn ENOENT" tells someone nothing they can act on; "the SDK isn't
// installed, here is where to set the Python path" does.
//
// The `setup` flag is the same signal codex.ts uses: true means retrying
// is guaranteed to fail the same way and the UI should offer setup instead.
import type { ProviderErrorCode } from "../../contracts.ts";

export type DeepSeekFailureKind =
  | "python_missing"
  | "sdk_missing"
  | "runtime_unsupported_platform"
  | "credentials_missing"
  | "unauthorized"
  | "quota"
  | "upstream"
  | "protocol_mismatch"
  | "bridge_crashed"
  | "timeout"
  | "sandbox_refused"
  | "unknown";

export class DeepSeekBridgeError extends Error {
  readonly kind: DeepSeekFailureKind;

  constructor(kind: DeepSeekFailureKind, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "DeepSeekBridgeError";
    this.kind = kind;
  }
}

const CODE_BY_KIND: Record<DeepSeekFailureKind, ProviderErrorCode> = {
  python_missing: "missing_cli",
  sdk_missing: "missing_cli",
  runtime_unsupported_platform: "missing_cli",
  credentials_missing: "invalid_credentials",
  unauthorized: "invalid_credentials",
  quota: "quota_or_region_restriction",
  upstream: "upstream_outage",
  // a version-skewed bridge is something the user fixes by installing the
  // matching SDK, which is what missing_cli routes to
  protocol_mismatch: "missing_cli",
  bridge_crashed: "upstream_outage",
  timeout: "upstream_outage",
  sandbox_refused: "invalid_credentials",
  unknown: "upstream_outage",
};

export function providerErrorCode(kind: DeepSeekFailureKind): ProviderErrorCode {
  return CODE_BY_KIND[kind];
}

/** Best-effort classification of something the bridge or the runtime said.
 * Deliberately conservative: an unrecognized failure stays "unknown" rather
 * than being forced into a bucket that would show the user a confident and
 * wrong remedy. */
export function classifyError(input: unknown): DeepSeekFailureKind {
  if (input instanceof DeepSeekBridgeError) return input.kind;
  const text = (input instanceof Error ? input.message : String(input ?? "")).toLowerCase();
  if (!text) return "unknown";

  if (text.includes("enoent") || text.includes("no such file") || text.includes("not recognized")) {
    return "python_missing";
  }
  if (text.includes("modulenotfounderror") || text.includes("no module named 'deepseek_harness'")) {
    return "sdk_missing";
  }
  if (text.includes("no matching distribution") || text.includes("unsupported platform")) {
    return "runtime_unsupported_platform";
  }
  if (text.includes("401") || text.includes("unauthorized") || text.includes("invalid api key")) {
    return "unauthorized";
  }
  if (text.includes("quota") || text.includes("rate limit") || text.includes("429")) return "quota";
  if (text.includes("econnrefused") || text.includes("etimedout") || text.includes("502") || text.includes("503")) {
    return "upstream";
  }
  if (text.includes("protocol version")) return "protocol_mismatch";
  if (text.includes("timed out") || text.includes("timeout")) return "timeout";
  return "unknown";
}

export interface ErrorDescription {
  message: string;
  /** True when the fix is installation or configuration, not a retry. */
  setup: boolean;
}

const SDK_DOCS = "https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/python-sdk.md";

export function describeError(kind: DeepSeekFailureKind, detail?: string): ErrorDescription {
  const tail = detail ? ` (${detail.trim().slice(0, 200)})` : "";
  switch (kind) {
    case "python_missing":
      return {
        setup: true,
        message: `Python was not found. Set the Python path in Settings → Engines → DeepSeek Harness, or install Python 3.10+.${tail}`,
      };
    case "sdk_missing":
      return {
        setup: true,
        message: `The DeepSeek Harness Python SDK is not installed. Run \`python3 -m pip install --pre deepseek-harness-sdk\` for the interpreter configured in Settings → Engines → DeepSeek Harness. Setup guide: ${SDK_DOCS}${tail}`,
      };
    case "runtime_unsupported_platform":
      return {
        setup: true,
        message: `The DeepSeek Harness runtime ships only for Linux x64/ARM64 and macOS ARM64. On Windows, install it inside WSL2 and set the runtime mode to WSL.${tail}`,
      };
    case "credentials_missing":
      return {
        setup: true,
        message: `No DeepSeek API key. Set the key for this bot in Settings → Engines → DeepSeek Harness.${tail}`,
      };
    case "unauthorized":
      return { setup: true, message: `DeepSeek rejected the API key.${tail}` };
    case "quota":
      return { setup: false, message: `DeepSeek declined the request for quota or region reasons.${tail}` };
    case "upstream":
      return { setup: false, message: `Could not reach the DeepSeek endpoint.${tail}` };
    case "protocol_mismatch":
      return {
        setup: true,
        message: `The DeepSeek bridge speaks a protocol version this build does not support. Install the pinned deepseek-harness-sdk version.${tail}`,
      };
    case "bridge_crashed":
      return { setup: false, message: `The DeepSeek Harness bridge stopped unexpectedly.${tail}` };
    case "timeout":
      return { setup: false, message: `The DeepSeek Harness runtime did not respond in time.${tail}` };
    case "sandbox_refused":
      return {
        setup: true,
        // fail closed and say why — this is the §36 boundary, not a glitch
        message: `DeepSeek Harness will not run without approvals outside a restricted workspace. Choose a workspace folder for this bot.${tail}`,
      };
    case "unknown":
      return { setup: false, message: `DeepSeek Harness failed.${tail}` };
  }
}

/** One call for the common path: turn anything into the runtime.error
 * payload shape ({ message, setup }) that RuntimeEvent carries. */
export function toRuntimeError(input: unknown, detail?: string): ErrorDescription {
  const kind = classifyError(input);
  const extra = detail ?? (input instanceof Error ? input.message : undefined);
  return describeError(kind, kind === "unknown" ? extra : detail);
}
