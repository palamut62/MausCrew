// Replying to one earlier message.
//
// Two things have to be true at once, and they pull in opposite directions.
// The transcript needs a quote that keeps saying what it said — the original
// can still be edited into another version afterwards — so the excerpt is
// copied at send time rather than looked up at render time. And the model
// needs to know which message is being answered, so the same quote is put in
// front of the turn text instead of into the system prompt, where it would
// not survive being replayed on another engine.
export interface ReplyQuote {
  id: string;
  role: "bot" | "user";
  excerpt: string;
}

interface QuotableMessage {
  id: string;
  role: "bot" | "user";
  text?: string;
}

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
export function buildReplyQuote(messages: readonly QuotableMessage[], replyToId: string | undefined): ReplyQuote | undefined {
  if (!replyToId) return undefined;
  const target = messages.find((message) => message.id === replyToId);
  const text = target?.text?.trim();
  if (!target || !text) return undefined;
  return { id: target.id, role: target.role, excerpt: text.replace(/\s+/g, " ").slice(0, EXCERPT_LIMIT) };
}

/** What the model sees ahead of the user's own words. */
export function replyQuotePrefix(quote: ReplyQuote | undefined): string {
  if (!quote) return "";
  const whose = quote.role === "user" ? "their own earlier message" : "your earlier message";
  return `[Replying to ${whose}: "${quote.excerpt}"]\n\n`;
}
