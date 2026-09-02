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
function telegramHeader(notification) {
    const dot = COLOR_DOT[notification.botColor ?? ""] ?? "🤖";
    const profile = [notification.botName, notification.botTitle].filter(Boolean).join(" · ");
    const status = notification.kind === "approval"
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
export function telegramNotificationTexts(notification) {
    const header = telegramHeader(notification);
    const report = notification.detail.trim() || notification.body.trim();
    const chunks = [];
    let remaining = report || notification.body;
    let index = 1;
    do {
        const prefix = index === 1 ? `${header}\n\n` : `${header}\nDevamı (${index})\n\n`;
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
