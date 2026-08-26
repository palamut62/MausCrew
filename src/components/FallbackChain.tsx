// The order engines are tried in when one runs out.
//
// Every engine here is a subscription or a balance, and they all run out at
// some point — usually mid-task, which is when it costs the most. This is the
// list the app walks when that happens: the bot's own engine first, then these
// in order, replaying the conversation so far so the next one picks up where
// the last one stopped.
import { useState } from "react";
import { ArrowDown, ArrowUp, X } from "@phosphor-icons/react";
import { Spin } from "./Spin";
import { api, useStore } from "@/state/store";
import { cn } from "@/lib/cn";

export function FallbackChain() {
  const { state, dispatch } = useStore();
  const instances = state.instances ?? [];
  const saved = state.config?.fallbackChain ?? [];
  const [draft, setDraft] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const chain = draft ?? saved;

  const label = (id: string) => instances.find((i) => i.instanceId === id)?.displayName ?? id;
  const unused = instances.filter((i) => !chain.includes(i.instanceId));

  const move = (index: number, by: number) => {
    const next = [...chain];
    const target = index + by;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    setDraft(next);
  };

  const save = async (next: string[]) => {
    setSaving(true);
    try {
      await api("/api/config", { method: "PATCH", body: JSON.stringify({ fallbackChain: next }) });
      // Re-read rather than patch locally: the server drops entries for
      // engines that no longer exist, so what it stored may not be what was
      // sent, and showing the sent version would be a quiet lie.
      const config = (await api("/api/config")) as typeof state.config;
      if (config) dispatch({ type: "configStatus", config });
      setDraft(null);
    } catch (error) {
      dispatch({ type: "error", message: error instanceof Error ? error.message : String(error) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-hairline bg-inset p-3.5">
      <div className="text-[13px] font-medium text-ink">When an engine runs out</div>
      <p className="mt-1 text-[12px] leading-[1.5] text-ink-secondary">
        A turn that dies on a usage limit, a rate limit, or an empty balance carries on down this
        list instead of stopping. The conversation so far is replayed to whichever engine picks it
        up, so the bot continues rather than starting over. Only limits move a turn — a real
        failure stays where it happened.
      </p>

      {chain.length === 0 ? (
        <p className="mt-3 text-[12px] text-ink-secondary">
          Nothing listed, so a turn that hits a limit just stops.
        </p>
      ) : (
        <ol className="mt-3 space-y-1.5">
          {chain.map((id: string, index: number) => (
            <li
              key={id}
              className="flex items-center gap-2 rounded-lg border border-hairline bg-panel px-2.5 py-2"
            >
              <span className="w-4 shrink-0 text-[11.5px] text-ink-secondary">{index + 1}</span>
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{label(id)}</span>
              <button
                type="button"
                aria-label={`Move ${label(id)} earlier`}
                onClick={() => move(index, -1)}
                disabled={index === 0}
                className="rounded p-1 text-ink-secondary hover:text-ink disabled:opacity-30"
              >
                <ArrowUp size={13} weight="bold" />
              </button>
              <button
                type="button"
                aria-label={`Move ${label(id)} later`}
                onClick={() => move(index, 1)}
                disabled={index === chain.length - 1}
                className="rounded p-1 text-ink-secondary hover:text-ink disabled:opacity-30"
              >
                <ArrowDown size={13} weight="bold" />
              </button>
              <button
                type="button"
                aria-label={`Remove ${label(id)}`}
                onClick={() => setDraft(chain.filter((entry: string) => entry !== id))}
                className="rounded p-1 text-ink-secondary hover:text-ink"
              >
                <X size={13} weight="bold" />
              </button>
            </li>
          ))}
        </ol>
      )}

      {unused.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {unused.map((instance) => (
            <button
              key={instance.instanceId}
              type="button"
              onClick={() => setDraft([...chain, instance.instanceId])}
              className="rounded-lg border border-dashed border-hairline px-2.5 py-1.5 text-[11.5px] text-ink-secondary hover:border-accent/50 hover:text-ink"
            >
              + {instance.displayName}
            </button>
          ))}
        </div>
      )}

      {draft !== null && (
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => void save(draft)}
            disabled={saving}
            className={cn(
              "flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12px] font-medium text-white",
              saving && "opacity-60",
            )}
          >
            {saving && <Spin size={12} weight="fill" />}
            Save order
          </button>
          <button
            type="button"
            onClick={() => setDraft(null)}
            className="text-[12px] text-ink-secondary hover:text-ink"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
