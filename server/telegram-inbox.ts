// The inbound half of Telegram: a long poll that turns messages into work.
//
// Deliberately `getUpdates` rather than a webhook. A webhook needs a public
// HTTPS endpoint, which for a desktop app means either a tunnel the user has
// to run or a relay that sees every message; long polling needs neither — one
// outbound connection from the machine that is already running the harness.
// The cost is stated plainly in the UI: this only works while MausCrew is
// running. https://core.telegram.org/bots/api#getupdates
//
// Duplicate protection is Telegram's own: an offset acknowledges every update
// below it and those are never sent again. So the one thing that must survive
// a restart is the offset, and it is written before the batch is handled — a
// crash mid-batch costs an unprocessed message, which the user can resend,
// rather than a task that runs twice with the app none the wiser.
import { readFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

import { writeFileAtomic } from "./atomic.ts";
import { DATA_DIR } from "./config.ts";
import { classifyUpdate, nextOffset, type AcceptedUpdate, type InboxRules, type TelegramUpdate } from "./telegram-updates.ts";

const TELEGRAM_API = "https://api.telegram.org";
/** Telegram holds the request open this long when nothing is happening. */
const LONG_POLL_SECONDS = 25;
/** Backoff after a failed poll, so a revoked token does not become a tight
 * loop against Telegram's API. */
const RETRY_MS = 15_000;

export interface TelegramInboxOptions {
  /** Reads the live config each poll, so saving a new token or chat takes
   * effect without a restart. */
  settings: () => { token: string; chatId: string; enabled: boolean; allowedUserIds?: number[] };
  onUpdate: (update: AcceptedUpdate) => Promise<void> | void;
  /** Reported rather than thrown: a poller that dies on a bad token is a
   * feature that silently stops working. */
  onProblem?: (problem: string | null) => void;
  fetcher?: typeof fetch;
  file?: string;
  now?: () => number;
}

interface OffsetFile {
  offset: number;
  chatId: string;
}

export class TelegramInbox {
  private readonly options: TelegramInboxOptions;
  private readonly file: string;
  private offset = 0;
  private offsetChat = "";
  private running = false;
  private stopped = true;
  private controller: AbortController | null = null;
  private lastProblem: string | null = null;

  constructor(options: TelegramInboxOptions) {
    this.options = options;
    this.file = options.file ?? join(DATA_DIR, "telegram-inbox.json");
    this.load();
  }

  private load(): void {
    try {
      const parsed = JSON.parse(readFileSync(this.file, "utf8")) as OffsetFile;
      if (Number.isFinite(parsed?.offset)) this.offset = Number(parsed.offset);
      this.offsetChat = String(parsed?.chatId ?? "");
    } catch {
      // No file yet, or an unreadable one: start from Telegram's own backlog.
    }
  }

  private saveOffset(offset: number, chatId: string): void {
    this.offset = offset;
    this.offsetChat = chatId;
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      writeFileAtomic(this.file, JSON.stringify({ offset, chatId }, null, 2), { mode: 0o600 });
    } catch (error) {
      // A durable offset is what stops duplicate work; if it cannot be
      // written, say so rather than quietly polling from memory.
      this.problem(`could not save the Telegram offset: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private problem(value: string | null): void {
    if (this.lastProblem === value) return;
    this.lastProblem = value;
    this.options.onProblem?.(value);
  }

  get status(): { running: boolean; offset: number; problem: string | null } {
    return { running: this.running, offset: this.offset, problem: this.lastProblem };
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.stopped = false;
    void this.loop();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.running = false;
    this.controller?.abort();
    this.controller = null;
  }

  private async loop(): Promise<void> {
    const fetcher = this.options.fetcher ?? fetch;
    while (!this.stopped) {
      const { token, chatId, enabled, allowedUserIds } = this.options.settings();
      if (!enabled || !token || !chatId) {
        this.problem(null);
        await this.pause(RETRY_MS);
        continue;
      }
      // Pairing with a different chat invalidates the old cursor: those
      // updates belong to a conversation this install is no longer in.
      if (this.offsetChat && this.offsetChat !== chatId) this.saveOffset(0, chatId);

      try {
        const updates = await this.poll(token, fetcher);
        this.problem(null);
        if (updates.length) {
          // Acknowledged before handling, on purpose — see the file header.
          this.saveOffset(nextOffset(updates, this.offset), chatId);
          const rules: InboxRules = { chatId, ...(allowedUserIds?.length ? { allowedUserIds } : {}) };
          for (const update of updates) {
            const verdict = classifyUpdate(update, rules);
            if (verdict.kind === "ignored") continue;
            try {
              await this.options.onUpdate(verdict);
            } catch (error) {
              // One bad message must not stop the listener.
              console.warn(`[telegram] ${error instanceof Error ? error.message : String(error)}`);
            }
          }
        }
      } catch (error) {
        if (this.stopped) return;
        const message = error instanceof Error ? error.message : String(error);
        // An aborted poll is this process shutting down, not a fault.
        if (!/abort/i.test(message)) {
          this.problem(message.slice(0, 200));
          await this.pause(RETRY_MS);
        }
      }
    }
  }

  private async poll(token: string, fetcher: typeof fetch): Promise<TelegramUpdate[]> {
    this.controller = new AbortController();
    try {
      const response = await fetcher(`${TELEGRAM_API}/bot${token}/getUpdates`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          offset: this.offset,
          timeout: LONG_POLL_SECONDS,
          allowed_updates: ["message", "callback_query"],
        }),
        signal: this.controller.signal,
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        result?: TelegramUpdate[];
        description?: string;
      };
      if (!response.ok || payload.ok !== true) {
        throw new Error(payload.description?.slice(0, 200) || `Telegram getUpdates failed with HTTP ${response.status}`);
      }
      return Array.isArray(payload.result) ? payload.result : [];
    } finally {
      this.controller = null;
    }
  }

  private pause(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      timer.unref?.();
    });
  }
}
