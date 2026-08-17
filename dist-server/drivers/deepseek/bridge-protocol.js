// Node ↔ Python bridge wire protocol (spec §14, §15).
//
// Newline-delimited JSON, one object per line, versioned by a handshake the
// Python side sends first. Both directions are typed here so the two ends
// stay readable against each other; bridge.py carries the same constants.
//
// Everything crossing this boundary is untrusted input as far as the driver
// is concerned — the bridge is a separate process that may be a different
// version, so parsing narrows rather than casts.
/** Bumped only for breaking changes. The Python side refuses to run when
 * its own version is outside the range this build accepts. */
export const PROTOCOL_VERSION = 1;
export const MIN_SUPPORTED_PROTOCOL = 1;
export const MAX_SUPPORTED_PROTOCOL = 1;
const KNOWN_TYPES = new Set([
    "bridge.ready",
    "turn.started",
    "session.started",
    "assistant.delta",
    "reasoning.delta",
    "assistant.message",
    "tool.started",
    "tool.completed",
    "token.usage",
    "subagent.started",
    "subagent.finished",
    "approval.requested",
    "turn.completed",
    "error",
]);
export function serializeCommand(command) {
    return JSON.stringify(command) + "\n";
}
/** Narrow one decoded JSON value into a BridgeMessage.
 *
 * Returns null for anything unrecognized rather than throwing: a newer
 * bridge emitting a message type this build has never heard of must be
 * ignored, not treated as a crash. Malformed JSON is the caller's problem
 * (it never reaches here). */
export function parseMessage(value) {
    if (typeof value !== "object" || value === null)
        return null;
    const o = value;
    const type = o.type;
    if (typeof type !== "string" || !KNOWN_TYPES.has(type))
        return null;
    const requestId = typeof o.requestId === "string" ? o.requestId : null;
    const str = (v, fallback = "") => (typeof v === "string" ? v : fallback);
    const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
    switch (type) {
        case "bridge.ready": {
            const caps = (o.capabilities ?? {});
            return {
                type,
                protocolVersion: typeof o.protocolVersion === "number" ? o.protocolVersion : 0,
                sdkVersion: typeof o.sdkVersion === "string" ? o.sdkVersion : null,
                capabilities: {
                    streaming: caps.streaming === true,
                    sessions: caps.sessions === true,
                    cancel: caps.cancel === true,
                    approvals: caps.approvals === true,
                },
            };
        }
        case "error":
            return { type, requestId, code: str(o.code, "runtime_error"), message: str(o.message) };
        default:
            break;
    }
    // every remaining type is turn-scoped and useless without its correlation id
    if (!requestId)
        return null;
    switch (type) {
        case "turn.started":
            return { type, requestId, threadId: str(o.threadId) || undefined, sessionId: str(o.sessionId) || undefined };
        case "session.started":
            return {
                type,
                requestId,
                sessionId: str(o.sessionId),
                model: typeof o.model === "string" ? o.model : null,
            };
        case "assistant.delta":
        case "reasoning.delta": {
            const delta = str(o.delta);
            return delta ? { type, requestId, delta } : null;
        }
        case "assistant.message": {
            const text = str(o.text);
            return text ? { type, requestId, text } : null;
        }
        case "tool.started":
            return {
                type,
                requestId,
                tool: str(o.tool, "tool"),
                itemId: str(o.itemId) || `${requestId}-tool`,
                title: str(o.title) || undefined,
            };
        case "tool.completed":
            return { type, requestId, itemId: str(o.itemId) || `${requestId}-tool`, ok: o.ok !== false };
        case "token.usage":
            return { type, requestId, input: num(o.input), output: num(o.output) };
        case "subagent.started": {
            const childSessionId = str(o.childSessionId);
            return childSessionId
                ? { type, requestId, childSessionId, parentSessionId: str(o.parentSessionId) || undefined }
                : null;
        }
        case "subagent.finished": {
            const childSessionId = str(o.childSessionId);
            if (!childSessionId)
                return null;
            return {
                type,
                requestId,
                childSessionId,
                parentSessionId: str(o.parentSessionId) || undefined,
                provider: str(o.provider, "subagent"),
                agentId: str(o.agentId) || undefined,
                ok: o.ok !== false,
                stopReason: str(o.stopReason, "completed"),
                lastAssistantMessage: str(o.lastAssistantMessage).slice(0, 4_000) || undefined,
            };
        }
        case "approval.requested": {
            const approvalId = str(o.approvalId);
            if (!approvalId)
                return null;
            return { type, requestId, approvalId, tool: str(o.tool, "tool"), summary: str(o.summary) };
        }
        case "turn.completed":
            return {
                type,
                requestId,
                finishReason: typeof o.finishReason === "string" ? o.finishReason : null,
                finalResponse: str(o.finalResponse),
                sessionId: str(o.sessionId) || undefined,
            };
        default:
            return null;
    }
}
/** Version gate. A bridge outside the supported range makes the provider
 * unavailable rather than being driven on a guess (spec §15). */
export function checkHandshake(ready) {
    const v = ready.protocolVersion;
    if (!Number.isInteger(v) || v < MIN_SUPPORTED_PROTOCOL) {
        return {
            ok: false,
            reason: `bridge protocol version ${v} is older than the minimum this build supports (${MIN_SUPPORTED_PROTOCOL})`,
        };
    }
    if (v > MAX_SUPPORTED_PROTOCOL) {
        return {
            ok: false,
            reason: `bridge protocol version ${v} is newer than this build supports (${MAX_SUPPORTED_PROTOCOL}) — update MausCrew`,
        };
    }
    return { ok: true };
}
/** Split a stdout chunk stream into complete lines.
 *
 * Kept as an explicit class because the naive `buf += chunk` split corrupts
 * multibyte characters straddling a chunk boundary — the same trap codex.ts
 * documents. Callers must setEncoding("utf8") on the stream; this only
 * handles the line framing. */
export class LineSplitter {
    buf = "";
    maxLineLength;
    /** Guard against a bridge that writes an unbounded line and eats memory. */
    constructor(maxLineLength = 8 * 1024 * 1024) {
        this.maxLineLength = maxLineLength;
    }
    push(chunk) {
        this.buf += chunk;
        const lines = [];
        let nl;
        while ((nl = this.buf.indexOf("\n")) !== -1) {
            const line = this.buf.slice(0, nl);
            this.buf = this.buf.slice(nl + 1);
            const trimmed = line.trim();
            if (trimmed)
                lines.push(trimmed);
        }
        if (this.buf.length > this.maxLineLength)
            this.buf = "";
        return lines;
    }
    reset() {
        this.buf = "";
    }
}
