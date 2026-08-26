// Persistent memory: what a bot still knows after its session is gone.
//
// Modelled on the vault this machine already runs for Claude Code and Codex,
// because that design got the two hard parts right.
//
// The first is that generated and authored memory must never share a file. The
// vault keeps `active.md` machine-written and its journal human-written, and
// says so in the file's own first line. Mixing them means a distillation pass
// silently eats something a person wrote, which is the one failure that makes
// people stop trusting a memory system.
//
// The second is a token budget as a hard constraint rather than an aspiration.
// Memory is prepended to every single turn, so unbounded memory is unbounded
// cost on every request, forever, and the damage is invisible — the bot just
// gets slowly worse and more expensive. The vault targets under 250 lines of
// auto-load. Here the cap is enforced: past it, injection is truncated and the
// bot is told its memory needs distilling, because stopping visibly beats
// bloating quietly.
//
//   memory/
//     shared.md              written by the user, read by every bot, never
//                            touched by a model
//     bots/<botId>/
//       profile.md           distilled from this bot's journal; regenerating
//                            it overwrites, so nothing hand-written lives here
//       journal/<date>.md    one entry per session, appended as turns settle

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { DATA_DIR } from "../config.ts";

export const MEMORY_DIR = join(DATA_DIR, "memory");
export const SHARED_PATH = join(MEMORY_DIR, "shared.md");

/**
 * Ceiling for everything injected into a turn, in characters.
 *
 * Roughly a thousand tokens: enough for a page of established fact, small
 * enough that it never competes with the conversation for room.
 */
export const MEMORY_BUDGET_CHARS = 4_000;
/** Journal kept for distillation. Older entries are compiled, then dropped. */
export const JOURNAL_KEEP_DAYS = 30;

const GENERATED_HEADER =
  "<!-- Written by MausCrew from this bot's journal. Edits here are lost on the next distillation; put anything you want kept in memory/shared.md. -->";

function botDir(botId: string) {
  return join(MEMORY_DIR, "bots", botId.replace(/[^\w-]/g, ""));
}

function readIfPresent(path: string): string {
  try {
    return existsSync(path) ? readFileSync(path, "utf8") : "";
  } catch {
    return "";
  }
}

function writeAtomicish(path: string, body: string) {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, body, "utf8");
}

/**
 * An external vault to read alongside our own shared notes.
 *
 * This machine already runs one for Claude Code and Codex, and a bot that
 * knows less about the user than the terminal next to it is a worse teammate
 * for no reason. Reading is one-way on purpose: the vault is the user's master
 * rule set, and a bot writing into it would silently change how their other
 * tools behave. Bots write only under our own memory directory.
 */
export function externalVaultPath(): string | null {
  const configured = process.env.MAUSCREW_MEMORY_VAULT?.trim();
  if (configured) return configured;
  // Fall back to the conventional vault location, but only if it is really
  // there — an absent file must cost nothing and say nothing.
  const conventional = join(homedir(), "Documents", "brain", "active.md");
  return existsSync(conventional) ? conventional : null;
}

/** Budget for the borrowed vault, so it cannot crowd out the bot's own notes. */
export const VAULT_BUDGET_CHARS = 1_500;

function readVault(): string {
  const path = externalVaultPath();
  if (!path) return "";
  const body = readIfPresent(path).trim();
  if (!body) return "";
  // Generated vault files open with a "do not edit" banner that means nothing
  // to a bot and costs tokens on every turn.
  const withoutBanner = body.replace(/^<!--[\s\S]*?-->\s*/, "").trim();
  return withoutBanner.length > VAULT_BUDGET_CHARS
    ? `${withoutBanner.slice(0, VAULT_BUDGET_CHARS)}…`
    : withoutBanner;
}

export function readShared(): string {
  const own = readIfPresent(SHARED_PATH).trim();
  const vault = readVault();
  if (own && vault) return `${vault}\n\n${own}`;
  return own || vault;
}

export function readProfile(botId: string): string {
  return readIfPresent(join(botDir(botId), "profile.md"))
    .replace(GENERATED_HEADER, "")
    .trim();
}

export function writeProfile(botId: string, body: string): void {
  writeAtomicish(join(botDir(botId), "profile.md"), `${GENERATED_HEADER}\n\n${body.trim()}\n`);
}

export interface JournalEntry {
  readonly date: string;
  readonly body: string;
}

/** Append a session summary. One file per day, matching the vault's layout. */
export function appendJournal(botId: string, date: string, entry: string): void {
  const trimmed = entry.trim();
  if (!trimmed) return;
  const path = join(botDir(botId), "journal", `${date}.md`);
  const existing = readIfPresent(path);
  const body = existing ? `${existing.trimEnd()}\n\n${trimmed}\n` : `# ${date}\n\n${trimmed}\n`;
  writeAtomicish(path, body);
}

export function readJournal(botId: string, limitDays = JOURNAL_KEEP_DAYS): JournalEntry[] {
  const dir = join(botDir(botId), "journal");
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir)
      .filter((name) => name.endsWith(".md"))
      .sort()
      .slice(-limitDays)
      .map((name) => ({ date: name.slice(0, -3), body: readIfPresent(join(dir, name)).trim() }))
      .filter((entry) => entry.body);
  } catch {
    return [];
  }
}

export interface MemoryBlock {
  readonly text: string;
  /** True when the budget clipped something, so the bot can say so. */
  readonly truncated: boolean;
  readonly chars: number;
}

/**
 * What the bot is told it already knows, at the top of every turn.
 *
 * Shared facts come first and are never dropped: they are the user's own
 * words, and a bot that forgets the user's setup is worse than one that
 * forgets its own notes.
 */
export function memoryBlock(botId: string): MemoryBlock {
  const shared = readShared();
  const profile = readProfile(botId);
  if (!shared && !profile) return { text: "", truncated: false, chars: 0 };

  const sections: string[] = [];
  if (shared) sections.push(`About the user and this machine:\n${shared}`);

  let truncated = false;
  if (profile) {
    const spent = sections.join("\n\n").length;
    const room = MEMORY_BUDGET_CHARS - spent - 200;
    if (room <= 0) {
      truncated = true;
    } else if (profile.length > room) {
      truncated = true;
      sections.push(`What you have learned working with them:\n${profile.slice(0, room)}…`);
    } else {
      sections.push(`What you have learned working with them:\n${profile}`);
    }
  }

  const body = sections.join("\n\n");
  const note = truncated
    ? "\n\n(Your notes are longer than fits in a turn and were cut short. Say so if it matters; they need distilling.)"
    : "";
  const text = `\n\nFrom memory — things already established, not a transcript:\n${body}${note}\nTreat this as known. Do not re-ask what it answers.`;
  return { text, truncated, chars: body.length };
}
