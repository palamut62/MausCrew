// Turning a finished turn into something the bot still knows tomorrow.
//
// The vault on this machine does this with a SessionEnd hook and a harvest
// script: when a session ends, the transcript is folded into a journal entry,
// and the journal is later distilled into the file that gets auto-loaded. The
// same two steps apply here, with one difference — the summary is written by
// the bot's own engine rather than a separate service, so a Claude bot is
// summarised by Claude and a DeepSeek bot by DeepSeek. No extra credential, no
// extra bill, and the model that has to read the summary is the one that wrote
// it.
//
// Both steps are deliberately off the turn's critical path. A user waiting for
// a reply must never wait on bookkeeping, so a harvest that fails is logged
// and dropped: the next turn will fold the same messages again.

import { buildDigestPrompt, type DigestRecord, type DigestSourceMessage } from "../summarization/digest.ts";
import { partitionThread } from "../summarization/partition.ts";
import { appendJournal, readJournal, writeProfile } from "./store.ts";

/** Below this a thread is not worth a summarisation turn. */
export const HARVEST_MIN_FOLDED = 8;
/** Journal entries that trigger a distillation pass. */
export const DISTIL_AFTER_ENTRIES = 5;

export const DISTIL_INSTRUCTIONS = `Below are dated notes from your past sessions with this user. Rewrite them as a single brief you would want to read before your next session.

Keep only what stays true: their setup, their preferences, decisions still in force, where things live, and what remains open. Merge repeats. Drop anything that was only true on the day it happened.

Rules:
- Keep exact identifiers verbatim: paths, filenames, versions, account names.
- No secrets, tokens, or passwords.
- If a later note corrects an earlier one, keep only the correction.
- Aim for under 200 words. Terse notes, not prose.
- Output only the brief. No preamble.`;

export interface HarvestPlan {
  /** Prompt to run on the bot's own engine, or null when nothing is due. */
  readonly prompt: string;
  readonly kind: "journal" | "distil";
  readonly throughMessageId?: string;
  readonly foldedCount?: number;
}

/**
 * Decide whether this thread has enough unrecorded history to be worth a
 * summarisation turn, and build the prompt if so.
 *
 * Returns null far more often than not: harvesting after every turn would
 * double the cost of using the app for a note nobody reads.
 */
export function planHarvest(
  messages: readonly DigestSourceMessage[],
  previous?: DigestRecord,
): HarvestPlan | null {
  const covered = previous?.throughMessageId;
  const startAt = covered ? messages.findIndex((m) => m.id === covered) + 1 : 0;
  // A digest naming a message that is no longer on this branch means the user
  // edited history; fold from the top rather than trusting a stale cursor.
  const fresh = covered && startAt === 0 ? messages : messages.slice(startAt);

  const { fold } = partitionThread({ messages: fresh, keepRecent: 40 });
  if (fold.length < HARVEST_MIN_FOLDED) return null;

  const prompt = buildDigestPrompt(fold, previous);
  if (!prompt) return null;
  return {
    prompt: prompt.text,
    kind: "journal",
    throughMessageId: prompt.throughMessageId,
    foldedCount: prompt.messageCount,
  };
}

/** Build the distillation prompt once a bot has enough journal to compress. */
export function planDistil(botId: string): HarvestPlan | null {
  const entries = readJournal(botId);
  if (entries.length < DISTIL_AFTER_ENTRIES) return null;
  const body = entries.map((entry) => `## ${entry.date}\n${entry.body}`).join("\n\n");
  return { prompt: `${DISTIL_INSTRUCTIONS}\n\n${body}`, kind: "distil" };
}

/** Today, as the journal names its files. */
export function journalDate(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function recordJournal(botId: string, summary: string, now: number): void {
  appendJournal(botId, journalDate(now), summary);
}

export function recordDistil(botId: string, brief: string): void {
  writeProfile(botId, brief);
}

/**
 * A journal entry written without calling a model.
 *
 * The vault on this machine harvests the same way: its auto entries are the
 * session's own opening request plus a project tag, and a person enriches them
 * later. Nothing here calls an engine, which matters because this codebase
 * holds that a turn the user pays for must be visible — a silent summarisation
 * turn after every conversation would be exactly the invisible cost that rule
 * exists to prevent. Distillation, which does use the engine, stays an
 * explicit and visible act.
 */
export function deterministicEntry(
  messages: readonly DigestSourceMessage[],
  opts: { readonly taskTitle?: string } = {},
): string {
  const asked = messages.find((m) => m.role === "user" && (m.text ?? "").trim());
  const goal = (asked?.text ?? opts.taskTitle ?? "").replace(/\s+/g, " ").trim().slice(0, 160);
  if (!goal) return "";

  const tools = new Map<string, { runs: number; failed: number }>();
  for (const message of messages) {
    const name = message.tool?.name;
    if (!name || name.startsWith("error:")) continue;
    const head = name.split(":")[0]!.slice(0, 40);
    const seen = tools.get(head) ?? { runs: 0, failed: 0 };
    seen.runs += 1;
    if (message.tool?.ok === false) seen.failed += 1;
    tools.set(head, seen);
  }
  const used = [...tools.entries()]
    .sort((a, b) => b[1].runs - a[1].runs)
    .slice(0, 6)
    .map(([name, s]) => (s.failed ? `${name} (${s.failed} failed)` : name));

  const lines = [`## ${opts.taskTitle?.trim() || goal}`, `- Asked: ${goal}`];
  if (used.length) lines.push(`- Used: ${used.join(", ")}`);
  lines.push(`- Messages: ${messages.length}`);
  return lines.join("\n");
}
