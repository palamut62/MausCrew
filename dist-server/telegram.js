const TELEGRAM_API = "https://api.telegram.org";
const REQUEST_TIMEOUT_MS = 12_000;
const TELEGRAM_MESSAGE_LIMIT = 4096;
function settings(cfg) {
    return {
        token: cfg.telegram?.botToken?.trim() ?? "",
        chatId: cfg.telegram?.chatId?.trim() ?? "",
        enabled: cfg.telegram?.enabled !== false,
    };
}
async function callTelegram(token, method, body, fetcher) {
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
        const payload = (await response.json().catch(() => ({})));
        if (!response.ok || payload.ok !== true || payload.result === undefined) {
            throw new Error(payload.description?.slice(0, 240) || `Telegram ${method} failed with HTTP ${response.status}`);
        }
        return payload.result;
    }
    catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
            throw new Error(`Telegram ${method} timed out`, { cause: error });
        }
        throw error;
    }
    finally {
        clearTimeout(timer);
    }
}
export function validTelegramChatId(value) {
    const chatId = value.trim();
    return /^-?\d{1,24}$/.test(chatId) || /^@[A-Za-z][A-Za-z0-9_]{3,31}$/.test(chatId);
}
export async function verifyTelegramBot(token, fetcher = fetch) {
    const trimmed = token.trim();
    if (!trimmed || /\s/.test(trimmed) || trimmed.length > 256)
        throw new Error("Telegram bot token is invalid");
    const bot = await callTelegram(trimmed, "getMe", {}, fetcher);
    return {
        id: bot.id,
        username: bot.username ?? "",
        displayName: bot.first_name?.trim() || bot.username || "Telegram bot",
    };
}
export async function discoverTelegramChat(cfg, fetcher = fetch) {
    const { token } = settings(cfg);
    if (!token)
        throw new Error("Save the Telegram bot token first");
    const updates = await callTelegram(token, "getUpdates", { limit: 50, timeout: 0, allowed_updates: ["message"] }, fetcher);
    const chat = updates.map((update) => update.message?.chat).filter(Boolean).at(-1);
    if (!chat?.id)
        throw new Error("No Telegram chat found. Open the bot in Telegram, send /start, then try again.");
    const label = chat.title || chat.username || [chat.first_name, chat.last_name].filter(Boolean).join(" ") || String(chat.id);
    return { id: String(chat.id), label };
}
const COLOR_DOT = {
    blue: "🔵",
    green: "🟢",
    orange: "🟠",
    pink: "🩷",
    purple: "🟣",
    red: "🔴",
    yellow: "🟡",
};
/** What kind of event this is, said without a language.
 *
 * The header used to assert Turkish — "Onay gerekiyor" — above a report the
 * bot wrote in whatever language the conversation is in. So an English user
 * got a Turkish label, and a Turkish user got an English one the moment the
 * bot was addressed in English. A symbol reads the same in every language,
 * and the bot's own text underneath carries the meaning. */
const KIND_MARK = {
    approval: "🔐",
    question: "❓",
    "routine-failed": "⚠️",
    done: "✅",
};
function telegramHeader(notification) {
    const dot = COLOR_DOT[notification.botColor ?? ""] ?? "🤖";
    const profile = [notification.botName, notification.botTitle].filter(Boolean).join(" · ");
    return `${dot} ${profile} ${KIND_MARK[notification.kind] ?? ""}`.trim();
}
/** The desktop banner gets a compact summary, while Telegram receives the
 * full report exactly as the bot wrote it. Telegram accepts at most 4096
 * characters per request, so long reports are delivered in order, never cut. */
export function telegramNotificationTexts(notification) {
    const header = telegramHeader(notification);
    const report = notification.detail.trim() || notification.body.trim();
    const chunks = [];
    let remaining = report || notification.body;
    let index = 1;
    do {
        // Also language-neutral: "Devamı (2)" told an English reader nothing, and
        // a long report is exactly where a wrong-language label is loudest.
        const prefix = index === 1 ? `${header}\n\n` : `${header} · ${index}\n\n`;
        const capacity = TELEGRAM_MESSAGE_LIMIT - prefix.length;
        let end = Math.min(remaining.length, capacity);
        if (end < remaining.length) {
            const breakAt = remaining.lastIndexOf("\n", end);
            if (breakAt > capacity / 2)
                end = breakAt;
        }
        const chunk = remaining.slice(0, end).trimEnd();
        chunks.push(`${prefix}${chunk}`.trim());
        remaining = remaining.slice(end).trimStart();
        index += 1;
    } while (remaining);
    return chunks;
}
/** Compatibility helper for previews and the short test action. */
export function telegramNotificationText(notification) {
    return telegramNotificationTexts(notification)[0] ?? telegramHeader(notification);
}
export async function sendTelegramNotification(cfg, notification, fetcher = fetch) {
    const { token, chatId, enabled } = settings(cfg);
    if (!enabled || !token || !chatId)
        return false;
    for (const text of telegramNotificationTexts(notification)) {
        await callTelegram(token, "sendMessage", { chat_id: chatId, text }, fetcher);
    }
    return true;
}
let deliveryQueue = Promise.resolve();
/** Preserve result order when several bots finish together and isolate a
 * provider outage from the turn that produced the notification. */
