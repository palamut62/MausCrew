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

import { estimateTokens, messageChars, type EstimatableMessage } from "./token-estimate.ts";

/** Below this a thread costs less than the digest would; leave it alone. */
export const FOLD_THRESHOLD_TOKENS = 12_000;
/** Messages that always stay verbatim, however long the thread gets. */
export const KEEP_RECENT = 24;

export interface PartitionInput<T extends EstimatableMessage> {
  readonly messages: readonly T[];
  readonly keepRecent?: number;
  readonly thresholdTokens?: number;
}

export interface Partition<T> {
  /** Older messages, to be replaced by a digest. Empty when nothing folds. */
  readonly fold: readonly T[];
  /** The tail that still goes to the model verbatim. */
  readonly keep: readonly T[];
  readonly foldedTokens: number;
  readonly keptTokens: number;
}

/** True when a message can open the kept tail without reading as a fragment. */
function opensCleanly(message: { role?: string; kind?: string }): boolean {
  return message.role === "user" && message.kind === "text";
}

export function partitionThread<T extends EstimatableMessage & { role?: string }>(
  input: PartitionInput<T>,
): Partition<T> {
  const { messages } = input;
  const keepRecent = input.keepRecent ?? KEEP_RECENT;
  const threshold = input.thresholdTokens ?? FOLD_THRESHOLD_TOKENS;

  const nothingToFold: Partition<T> = {
    fold: [],
    keep: messages,
    foldedTokens: 0,
    keptTokens: estimateTokens(messages),
  };
  if (messages.length <= keepRecent) return nothingToFold;
  if (estimateTokens(messages) < threshold) return nothingToFold;

  // Walk the boundary backwards to the first message that can open a tail. A
  // tail starting on a bot reply, or on half a tool exchange, is exactly the
  // context that makes a model re-answer something already settled.
  let boundary = messages.length - keepRecent;
  while (boundary > 0 && !opensCleanly(messages[boundary])) boundary -= 1;
  if (boundary === 0) return nothingToFold; // no clean seam: keep it whole

  const fold = messages.slice(0, boundary);
  const keep = messages.slice(boundary);
  return {
    fold,
    keep,
    foldedTokens: estimateTokens(fold),
    keptTokens: estimateTokens(keep),
  };
}

export interface TruncateInput<T extends EstimatableMessage> {
  readonly messages: readonly T[];
  readonly maxChars: number;
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
export function truncateFairly<T extends EstimatableMessage>(
  input: TruncateInput<T>,
): { readonly kept: readonly { message: T; text: string }[]; readonly truncated: number } {
  const { messages, maxChars } = input;
  if (messages.length === 0) return { kept: [], truncated: 0 };

  let remaining = maxChars;
  let unallocated = messages.length;
  const kept: { message: T; text: string }[] = [];
  let truncated = 0;

  // Smallest first, so the shares released by short messages are still
  // available when the long ones are reached.
  const order = [...messages].sort((a, b) => messageChars(a) - messageChars(b));
  const budgets = new Map<T, number>();
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

// A message-count limit is not a size limit: forty replies can contain whole
// files. Claude cannot compact this replay itself because it is one user turn.
export const MAX_INLINE_HISTORY_CHARS = 60_000;

export function inlineHistory(messages: readonly { role: string; text: string }[]): string {
  const render = (role: string, text: string) => `${role === "user" ? "User" : "Assistant"}: ${text}`;
  const full = messages.map((m) => render(m.role, m.text)).join("\n");
  if (full.length <= MAX_INLINE_HISTORY_CHARS) return full;

  const notice = "[Earlier messages are excerpted to fit context. Full messages remain in MausCrew. Do not assume omitted details; ask for them if needed.]\n";
  const marker = "\n[... excerpt omitted ...]\n";
  // Reserve role labels, separators, and truncation markers before allocating.
  const overhead = messages.reduce((n, m) => n + render(m.role, "").length + 1 + marker.length, 0);
  const { kept } = truncateFairly({ messages, maxChars: Math.max(0, MAX_INLINE_HISTORY_CHARS - notice.length - overhead) });
  return notice + kept.map(({ message, text }) => {
    if (text === message.text) return render(message.role, text);
    const budget = Math.max(0, text.length - 1);
    const head = Math.ceil(budget / 2);
    const tail = budget - head;
    return render(message.role, message.text.slice(0, head) + marker + (tail ? message.text.slice(-tail) : ""));
  }).join("\n");
}
