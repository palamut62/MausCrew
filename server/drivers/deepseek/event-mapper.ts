// BridgeMessage → canonical RuntimeEvent (spec §20, §21).
//
// Pure translation, no business logic and no state beyond what one message
// carries. The driver owns turn lifecycle, correlation and settlement; this
// file only knows the shape of the two vocabularies. Keeping it that way is
// what makes the whole mapping table testable without a process.
//
// A message that has no canonical equivalent maps to nothing rather than to
// an approximation — inventing an event the UI then renders is worse than
// dropping one the UI never needed.
import type { DriverKind, RuntimeEvent, ThreadId, TurnId } from "../../contracts.ts";
import { newEventId } from "../../contracts.ts";
import type { BridgeMessage } from "./bridge-protocol.ts";
import { toRuntimeError } from "./errors.ts";

export interface EventContext {
  provider: DriverKind;
  providerInstanceId: string;
  threadId: ThreadId;
  turnId: TurnId;
  /** Approval correlation: the bridge's approvalId becomes the harness
   * requestId the UI answers with, so the driver hands its own id in. */
  requestIdFor?: (approvalId: string) => string;
  /** Set when the message arrived on stdout, for the native protocol log. */
  raw?: unknown;
}

function base(ctx: EventContext) {
  return {
    eventId: newEventId(),
    provider: ctx.provider,
    providerInstanceId: ctx.providerInstanceId,
    threadId: ctx.threadId,
    turnId: ctx.turnId,
    createdAt: new Date().toISOString(),
    ...(ctx.raw === undefined ? {} : { raw: { source: "deepseek.bridge", payload: ctx.raw } }),
  };
}

/** Map one bridge message. Returns an array because a single bridge message
 * can be two canonical events — an assistant message that never streamed
 * needs both the delta the UI renders and the completed item it stores. */
export function mapMessage(message: BridgeMessage, ctx: EventContext): RuntimeEvent[] {
  switch (message.type) {
    // handshake is driver lifecycle, not conversation
    case "bridge.ready":
      return [];

    case "turn.started":
      return [{ ...base(ctx), type: "turn.started" }];

    case "session.started":
      return [
        { ...base(ctx), type: "session.started", sessionId: message.sessionId, model: message.model ?? null },
      ];

    case "assistant.delta":
      return [{ ...base(ctx), type: "content.delta", streamKind: "assistant_text", delta: message.delta }];

    case "reasoning.delta":
      return [{ ...base(ctx), type: "content.delta", streamKind: "reasoning_text", delta: message.delta }];

    case "assistant.message":
      return [{ ...base(ctx), type: "item.completed", itemType: "assistant_text", text: message.text }];

    case "tool.started":
      return [
        {
          ...base(ctx),
          itemId: message.itemId,
          type: "item.started",
          itemType: "tool",
          title: (message.title || message.tool).slice(0, 80),
        },
      ];

    case "tool.completed":
      return [{ ...base(ctx), itemId: message.itemId, type: "item.completed", itemType: "tool", ok: message.ok }];

    case "token.usage":
      return [
        { ...base(ctx), type: "thread.token-usage.updated", input: message.input, output: message.output },
      ];

    // A delegated child run shows as one activity chip, opened when the
    // child session appears and closed when it ends. Its deltas are not
    // relayed (bridge.py forwards root-session events only) — two narrators
    // interleaved into one transcript reads as corruption, not as progress.
    case "subagent.started":
      return [
        {
          ...base(ctx),
          itemId: subagentItemId(message.childSessionId),
          type: "item.started",
          itemType: "tool",
          title: `Delegated agent ${message.childSessionId.slice(-12)}`,
          subagent: {
            childSessionId: message.childSessionId,
            ...(message.parentSessionId ? { parentSessionId: message.parentSessionId } : {}),
            status: "running",
          },
        },
      ];

    case "subagent.finished":
      return [
        {
          ...base(ctx),
          itemId: subagentItemId(message.childSessionId),
          type: "item.completed",
          itemType: "tool",
          ok: message.ok,
          subagent: {
            childSessionId: message.childSessionId,
            ...(message.parentSessionId ? { parentSessionId: message.parentSessionId } : {}),
            provider: message.provider,
            ...(message.agentId ? { agentId: message.agentId } : {}),
            status: message.ok ? "completed" : "failed",
            stopReason: message.stopReason,
            ...(message.lastAssistantMessage ? { lastAssistantMessage: message.lastAssistantMessage } : {}),
          },
        },
      ];

    case "approval.requested":
      return [
        {
          ...base(ctx),
          requestId: ctx.requestIdFor?.(message.approvalId) ?? message.approvalId,
          type: "request.opened",
          requestType: "permission",
          tool: message.tool,
          summary: message.summary.slice(0, 200),
        },
      ];

    case "turn.completed": {
      const ok = isSuccessfulFinish(message.finishReason);
      return [
        {
          ...base(ctx),
          type: "turn.completed",
          ok,
          stopReason: ok ? null : message.finishReason,
          cost: null,
        },
      ];
    }

    case "error": {
      const { message: text, setup } = toRuntimeError(message.message || message.code, message.message);
      return [{ ...base(ctx), type: "runtime.error", message: text, ...(setup ? { setup: true } : {}) }];
    }
  }
}

/** Terminal messages end a turn; the driver uses this instead of matching
 * on type strings in three places. */
export function isTerminal(message: BridgeMessage): boolean {
  return message.type === "turn.completed";
}

function subagentItemId(childSessionId: string): string {
  return `subagent:${childSessionId}`;
}

/** Was this a turn that did what was asked?
 *
 * The vocabulary is the runtime's `TurnEndReason` kind, read off
 * `turn/end`'s `data.reason.kind`: `completed`, `aborted`, `blocked`,
 * `error`, `max-tokens`, `interrupted` (packages/core/session/src/types.ts).
 * Only `completed` is a success. `max-tokens` in particular is treated as a
 * failure on purpose — the upstream SDK server makes that a per-deployment
 * choice via `maxTokensAsSuccess`, and a truncated answer presented as a
 * finished one is the version of this that misleads the user. */
export function isSuccessfulFinish(finishReason: string | null): boolean {
  return finishReason === null || finishReason === "completed";
}
