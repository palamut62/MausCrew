// Turning the folded part of a thread into something a model can act on.
//
// The summary is produced by the bot's OWN engine — Claude summarises for a
// Claude bot, DeepSeek for a DeepSeek bot. That is the whole adaptation: Grok
// Bot summarises through Cursor's inference service, which MausCrew does not
// have and does not want. Reusing the bot's engine means no extra credential,
// no extra bill, and a summary written by the same model that has to read it.
import { truncateFairly } from "./partition.js";
/** Whatever the engine is, the summarisation prompt has to fit in one turn. */
export const MAX_DIGEST_PROMPT_CHARS = 240_000;
/** `"User: "` / `"Bot: "` plus the newline each rendered line costs. */
const LINE_OVERHEAD_CHARS = 8;
export const DIGEST_INSTRUCTIONS = `You are compacting the earlier part of a conversation so it can be dropped from context without losing what matters.

Write a brief for your future self, not a description of a chat. Prefer, in this order:
1. Decisions that were made and are still in force, with the reason.
2. Facts established about the user's setup, files, accounts, or preferences.
3. Work completed, and where its output lives.
4. Anything still open, blocked, or promised.

Rules:
- Keep exact identifiers verbatim: paths, filenames, branch names, IDs, versions, numbers.
- Do not include secrets, tokens, or passwords even if they appear above.
- Drop pleasantries, retries, and dead ends that changed nothing.
- If an earlier statement was corrected later, record only the correction.
- Write plain prose or short bullets. No preamble, no "in this conversation".`;
/** Roll a previous digest forward instead of re-summarising from scratch. */
function priorSection(previous) {
    if (!previous?.text.trim())
        return "";
    return `Summary of everything before this point, carried forward — treat it as established:\n${previous.text.trim()}\n\n`;
}
/**
 * Build the turn text that asks an engine for the digest. Returns null when
 * there is nothing worth summarising, so callers can skip the turn entirely
 * rather than spend one on an empty prompt.
 */
export function buildDigestPrompt(fold, previous) {
    const usable = fold.filter((m) => (m.text ?? "").trim() || m.tool?.name);
    if (usable.length === 0)
        return null;
    const header = `${DIGEST_INSTRUCTIONS}\n\n${priorSection(previous)}Conversation to compact:\n\n`;
    // Every kept message is rendered as `Bot: <text>` on its own line, so the
    // budget pays for that framing too. Charging only the text overran the
    // ceiling by a few thousand characters on a long thread — a small relative
    // overrun, and exactly the kind an engine rejects the whole turn for.
    const framing = usable.length * LINE_OVERHEAD_CHARS;
    const budget = Math.max(0, MAX_DIGEST_PROMPT_CHARS - header.length - framing);
    const { kept, truncated } = truncateFairly({ messages: usable, maxChars: budget });
    const body = kept
        .map(({ message, text }) => {
        const who = message.role === "user" ? "User" : "Bot";
        if (message.tool?.name && !text.trim())
            return `${who} [ran ${message.tool.name}]`;
        return `${who}: ${text}`;
    })
        .join("\n");
    return {
        text: `${header}${body}`,
        throughMessageId: usable[usable.length - 1].id,
        messageCount: usable.length,
        truncatedMessages: truncated,
    };
}
/** How the digest appears to the bot on every later turn. */
export function digestSystemBlock(digest) {
    if (!digest?.text.trim())
        return "";
    return ("\n\nEarlier in this conversation (summarised, and no longer in the messages below):\n"
        + digest.text.trim()
        + "\nTreat this as things you already know. Do not re-ask what it answers, and do not claim you cannot remember it.");
}
