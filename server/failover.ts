// Carrying on when an engine runs out.
//
// Every engine here is somebody's subscription or somebody's credit, and they
// all run out: Claude has weekly caps, Codex has its own, a gateway account
// hits zero balance, an API key gets rate-limited. Today that ends the turn
// with a red error and the work stops, even though the same bot could finish
// on a different engine seconds later.
//
// Two things make this safe to do automatically.
//
// The first is telling "this engine is out" apart from "this task failed".
// Retrying a real failure on another engine just burns a second budget to get
// the same answer, so the classifier below is deliberately narrow: only
// exhaustion, rate limits and billing move a turn, and anything ambiguous
// stays put.
//
// The second is that the next engine has never seen the conversation. Its
// session id means nothing to a different CLI, so a handover must replay the
// transcript rather than resume a cursor — the same path this codebase already
// takes after a rewind, for the same reason.

export type FailoverReason = "exhausted" | "rate-limited" | "billing";

export interface FailoverVerdict {
  readonly move: boolean;
  readonly reason?: FailoverReason;
  /** What the user is told, in the transcript, when a handover happens. */
  readonly summary?: string;
}

/**
 * Signals that mean the engine is unavailable rather than the task impossible.
 *
 * Matched against the provider's own words, which differ per CLI and change
 * between versions, so this errs towards missing a case rather than inventing
 * one: a missed handover costs one visible error, a wrong handover silently
 * spends a second subscription.
 */
const SIGNALS: ReadonlyArray<{ reason: FailoverReason; pattern: RegExp }> = [
  {
    reason: "exhausted",
    pattern:
      /\b(usage limit reached|weekly limit|monthly limit|quota exceeded|out of (?:usage|credits?)|no capacity remaining|plan limit)\b/i,
  },
  {
    reason: "rate-limited",
    pattern: /\b(rate[ _-]?limit(?:ed|s)?|too many requests|429|overloaded_error|server is overloaded)\b/i,
  },
  {
    reason: "billing",
    pattern:
      /\b(insufficient (?:credit|balance|funds)|payment required|402|billing (?:issue|problem)|account has no credit)\b/i,
  },
];

/** Failures that look like limits but are not, and must never move a turn. */
const NOT_A_LIMIT =
  /\b(authentication|unauthorized|invalid api key|permission denied|not found|no such model|unknown model|command not found|ENOENT)\b/i;

export function classifyFailure(message: string | null | undefined): FailoverVerdict {
  const text = (message ?? "").trim();
  if (!text) return { move: false };
  // An auth failure often carries a 401 alongside words like "limit"; the key
  // being wrong is not something another engine can fix.
  if (NOT_A_LIMIT.test(text)) return { move: false };
  for (const { reason, pattern } of SIGNALS) {
    if (pattern.test(text)) {
      return { move: true, reason, summary: summaryFor(reason) };
    }
  }
  return { move: false };
}

function summaryFor(reason: FailoverReason): string {
  if (reason === "exhausted") return "ran out of allowance";
  if (reason === "billing") return "has no credit left";
  return "is rate-limited";
}

export interface FailoverChainInput {
  /** Ordered instance ids to try, first is the bot's own choice. */
  readonly chain: readonly string[];
  /** Instances that exist and are usable right now. */
  readonly available: ReadonlySet<string>;
  /** Already attempted this turn, in order. */
  readonly tried: readonly string[];
}

/**
 * The next engine to try, or null when there is nowhere left to go.
 *
 * Order is the user's: the chain is a preference list, not a load balancer.
 * An engine already tried this turn is never offered again, so a turn can
 * never loop between two exhausted engines.
 */
export function nextEngine(input: FailoverChainInput): string | null {
  const tried = new Set(input.tried);
  for (const id of input.chain) {
    if (tried.has(id)) continue;
    if (!input.available.has(id)) continue;
    return id;
  }
  return null;
}

/** What the transcript says when a turn changes hands. */
export function handoverNotice(
  fromLabel: string,
  toLabel: string,
  reason: FailoverReason | undefined,
): string {
  const why = reason ? summaryFor(reason) : "is unavailable";
  return `${fromLabel} ${why} — continuing on ${toLabel} with this conversation's history.`;
}

/** What the transcript says when there is nothing left to fall back to. */
export function exhaustedNotice(triedLabels: readonly string[]): string {
  if (triedLabels.length <= 1) return "";
  return `Every engine in the fallback list is unavailable right now (tried ${triedLabels.join(", ")}).`;
}
