// What the app shows before there is anyone to talk to.
//
// This used to be a spinner over the words "No bots yet" — a turning spinner
// promising something was on its way when nothing was loading, and no way
// forward from the screen except to notice the small + in the sidebar. An
// empty app is not a loading app.
//
// A starter is a name, a sentence, and a face. Picking one creates the bot and
// opens it, which is the whole first run: the app is worth something once one
// teammate exists, and the fastest way to that is to offer a few.
import { useState } from "react";
import { Plus } from "@phosphor-icons/react";
import { MausAvatar } from "./Avatar";
import { Spin } from "./Spin";
import { api, useStore, type Bot } from "@/state/store";
import type { MausColor } from "@/lib/colors";

interface Starter {
  name: string;
  title: string;
  description: string;
  color: MausColor;
  shape: string;
  /** What the card says — shorter and plainer than the bot's own brief. */
  pitch: string;
}

/** Deliberately few and deliberately different from each other: a first run
 * is a choice between kinds of teammate, not a catalogue to read. */
const STARTERS: Starter[] = [
  {
    name: "Scout",
    title: "Researcher",
    description:
      "Investigate questions across the web and the user's connected tools. Gather sources, weigh them, and answer with what you actually found — say so plainly when the evidence is thin.",
    color: "cyan",
    shape: "pebble",
    pitch: "Digs into a question and comes back with what it found",
  },
  {
    name: "Pilot",
    title: "Engineer",
    description:
      "Work in the user's codebase: read it before changing it, make the smallest change that does the job, and run the tests. Report failures with their output rather than summarising them away.",
    color: "green",
    shape: "squircle",
    pitch: "Reads your codebase, makes changes, runs the tests",
  },
  {
    name: "Ledger",
    title: "Inbox and calendar",
    description:
      "Triage mail and meetings. Summarise what arrived, draft replies in the user's voice for review, and never send anything without being asked.",
    color: "purple",
    shape: "tablet",
    pitch: "Sorts the inbox and drafts replies for you to approve",
  },
  {
    name: "Lookout",
    title: "Watcher",
    description:
      "Watch pages, feeds, and services the user cares about on a schedule. Report only genuine changes, with what changed and when — silence is the correct output for an uneventful check.",
    color: "orange",
    shape: "wedge",
    pitch: "Checks on things regularly and speaks up when they change",
  },
];

export function NoBots() {
  const { state, dispatch } = useStore();
  const [creating, setCreating] = useState<string | null>(null);

  // Still connecting is a genuinely different situation from having no bots,
  // and it is the one case where a spinner is honest.
  if (!state.connected) {
    return (
      <main className="flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-3 bg-app text-ink-secondary">
        <Spin size={20} weight="fill" />
        <div className="text-[14px]">Connecting to the bot server…</div>
        <div className="text-[12px]">
          Start it with <code className="rounded bg-raised px-1.5 py-0.5">pnpm dev:server</code>
        </div>
      </main>
    );
  }

  async function create(starter?: Starter) {
    if (creating) return;
    setCreating(starter?.name ?? "blank");
    try {
      const { bot } = (await api("/api/bots", { method: "POST" })) as { bot: Bot };
      const ready = starter
        ? ((
            await api(`/api/bots/${bot.id}`, {
              method: "PATCH",
              body: JSON.stringify({
                name: starter.name,
                title: starter.title,
                description: starter.description,
                color: starter.color,
                shape: starter.shape,
              }),
            })
          ).bot as Bot)
        : bot;
      dispatch({ type: "botAdded", bot: ready });
      dispatch({ type: "select", id: ready.id });
    } catch (error) {
      dispatch({ type: "error", message: error instanceof Error ? error.message : String(error) });
    } finally {
      setCreating(null);
    }
  }

  return (
    <main className="flex h-full min-w-0 flex-1 flex-col items-center justify-center overflow-y-auto bg-app px-6 py-10">
      <div className="w-full max-w-[560px]">
        <div className="mb-7 flex flex-col items-center text-center">
          <MausAvatar color="green" name="MausCrew" shape="blob" state="happy" size={84} />
          <h1 className="mt-4 text-[19px] font-semibold text-ink">Your crew is empty</h1>
          <p className="mt-1.5 text-[13.5px] text-ink-secondary">
            A bot is a teammate with its own model, its own memory, and its own permissions. Start
            with one of these, or begin from scratch.
          </p>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          {STARTERS.map((starter) => (
            <button
              key={starter.name}
              type="button"
              disabled={Boolean(creating)}
              onClick={() => void create(starter)}
              className="flex items-start gap-3 rounded-2xl border border-hairline bg-inset p-3.5 text-left transition-colors hover:border-accent/50 hover:bg-raised/70 disabled:opacity-50"
            >
              <MausAvatar
                color={starter.color}
                name={starter.name}
                shape={starter.shape}
                seed={starter.name}
                size={40}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[14px] font-semibold text-ink">{starter.name}</span>
                  {creating === starter.name && <Spin size={12} weight="fill" />}
                </span>
                <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-secondary">
                  {starter.pitch}
                </span>
              </span>
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={Boolean(creating)}
          onClick={() => void create()}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-hairline px-4 py-3 text-[13px] font-medium text-ink-secondary transition-colors hover:border-accent/50 hover:text-ink disabled:opacity-50"
        >
          {creating === "blank" ? <Spin size={13} weight="fill" /> : <Plus size={15} weight="bold" />}
          Start from scratch
        </button>
      </div>
    </main>
  );
}
