// Deciding what a long thread keeps and what it folds away.
//
// Before this, the turn dispatcher took `.slice(-40)` of the thread and sent
// that. Everything older vanished with no summary and no notice, so a bot that
// had been working with you for an hour would confidently contradict what it
// agreed to at the start. This module is the other half of that decision: the
// recent tail still goes verbatim, and what falls off the end becomes a digest
// instead of nothing.
//
// The shape is adapted from Grok Bot 0.18's summarization pipeline. Two things
// were kept because they are what makes a fold survivable:
//
//   * a message is never half-included — a tool result without its call reads
//     as an event with no cause;
//   * the boundary moves back to a user message, so the kept tail always opens
//     with a request rather than mid-answer.
import { estimateTokens, messageChars } from "./token-estimate.js";
/** Below this a thread costs less than the digest would; leave it alone. */
export const FOLD_THRESHOLD_TOKENS = 12_000;
/** Messages that always stay verbatim, however long the thread gets. */
export const KEEP_RECENT = 24;
/** True when a message can open the kept tail without reading as a fragment. */
function opensCleanly(message) {
    return message.role === "user" && message.kind === "text";
}
export function partitionThread(input) {
    const { messages } = input;
    const keepRecent = input.keepRecent ?? KEEP_RECENT;
    const threshold = input.thresholdTokens ?? FOLD_THRESHOLD_TOKENS;
    const nothingToFold = {
        fold: [],
        keep: messages,
        foldedTokens: 0,
        keptTokens: estimateTokens(messages),
    };
    if (messages.length <= keepRecent)
        return nothingToFold;
    if (estimateTokens(messages) < threshold)
        return nothingToFold;
    // Walk the boundary backwards to the first message that can open a tail. A
    // tail starting on a bot reply, or on half a tool exchange, is exactly the
    // context that makes a model re-answer something already settled.
    let boundary = messages.length - keepRecent;
    while (boundary > 0 && !opensCleanly(messages[boundary]))
        boundary -= 1;
    if (boundary === 0)
        return nothingToFold; // no clean seam: keep it whole
    const fold = messages.slice(0, boundary);
    const keep = messages.slice(boundary);
    return {
        fold,
        keep,
        foldedTokens: estimateTokens(fold),
        keptTokens: estimateTokens(keep),
    };
}
/**
 * Fit messages into a character budget without letting one giant message eat
 * it. Each message gets an equal share; anything under its share is kept whole
 * and its unspent budget is redistributed, so a thread of short notes plus one
 * enormous file dump keeps all the notes.
 *
 * Truncating from the tail instead — the obvious implementation — drops the
 * most recent messages, which are the ones the summary most needs.
 */
export function truncateFairly(input) {
    const { messages, maxChars } = input;
    if (messages.length === 0)
        return { kept: [], truncated: 0 };
    let remaining = maxChars;
    let unallocated = messages.length;
    const kept = [];
    let truncated = 0;
    // Smallest first, so the shares released by short messages are still
    // available when the long ones are reached.
    const order = [...messages].sort((a, b) => messageChars(a) - messageChars(b));
    const budgets = new Map();
    for (const message of order) {
        const share = Math.max(0, Math.floor(remaining / Math.max(1, unallocated)));
        const want = message.text?.length ?? 0;
        const give = Math.min(want, share);
        budgets.set(message, give);
        remaining -= give;
        unallocated -= 1;
    }
    for (const message of messages) {
        const budget = budgets.get(message) ?? 0;
        const text = message.text ?? "";
        if (text.length <= budget) {
            kept.push({ message, text });
            continue;
        }
        truncated += 1;
        kept.push({ message, text: budget > 0 ? `${text.slice(0, budget)}…` : "…" });
    }
    return { kept, truncated };
}
