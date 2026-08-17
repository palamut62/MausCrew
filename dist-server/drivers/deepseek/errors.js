export class DeepSeekBridgeError extends Error {
    kind;
    constructor(kind, message, options) {
        super(message, options);
        this.name = "DeepSeekBridgeError";
        this.kind = kind;
    }
}
const CODE_BY_KIND = {
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
export function providerErrorCode(kind) {
    return CODE_BY_KIND[kind];
}
/** Best-effort classification of something the bridge or the runtime said.
 * Deliberately conservative: an unrecognized failure stays "unknown" rather
 * than being forced into a bucket that would show the user a confident and
 * wrong remedy. */
export function classifyError(input) {
    if (input instanceof DeepSeekBridgeError)
        return input.kind;
    const text = (input instanceof Error ? input.message : String(input ?? "")).toLowerCase();
    if (!text)
        return "unknown";
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
    if (text.includes("quota") || text.includes("rate limit") || text.includes("429"))
        return "quota";
    if (text.includes("econnrefused") || text.includes("etimedout") || text.includes("502") || text.includes("503")) {
        return "upstream";
    }
    if (text.includes("protocol version"))
        return "protocol_mismatch";
    if (text.includes("timed out") || text.includes("timeout"))
        return "timeout";
    return "unknown";
}
const SDK_DOCS = "https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/python-sdk.md";
export function describeError(kind, detail) {
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
export function toRuntimeError(input, detail) {
    const kind = classifyError(input);
    const extra = detail ?? (input instanceof Error ? input.message : undefined);
    return describeError(kind, kind === "unknown" ? extra : detail);
}
