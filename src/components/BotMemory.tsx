// What this bot still knows from earlier sessions, and the button that
// compresses it.
//
// Distillation runs on the bot's own engine, so it costs a turn and appears in
// the conversation. That is deliberate: this app holds that a turn the user
// pays for must be visible, and a memory that quietly rewrote itself in the
// background would be exactly the invisible cost that rule exists to prevent.
import { useCallback, useEffect, useState } from "react";
import { Brain } from "@phosphor-icons/react";
import { Spin } from "./Spin";
import { api, useStore, type Bot } from "@/state/store";

interface MemoryState {
  profile: string;
  journalDays: number;
  canDistil: boolean;
  injected: number;
}

export function BotMemory({ bot }: { bot: Bot }) {
  const { dispatch } = useStore();
  const [memory, setMemory] = useState<MemoryState | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setMemory((await api(`/api/bots/${bot.id}/memory`)) as MemoryState);
    } catch {
      // Memory is an extra; failing to read it should not break settings.
    }
  }, [bot.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const distil = async () => {
    setBusy(true);
    try {
      await api(`/api/bots/${bot.id}/memory`, {
        method: "POST",
        body: JSON.stringify({ action: "distil" }),
      });
      // The brief arrives as a turn; re-read once it has had a chance to land.
      setTimeout(() => void load(), 4000);
    } catch (error) {
      dispatch({ type: "error", message: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  };

  if (!memory) return null;
  const hasAnything = memory.profile.trim() || memory.journalDays > 0;

  return (
    <div className="rounded-xl border border-hairline bg-inset p-3.5">
      <div className="flex items-center gap-2 text-[13px] font-medium text-ink">
        <Brain size={15} weight="bold" />
        What {bot.name} remembers
      </div>

      {!hasAnything ? (
        <p className="mt-1.5 text-[12px] leading-[1.5] text-ink-secondary">
          Nothing yet. A note is filed after each day this bot works, and once a few have built up
          they can be compressed into a brief it reads before every session.
        </p>
      ) : (
        <>
          <p className="mt-1.5 text-[12px] leading-[1.5] text-ink-secondary">
            {memory.journalDays} day{memory.journalDays === 1 ? "" : "s"} of notes
            {memory.injected > 0 && ` · ${memory.injected} characters carried into each turn`}
          </p>

          {memory.profile.trim() && (
            <pre className="mt-2.5 max-h-48 overflow-y-auto rounded-lg border border-hairline bg-panel px-3 py-2.5 text-[12px] leading-[1.55] whitespace-pre-wrap text-ink-secondary">
              {memory.profile}
            </pre>
          )}

          <button
            type="button"
            onClick={() => void distil()}
            disabled={busy || !memory.canDistil || bot.busy}
            className="mt-2.5 flex items-center gap-2 rounded-lg border border-accent/25 bg-accent/10 px-3 py-2 text-[12px] font-medium text-accent hover:bg-accent/15 disabled:opacity-50"
          >
            {busy ? <Spin size={13} weight="fill" /> : <Brain size={14} weight="bold" />}
            Distil the notes into a brief
          </button>
          <p className="mt-1.5 text-[11.5px] leading-[1.5] text-ink-secondary">
            {memory.canDistil
              ? "Runs as a turn on this bot's own engine, so you will see it happen and it costs what a turn costs."
              : "Needs a few more days of notes before there is anything worth compressing."}
          </p>
        </>
      )}
    </div>
  );
}
