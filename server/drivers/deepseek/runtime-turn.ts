// One turn's worth of SDK-runtime notifications, translated into the
// driver's BridgeMessage stream (spec §88).
//
// This is the part of bridge.py that actually mattered, moved into the
// process that consumes it. The Python bridge never interpreted the model —
// it subscribed to four JSON-RPC notifications, decided which ones belonged
// to its turn, and reshaped them. All of that is deterministic, so it lives
// here as a state machine with no I/O: feed it notifications, collect
// messages. Everything that needs a process (spawning, the connection,
// restarts) belongs to native-bridge.ts.
//
// The three semantics that are easy to get wrong, all verified against the
// upstream Python SDK (`python/sdk/src/deepseek_harness/api.py`, `Session.run`):
//
//   1. A turn is over when `session.status` reports `idle` for OUR session,
//      and only after we have seen the inbox receipt for the message id
//      `session/prompt` returned. Without that gate an `idle` left over from
//      before our prompt was spliced ends the turn instantly.
//   2. `finalResponse` is the text of the LAST `assistant/message` event.
//   3. `finishReason` is `data.reason.kind` of the LAST `turn/end` event.
//
// Only root-session content is forwarded. Subagent sessions produce
// notifications too, and relaying their deltas would interleave two narrators
// into one transcript; their lifecycle is forwarded instead, as one chip per
// child (spec §50).
import type { BridgeMessage } from "./bridge-protocol.ts";
import type { JsonRpcNotification } from "./jsonrpc.ts";

/** The turn ended, and how. `null` means it has not ended yet. */
export interface TurnOutcome {
  finishReason: string | null;
  finalResponse: string;
  sessionId: string;
}

export interface TurnTranslation {
  messages: BridgeMessage[];
  /** Set once, on the transition to idle. */
  outcome: TurnOutcome | null;
}

const EMPTY: TurnTranslation = { messages: [], outcome: null };

export class RuntimeTurn {
  readonly requestId: string;
  readonly sessionId: string;

  /** Sessions delegated by this turn, transitively. Delegation nests, so a
   * grandchild must still be recognized as ours rather than dropped. Per
   * turn, never shared: two turns must not see each other's children. */
  private readonly descendants = new Set<string>();
  /** The `session/prompt` receipt we are waiting to observe. Empty until the
   * request returns — notifications can arrive before it does. */
  private messageId = "";
  /** Inbox receipts may arrive before the JSON-RPC response that tells us
   * which message id belongs to this prompt. Retain their ids so response vs
   * notification scheduling cannot strand an otherwise completed turn. */
  private readonly inboxReceipts = new Set<string>();
  private spliced = false;
  private finalResponse = "";
  private finishReason: string | null = null;
  private finished = false;

  constructor(requestId: string, sessionId: string) {
    this.requestId = requestId;
    this.sessionId = sessionId;
  }

  /** Record the id `session/prompt` returned. Until this is known the turn
   * cannot recognize its own receipt, so it also cannot end. */
  setMessageId(messageId: string): void {
    this.messageId = messageId;
    if (this.inboxReceipts.has(messageId)) this.spliced = true;
  }

  /** Translate one notification. Returns the messages to emit, plus the
   * outcome on the notification that ends the turn. */
  accept(notification: JsonRpcNotification): TurnTranslation {
    if (this.finished) return EMPTY;
    const { method, params } = notification;

    if (method === "subagent.started" || method === "subagent.finished") {
      return this.acceptSubagent(method, params);
    }
    if (method === "session.status") {
      return this.acceptStatus(params);
    }
    if (method !== "session.event") return EMPTY;
    if (params.sessionId !== this.sessionId) return EMPTY;
    const event = params.event;
    if (typeof event !== "object" || event === null) return EMPTY;
    return this.acceptSessionEvent(event as Record<string, unknown>);
  }

  private acceptSubagent(method: string, params: Record<string, unknown>): TurnTranslation {
    const parent = params.parentSessionId;
    const child = params.childSessionId;
    if (typeof child !== "string" || !child) return EMPTY;
    if (parent !== this.sessionId && !(typeof parent === "string" && this.descendants.has(parent))) {
      return EMPTY;
    }
    if (method === "subagent.started") {
      this.descendants.add(child);
      return {
        messages: [
          {
            type: "subagent.started",
            requestId: this.requestId,
            childSessionId: child,
            parentSessionId: typeof parent === "string" ? parent : undefined,
          },
        ],
        outcome: null,
      };
    }
    return {
      messages: [
        {
          type: "subagent.finished",
          requestId: this.requestId,
          childSessionId: child,
          parentSessionId: typeof parent === "string" ? parent : undefined,
          provider: str(params.provider, "subagent"),
          agentId: str(params.agentId, "") || undefined,
          // `ok` | `error` is the deployment-mapped outcome. Anything that is
          // not an explicit ok renders as a failed chip rather than a guess,
          // so a child that errored never shows as finished.
          ok: params.status === "ok",
          stopReason: str(params.stopReason, "completed"),
          lastAssistantMessage: str(params.lastAssistantMessage, "").slice(0, 4_000) || undefined,
        },
      ],
      outcome: null,
    };
  }

  private acceptStatus(params: Record<string, unknown>): TurnTranslation {
    if (params.sessionId !== this.sessionId) return EMPTY;
    if (params.status !== "idle") return EMPTY;
    // The receipt gate. An `idle` before our prompt was spliced into the
    // inbox belongs to the previous turn on this session, and honouring it
    // would settle this turn before the model has said a word.
    if (!this.spliced) return EMPTY;
    return this.settle();
  }