export function enqueueTelegramNotification(cfg, notification) {
    deliveryQueue = deliveryQueue
        .catch(() => undefined)
        .then(() => sendTelegramNotification(cfg, notification))
        .then(() => undefined)
        .catch((error) => {
        console.warn(`[telegram] ${error instanceof Error ? error.message : String(error)}`);
    });
}
/**
 * Post a message to the paired chat.
 *
 * Returns the sent message id, which is what lets a later reply be traced
 * back to the work it is about. Null when Telegram is not configured or the
 * response did not carry one — the message still went out; only threading is
 * lost.
 */
export async function sendTelegramMessage(cfg, text, options = {}, fetcher = fetch) {
    const { token, chatId, enabled } = settings(cfg);
    if (!enabled || !token || !chatId)
        return null;
    const body = {
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
            inline_keyboard: options.buttons.map((row) => row.map((button) => ({ text: button.label.slice(0, 64), callback_data: button.data.slice(0, 64) }))),
        };
    }
    const sent = await callTelegram(token, "sendMessage", body, fetcher);
    return typeof sent.message_id === "number" ? sent.message_id : null;
}
/** Stop the spinner on a tapped button, with an optional toast. */
export async function answerTelegramCallback(cfg, callbackId, text, fetcher = fetch) {
    const { token, enabled } = settings(cfg);
    if (!enabled || !token)
        return;
    await callTelegram(token, "answerCallbackQuery", { callback_query_id: callbackId, ...(text ? { text: text.slice(0, 200) } : {}) }, fetcher).catch(() => undefined);
}
/** The buttons for a card with a short, fixed set of answers. Long or
 * free-text questions get no keyboard — the person types the answer as an
 * ordinary reply, which the conversation map routes to the same task. */
export function telegramAnswerButtons(requestId, options) {
    const usable = options
        .map((option) => String(option ?? "").trim())
        .filter(Boolean)
        .filter((option) => `a:${requestId}:${option}`.length <= 64)
        .slice(0, 6);
    return usable.length ? usable.map((option) => [{ label: option, data: `a:${requestId}:${option}` }]) : [];
}
/** Telegram refuses a bot upload above this, and says so in a way nobody
 * reads — so the caller checks first and reports it as what it is.
 * https://core.telegram.org/bots/api#senddocument */
export const TELEGRAM_DOCUMENT_LIMIT = 50 * 1024 * 1024;
/**
 * Send a file the bot produced to the paired chat.
 *
 * Multipart rather than a URL: the file is on the user's own machine and
 * there is nothing to link to. The caller is responsible for having checked
 * that this path is inside a workspace the turn was working in — see
 * produced-files.ts; this function trusts what it is handed.
 */
export async function sendTelegramDocument(cfg, file, options = {}, fetcher = fetch) {
    const { token, chatId, enabled } = settings(cfg);
    if (!enabled || !token || !chatId)
        return null;
    if (file.bytes.byteLength > TELEGRAM_DOCUMENT_LIMIT) {
        throw new Error(`${file.name} is larger than Telegram's 50 MB limit for bots`);
    }
    const form = new FormData();
    form.append("chat_id", chatId);
    // `new Uint8Array(...)` rather than the Buffer itself: a Buffer may be a
    // view on a SharedArrayBuffer, which Blob's types refuse.
    form.append("document", new Blob([new Uint8Array(file.bytes)]), file.name);
    // Telegram truncates a caption at 1024 characters and rejects nothing, so
    // trimming here keeps the visible text the one we chose.
    if (options.caption)
        form.append("caption", options.caption.slice(0, 1_024));
    if (options.replyTo) {
        form.append("reply_to_message_id", String(options.replyTo));
        form.append("allow_sending_without_reply", "true");
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);
    timer.unref?.();
    try {
        const response = await fetcher(`${TELEGRAM_API}/bot${token}/sendDocument`, {
            method: "POST",
            body: form,
            signal: controller.signal,
        });
        const payload = (await response.json().catch(() => ({})));
        if (!response.ok || payload.ok !== true) {
            throw new Error(payload.description?.slice(0, 240) || `Telegram sendDocument failed with HTTP ${response.status}`);
        }
        return typeof payload.result?.message_id === "number" ? payload.result.message_id : null;
    }
    finally {
        clearTimeout(timer);
    }
}
