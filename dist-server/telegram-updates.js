// Deciding what an incoming Telegram update is, and whether it is allowed.
//
// Kept separate from the poller and free of I/O because this is the security
// boundary: a bot token is a URL anybody who has it can post to, and the
// paired chat is the only reason a message from Telegram gets to run work on
// the user's machine. Everything here is a pure function over one update, so
// the rules can be read and tested without a network.
//
// Telegram's own model does the deduplication: `getUpdates` with an offset
// acknowledges everything below it and never sends those again, so the offset
// is the thing that must survive a restart — not a list of seen ids.
// https://core.telegram.org/bots/api#getupdates
const MAX_TEXT = 8_000;
function sameChat(chat, expected) {
    const id = chat?.id;
    if (id === undefined || id === null)
        return false;
    return String(id) === expected.trim();
}
function allowedSender(fromId, rules) {
    if (!rules.allowedUserIds?.length)
        return true;
    return fromId !== undefined && rules.allowedUserIds.includes(fromId);
}
/**
 * What to do with one update.
 *
 * Refuses rather than guesses: an update from another chat, from a bot, from
 * a user outside the allow-list, or with nothing to act on is ignored with a
 * reason the caller can log. Nothing here throws — a hostile payload must not
 * be able to stop the poller.
 */
export function classifyUpdate(update, rules) {
    const updateId = Number(update?.update_id);
    if (!Number.isFinite(updateId))
        return { kind: "ignored", updateId: 0, reason: "no update id" };
    const callback = update.callback_query;
    if (callback) {
        if (!sameChat(callback.message?.chat, rules.chatId)) {
            return { kind: "ignored", updateId, reason: "callback from another chat" };
        }
        if (!allowedSender(callback.from?.id, rules)) {
            return { kind: "ignored", updateId, reason: "callback from an unauthorized user" };
        }
        const data = String(callback.data ?? "").slice(0, 200);
        if (!callback.id || !data)
            return { kind: "ignored", updateId, reason: "callback carried no data" };
        return {
            kind: "callback",
            updateId,
            deliveryId: `tg-cb-${callback.id}`,
            callbackId: callback.id,
            data,
            ...(callback.message?.message_id ? { messageId: callback.message.message_id } : {}),
            ...(callback.from?.id ? { fromUserId: callback.from.id } : {}),
        };
    }
    const message = update.message;
    if (!message)
        return { kind: "ignored", updateId, reason: "not a message" };
    if (!sameChat(message.chat, rules.chatId))
        return { kind: "ignored", updateId, reason: "message from another chat" };
    // A bot's own posts come back as updates in a group. Acting on them is how
    // two bots talk each other into an infinite loop.
    if (message.from?.is_bot)
        return { kind: "ignored", updateId, reason: "message from a bot" };
    if (!allowedSender(message.from?.id, rules)) {
        return { kind: "ignored", updateId, reason: "message from an unauthorized user" };
    }
    const text = String(message.text ?? "").trim().slice(0, MAX_TEXT);
    if (!text)
        return { kind: "ignored", updateId, reason: "no text (attachments are not handled yet)" };
    const messageId = Number(message.message_id);
    if (!Number.isFinite(messageId))
        return { kind: "ignored", updateId, reason: "no message id" };
    return {
        kind: "message",
        updateId,
        deliveryId: `tg-${rules.chatId}-${messageId}`,
        text,
        messageId,
        ...(message.reply_to_message?.message_id ? { replyToMessageId: message.reply_to_message.message_id } : {}),
        ...(message.from?.id ? { fromUserId: message.from.id } : {}),
        at: Number(message.date) ? Number(message.date) * 1000 : Date.now(),
    };
}
/** The offset to acknowledge after a batch: one past the highest id seen,
 * including the ones we ignored — an update we refuse must not be redelivered
 * forever. */
export function nextOffset(updates, current) {
    let highest = current - 1;
    for (const update of updates) {
        const id = Number(update?.update_id);
        if (Number.isFinite(id) && id > highest)
            highest = id;
    }
    return highest + 1;
}
