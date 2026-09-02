import type { AppConfig } from "./config.ts";
import type { Notification } from "./notify.ts";

const TELEGRAM_API = "https://api.telegram.org";
const REQUEST_TIMEOUT_MS = 12_000;
const TELEGRAM_MESSAGE_LIMIT = 4096;

interface TelegramResponse<T> {
  ok?: boolean;
  result?: T;
  description?: string;
}

export interface TelegramIdentity {
  id: number;
  username: string;
  displayName: string;
}

export interface TelegramChat {
  id: string;
  label: string;
}

function settings(cfg: AppConfig) {
  return {
    token: cfg.telegram?.botToken?.trim() ?? "",
    chatId: cfg.telegram?.chatId?.trim() ?? "",
    enabled: cfg.telegram?.enabled !== false,
  };
}

async function callTelegram<T>(
  token: string,
  method: string,
  body: Record<string, unknown>,
  fetcher: typeof fetch,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  timer.unref?.();
  try {
    const response = await fetcher(`${TELEGRAM_API}/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => ({}))) as TelegramResponse<T>;
    if (!response.ok || payload.ok !== true || payload.result === undefined) {
      throw new Error(payload.description?.slice(0, 240) || `Telegram ${method} failed with HTTP ${response.status}`);
    }
    return payload.result;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Telegram ${method} timed out`, { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function validTelegramChatId(value: string): boolean {
  const chatId = value.trim();
  return /^-?\d{1,24}$/.test(chatId) || /^@[A-Za-z][A-Za-z0-9_]{3,31}$/.test(chatId);
}

export async function verifyTelegramBot(token: string, fetcher: typeof fetch = fetch): Promise<TelegramIdentity> {
  const trimmed = token.trim();
  if (!trimmed || /\s/.test(trimmed) || trimmed.length > 256) throw new Error("Telegram bot token is invalid");
  const bot = await callTelegram<{ id: number; username?: string; first_name?: string }>(trimmed, "getMe", {}, fetcher);
  return {
    id: bot.id,
    username: bot.username ?? "",
    displayName: bot.first_name?.trim() || bot.username || "Telegram bot",
  };
}

export async function discoverTelegramChat(cfg: AppConfig, fetcher: typeof fetch = fetch): Promise<TelegramChat> {
  const { token } = settings(cfg);
  if (!token) throw new Error("Save the Telegram bot token first");
  const updates = await callTelegram<Array<{
    message?: { chat?: { id?: number; title?: string; username?: string; first_name?: string; last_name?: string } };
  }>>(token, "getUpdates", { limit: 50, timeout: 0, allowed_updates: ["message"] }, fetcher);
  const chat = updates.map((update) => update.message?.chat).filter(Boolean).at(-1);
  if (!chat?.id) throw new Error("No Telegram chat found. Open the bot in Telegram, send /start, then try again.");
  const label = chat.title || chat.username || [chat.first_name, chat.last_name].filter(Boolean).join(" ") || String(chat.id);
  return { id: String(chat.id), label };
}

const COLOR_DOT: Record<string, string> = {
  blue: "🔵",
  green: "🟢",
  orange: "🟠",
  pink: "🩷",
  purple: "🟣",
  red: "🔴",
  yellow: "🟡",
};

function telegramHeader(notification: Notification): string {
  const dot = COLOR_DOT[notification.botColor ?? ""] ?? "🤖";
  const profile = [notification.botName, notification.botTitle].filter(Boolean).join(" · ");
  const status =
    notification.kind === "approval"
      ? "Onay gerekiyor"
      : notification.kind === "question"
        ? "Yanıt bekliyor"
        : notification.kind === "routine-failed"
          ? "Otomasyon başarısız"
          : "Görev tamamlandı";
  return `${dot} ${profile}\n${status}`.trim();
}

/** The desktop banner gets a compact summary, while Telegram receives the
 * full report exactly as the bot wrote it. Telegram accepts at most 4096
 * characters per request, so long reports are delivered in order, never cut. */
export function telegramNotificationTexts(notification: Notification): string[] {
  const header = telegramHeader(notification);
  const report = notification.detail.trim() || notification.body.trim();
  const chunks: string[] = [];
  let remaining = report || notification.body;
  let index = 1;

  do {
    const prefix = index === 1 ? `${header}\n\n` : `${header}\nDevamı (${index})\n\n`;
    const capacity = TELEGRAM_MESSAGE_LIMIT - prefix.length;
    let end = Math.min(remaining.length, capacity);
    if (end < remaining.length) {
      const breakAt = remaining.lastIndexOf("\n", end);
      if (breakAt > capacity / 2) end = breakAt;
    }
    const chunk = remaining.slice(0, end).trimEnd();
    chunks.push(`${prefix}${chunk}`.trim());
    remaining = remaining.slice(end).trimStart();
    index += 1;
  } while (remaining);

  return chunks;
}

/** Compatibility helper for previews and the short test action. */
export function telegramNotificationText(notification: Notification): string {
  return telegramNotificationTexts(notification)[0] ?? telegramHeader(notification);
}

export async function sendTelegramNotification(
  cfg: AppConfig,
  notification: Notification,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  const { token, chatId, enabled } = settings(cfg);
  if (!enabled || !token || !chatId) return false;
  for (const text of telegramNotificationTexts(notification)) {
    await callTelegram(token, "sendMessage", { chat_id: chatId, text }, fetcher);
  }
  return true;
}

let deliveryQueue = Promise.resolve();

/** Preserve result order when several bots finish together and isolate a
 * provider outage from the turn that produced the notification. */
export function enqueueTelegramNotification(cfg: AppConfig, notification: Notification): void {
  deliveryQueue = deliveryQueue
    .catch(() => undefined)
    .then(() => sendTelegramNotification(cfg, notification))
    .then(() => undefined)
    .catch((error) => {
      console.warn(`[telegram] ${error instanceof Error ? error.message : String(error)}`);
    });
}

export interface TelegramButton {
  /** Shown on the button. */
  label: string;
  /** Round-trips back as `callback_query.data`; Telegram caps it at 64 bytes,
   * which is why the answer is carried by index rather than by its text. */
  data: string;
}

/**
 * Post a message to the paired chat.
 *
 * Returns the sent message id, which is what lets a later reply be traced
 * back to the work it is about. Null when Telegram is not configured or the
 * response did not carry one — the message still went out; only threading is
 * lost.
 */
export async function sendTelegramMessage(
  cfg: AppConfig,
  text: string,
  options: { replyTo?: number; buttons?: TelegramButton[][] } = {},
  fetcher: typeof fetch = fetch,
): Promise<number | null> {
  const { token, chatId, enabled } = settings(cfg);
  if (!enabled || !token || !chatId) return null;
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text: text.slice(0, TELEGRAM_MESSAGE_LIMIT),
  };
  if (options.replyTo) {
    // The reply may be gone by the time we answer; Telegram would otherwise
    // reject the whole message rather than send it unthreaded.
    body.reply_to_message_id = options.replyTo;
    body.allow_sending_without_reply = true;
  }
  if (options.buttons?.length) {
    body.reply_markup = {
      inline_keyboard: options.buttons.map((row) =>
        row.map((button) => ({ text: button.label.slice(0, 64), callback_data: button.data.slice(0, 64) })),
      ),
    };
  }
  const sent = await callTelegram<{ message_id?: number }>(token, "sendMessage", body, fetcher);
  return typeof sent.message_id === "number" ? sent.message_id : null;
}

/** Stop the spinner on a tapped button, with an optional toast. */
export async function answerTelegramCallback(
  cfg: AppConfig,
  callbackId: string,
  text?: string,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const { token, enabled } = settings(cfg);
  if (!enabled || !token) return;
  await callTelegram(
    token,
    "answerCallbackQuery",
    { callback_query_id: callbackId, ...(text ? { text: text.slice(0, 200) } : {}) },
    fetcher,
  ).catch(() => undefined);
}

/** The buttons for a card with a short, fixed set of answers. Long or
 * free-text questions get no keyboard — the person types the answer as an
 * ordinary reply, which the conversation map routes to the same task. */
export function telegramAnswerButtons(requestId: string, options: readonly string[]): TelegramButton[][] {
  const usable = options
    .map((option) => String(option ?? "").trim())
    .filter(Boolean)
    .filter((option) => `a:${requestId}:${option}`.length <= 64)
    .slice(0, 6);
  return usable.length ? usable.map((option) => [{ label: option, data: `a:${requestId}:${option}` }]) : [];
}
