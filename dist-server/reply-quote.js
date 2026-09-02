/** The longest quote worth carrying. Past this it stops being a pointer and
 * starts being a second copy of the message. */
const EXCERPT_LIMIT = 280;
/**
 * The quote for `replyToId`, or undefined when there is nothing to quote.
 *
 * `messages` is the target thread only. A message id from elsewhere therefore
 * resolves to nothing rather than pulling another conversation's text into
 * this one, which is the whole reason resolution happens on the server.
 */
export function buildReplyQuote(messages, replyToId) {
    if (!replyToId)
        return undefined;
    const target = messages.find((message) => message.id === replyToId);
    const text = target?.text?.trim();
    if (!target || !text)
        return undefined;
    return { id: target.id, role: target.role, excerpt: text.replace(/\s+/g, " ").slice(0, EXCERPT_LIMIT) };
}
/** What the model sees ahead of the user's own words. */
export function replyQuotePrefix(quote) {
    if (!quote)
        return "";
    const whose = quote.role === "user" ? "their own earlier message" : "your earlier message";
    return `[Replying to ${whose}: "${quote.excerpt}"]\n\n`;
}