  private settle(): TurnTranslation {
    this.finished = true;
    const messages: BridgeMessage[] = [];
    if (this.finalResponse) {
      messages.push({ type: "assistant.message", requestId: this.requestId, text: this.finalResponse });
    }
    return {
      messages,
      outcome: { finishReason: this.finishReason, finalResponse: this.finalResponse, sessionId: this.sessionId },
    };
  }

  private acceptSessionEvent(event: Record<string, unknown>): TurnTranslation {
    const etype = event.type;
    const data = typeof event.data === "object" && event.data !== null ? (event.data as Record<string, unknown>) : {};

    if (etype === "agent/inbox/spliced") {
      this.noteReceipt(data);
      return EMPTY;
    }

    if (etype === "assistant/chunk") {
      const chunk = data.chunk;
      if (typeof chunk !== "object" || chunk === null) return EMPTY;
      const c = chunk as Record<string, unknown>;
      const text = typeof c.text === "string" ? c.text : "";
      if (c.type === "text-delta" && text) {
        return { messages: [{ type: "assistant.delta", requestId: this.requestId, delta: text }], outcome: null };
      }
      if (c.type === "reasoning-delta" && text) {
        return { messages: [{ type: "reasoning.delta", requestId: this.requestId, delta: text }], outcome: null };
      }
      if (c.type === "usage") return { messages: this.usage(c.usage), outcome: null };
      return EMPTY;
    }

    if (etype === "assistant/message") {
      // The last one wins: this is the run's final response, recomputed as
      // the run goes so nothing has to be retained in a growing array.
      const text = assistantText(data);
      if (text) this.finalResponse = text;
      return { messages: this.usage(data.usage), outcome: null };
    }

    if (etype === "turn/end") {
      const reason = data.reason;
      const kind = typeof reason === "object" && reason !== null ? (reason as Record<string, unknown>).kind : undefined;
      // Upstream raises on a turn/end without a string kind. We record null
      // instead: an unreadable reason is a reason we do not know, and taking
      // the whole turn down over the shape of a label would lose the answer
      // the model already produced.
      this.finishReason = typeof kind === "string" ? kind : null;
      return EMPTY;
    }

    if (etype === "tool/call") {
      const name = str(data.name, "tool");
      return {
        messages: [
          {
            type: "tool.started",
            requestId: this.requestId,
            tool: name,
            itemId: str(data.callId, `${this.requestId}-tool`),
            title: summarizeTool(name, data.arguments),
          },
        ],
        outcome: null,
      };
    }

    if (etype === "tool/result") {
      const message = typeof data.message === "object" && data.message !== null
        ? (data.message as Record<string, unknown>)
        : {};
      return {
        messages: [
          {
            type: "tool.completed",
            requestId: this.requestId,
            itemId: str(message.callId, "") || str(data.callId, `${this.requestId}-tool`),
            ok: message.isError !== true,
          },
        ],
        outcome: null,
      };
    }

    return EMPTY;
  }

  private noteReceipt(data: Record<string, unknown>): void {
    const inserted = data.inserted;
    if (!Array.isArray(inserted)) return;
    for (const entry of inserted) {
      if (typeof entry === "object" && entry !== null) {
        const id = (entry as Record<string, unknown>).id;
        if (typeof id !== "string" || !id) continue;
        this.inboxReceipts.add(id);
        if (this.messageId && id === this.messageId) this.spliced = true;
      }
    }
  }

  private usage(usage: unknown): BridgeMessage[] {
    if (typeof usage !== "object" || usage === null) return [];
    const u = usage as Record<string, unknown>;
    const input = typeof u.inputTokens === "number" ? u.inputTokens : null;
    const output = typeof u.outputTokens === "number" ? u.outputTokens : null;
    if (input === null && output === null) return [];
    return [{ type: "token.usage", requestId: this.requestId, input: input ?? 0, output: output ?? 0 }];
  }

  /** Settle a turn the runtime will never settle for us — a cancel, or a
   * connection that died mid-turn. */
  abandon(finishReason: string): TurnOutcome {
    this.finished = true;
    return { finishReason, finalResponse: this.finalResponse, sessionId: this.sessionId };
  }

  get isFinished(): boolean {
    return this.finished;
  }
}

/** The text of an `assistant/message` event, whose content may sit on the
 * event data or one level down under `message` (upstream reads both). */
function assistantText(data: Record<string, unknown>): string {
  const message = data.message;
  const owner = typeof message === "object" && message !== null ? (message as Record<string, unknown>) : data;
  const content = owner.content;
  if (!Array.isArray(content)) return "";
  let out = "";
  for (const block of content) {
    if (typeof block === "object" && block !== null) {
      const b = block as Record<string, unknown>;
      if (b.type === "text" && typeof b.text === "string") out += b.text;
    }
  }
  return out;
}

/** A short label for the activity chip. Tool arguments can carry file
 * contents or command output, so this takes a prefix and never the whole
 * payload. */
export function summarizeTool(name: string, args: unknown): string {
  let text = "";
  if (typeof args === "string") text = args;
  else if (typeof args === "object" && args !== null) {
    const o = args as Record<string, unknown>;
    for (const field of ["command", "path", "file_path", "query"]) {
      const value = o[field];
      if (typeof value === "string" && value) {
        text = value;
        break;
      }
    }
  }
  text = text.replace(/\n/g, " ").trim();
  return text ? `${name}: ${text.slice(0, 60)}` : name;
}

function str(value: unknown, fallback: string): string {
  return typeof value === "string" && value ? value : fallback;
}
