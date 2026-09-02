// Turning a Telegram message into work, and the answer back into a reply.
//
// The pieces around this file each do one thing: telegram-inbox.ts decides
// what arrived and whether it is allowed, telegram-router.ts decides who
// should do it, the RoutineManager queue decides when. This is the part that
// holds them together and keeps one promise the others cannot: the person in
// Telegram always finds out what happened to their message.
//
// Every dependency is injected. The harness owns bots, turns and approvals,
// and reaching into it from here would make this untestable and the harness
// unreadable; the options below are the whole contract.
import { readFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

import { writeFileAtomic } from "./atomic.ts";
import { DATA_DIR } from "./config.ts";
import { parseRouting, routingPrompt, type NewBotProfile, type RosterEntry } from "./telegram-router.ts";
import type { AcceptedUpdate } from "./telegram-updates.ts";

export interface TelegramAgentOptions {
  /** Everyone who could take work, Chief included. */
  roster: () => RosterEntry[];
  /** One model call for the staffing decision. Returns raw text. */
  ask: (prompt: string) => Promise<string>;
  /** Whether the user has switched on "let the Chief create a MAUS". */
  canCreate: () => boolean;
  createBot: (profile: NewBotProfile) => Promise<{ id: string; name: string }>;
  /**
   * Queue the work. `deliveryId` is Telegram's own message identity, so a
   * redelivery cannot become a second task even if it gets this far.
   */
  startWork: (input: {
    botId: string;
    text: string;
    deliveryId: string;
    /** Continuing an existing conversation rather than opening one. */
    threadId?: string;
  }) => Promise<{ threadId: string }>;
  /** Answer an approval or option card from a Telegram button. */
  answerCard: (requestId: string, answer: string) => Promise<boolean>;
  /** Post to the paired chat; resolves to the sent message id when known. */
  send: (text: string, options?: { replyTo?: number }) => Promise<number | null>;
  /** Acknowledge a button press so Telegram stops showing its spinner. */
  ackCallback?: (callbackId: string, text?: string) => Promise<void>;
  file?: string;
  now?: () => number;
}

interface Conversation {
  botId: string;
  botName: string;
  threadId: string;
  /** The Telegram message that opened it, for threading replies. */
  rootMessageId: number;
  at: number;
}

interface ConversationFile {
  /** Keyed by Telegram message id — both the request and the replies we send
   * about it, so replying to either continues the same work. */
  byMessage: Record<string, Conversation>;
}

const MAX_CONVERSATIONS = 500;

export class TelegramAgent {
  private readonly options: TelegramAgentOptions;
  private readonly file: string;
  private readonly now: () => number;
  private byMessage = new Map<string, Conversation>();
  /** Serialises the routing decisions so two fast messages cannot both be
   * told "nobody fits" and both create the same MAUS. */
  private queue: Promise<void> = Promise.resolve();

  constructor(options: TelegramAgentOptions) {
    this.options = options;
    this.file = options.file ?? join(DATA_DIR, "telegram-conversations.json");
    this.now = options.now ?? (() => Date.now());
    this.load();
  }

  private load(): void {
    try {
      const parsed = JSON.parse(readFileSync(this.file, "utf8")) as ConversationFile;
      for (const [key, value] of Object.entries(parsed?.byMessage ?? {})) {
        if (value?.botId && value?.threadId) this.byMessage.set(key, value);
      }
    } catch {
      // First run, or a file we cannot read: conversations restart, work does
      // not. A reply that finds no conversation opens a new one.
    }
  }

  private save(): void {
    // Oldest first out: this map only exists to answer "what does a reply
    // continue", and a year-old message is not that.
    if (this.byMessage.size > MAX_CONVERSATIONS) {
      const ordered = [...this.byMessage.entries()].sort((a, b) => a[1].at - b[1].at);
      for (const [key] of ordered.slice(0, this.byMessage.size - MAX_CONVERSATIONS)) this.byMessage.delete(key);
    }
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      writeFileAtomic(
        this.file,
        JSON.stringify({ byMessage: Object.fromEntries(this.byMessage) } satisfies ConversationFile, null, 2),
        { mode: 0o600 },
      );
    } catch {
      // Losing the map costs threading, not work.
    }
  }

  /** Remember that this Telegram message belongs to a conversation, so a
   * reply to it continues the same task. */
  private remember(messageId: number | null | undefined, conversation: Conversation): void {
    if (messageId == null) return;
    this.byMessage.set(String(messageId), conversation);
    this.save();
  }

  conversationFor(messageId: number | undefined): Conversation | null {
    if (messageId == null) return null;
    return this.byMessage.get(String(messageId)) ?? null;
  }

  /** Serialised so concurrent messages cannot race into two identical bots. */
  handle(update: AcceptedUpdate): Promise<void> {
    const next = this.queue.then(() => this.dispatch(update)).catch((error) => {
      console.warn(`[telegram] ${error instanceof Error ? error.message : String(error)}`);
    });
    this.queue = next;
    return next;
  }

  private async dispatch(update: AcceptedUpdate): Promise<void> {
    if (update.kind === "callback") return this.handleCallback(update);
    return this.handleMessage(update);
  }

  private async handleCallback(update: Extract<AcceptedUpdate, { kind: "callback" }>): Promise<void> {
    // `a:<requestId>:<answer>` — built where the buttons are.
    const match = /^a:([\w-]{1,100}):([\s\S]{1,120})$/.exec(update.data);
    if (!match) {
      await this.options.ackCallback?.(update.callbackId, "That button is no longer valid.");
      return;
    }
    const answered = await this.options.answerCard(match[1], match[2]);
    await this.options.ackCallback?.(
      update.callbackId,
      answered ? `Sent: ${match[2]}` : "That question was already answered.",
    );
  }

  private async handleMessage(update: Extract<AcceptedUpdate, { kind: "message" }>): Promise<void> {
    // A reply continues the work it replies to, without asking the Chief
    // again — the person is talking to a MAUS that is already on the job.
    const existing = this.conversationFor(update.replyToMessageId);
    if (existing) {
      await this.options.startWork({
        botId: existing.botId,
        text: update.text,
        deliveryId: update.deliveryId,
        threadId: existing.threadId,
      });
      this.remember(update.messageId, { ...existing, at: this.now() });
      return;
    }

    const roster = this.options.roster();
    const canCreate = this.options.canCreate();
    let decision;
    try {
      decision = parseRouting(await this.options.ask(routingPrompt(update.text, roster, canCreate)), roster, canCreate);
    } catch (error) {
      await this.reply(update, `I could not reach the Chief to staff this: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }

    if (decision.kind === "none") {
      await this.reply(
        update,
        canCreate
          ? `I did not start this: ${decision.why}.`
          : `I did not start this: ${decision.why}. Turn on automatic MAUS creation in Settings → Telegram if you want me to make one.`,
      );
      return;
    }

    let botId: string;
    let botName: string;
    let opening: string;
    if (decision.kind === "create") {
      try {
        const created = await this.options.createBot(decision.profile);
        botId = created.id;
        botName = created.name;
        opening = `No one on the team fitted, so I created ${created.name} (${decision.profile.title || "new MAUS"}) and gave it the job.`;
      } catch (error) {
        await this.reply(update, `I could not create a MAUS for this: ${error instanceof Error ? error.message : String(error)}`);
        return;
      }
    } else {
      const entry = roster.find((candidate) => candidate.id === decision.botId)!;
      botId = entry.id;
      botName = entry.name;
      // Busy is worth saying out loud: the answer is coming, just not yet.
      opening = entry.busy
        ? `${entry.name} is mid-task — this is queued behind it.`
        : `${entry.name} is on it.`;
    }

    try {
      const { threadId } = await this.options.startWork({ botId, text: update.text, deliveryId: update.deliveryId });
      const sent = await this.reply(update, opening);
      const conversation: Conversation = {
        botId,
        botName,
        threadId,
        rootMessageId: update.messageId,
        at: this.now(),
      };
      // Both the request and the acknowledgement point at this conversation,
      // so replying to either one continues it.
      this.remember(update.messageId, conversation);
      this.remember(sent, conversation);
    } catch (error) {
      await this.reply(update, `${botName} could not start: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private reply(update: Extract<AcceptedUpdate, { kind: "message" }>, text: string): Promise<number | null> {
    return this.options.send(text, { replyTo: update.messageId }).catch(() => null);
  }
}
