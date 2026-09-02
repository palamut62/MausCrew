import { useState } from "react";
import { X } from "@phosphor-icons/react";

import { api, useStore, type Bot } from "@/state/store";
import type { DeepLinkBot } from "@/lib/deep-link";

/** Shown when a mauscrew://bot/add link fires. The fields are reviewable and
 * editable before creation — a link can be crafted by anyone, so this never
 * creates a bot silently the way an in-app "New bot" click does. */
export function ImportBotDialog({ bot, onClose }: { bot: DeepLinkBot; onClose: () => void }) {
  const { dispatch } = useStore();
  const [name, setName] = useState(bot.name);
  const [title, setTitle] = useState(bot.title);
  const [description, setDescription] = useState(bot.description);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    let createdId: string | null = null;
    try {
      const created = await api("/api/bots", { method: "POST" });
      createdId = created.bot.id;
      const patched = await api(`/api/bots/${created.bot.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: name.trim(), title: title.trim(), description: description.trim() }),
      });
      dispatch({ type: "botAdded", bot: { ...created.bot, ...patched.bot, messages: [] } as Bot });
      onClose();
    } catch (cause) {
      if (createdId) await api(`/api/bots/${createdId}`, { method: "DELETE" }).catch(() => {});
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-5" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Add bot from link" className="w-full max-w-[480px] rounded-xl border border-hairline bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[16px] font-semibold text-ink">Add this bot?</div>
            <div className="mt-0.5 text-[11.5px] text-ink-secondary">A link outside MausCrew wants to add a bot. Review it before adding.</div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-ink-secondary hover:bg-raised hover:text-ink">
            <X size={16} />
          </button>
        </div>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-ink-secondary">Name</span>
            <input autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={64} className="w-full rounded-lg border border-hairline bg-raised/60 px-3 py-2 text-[13px] text-ink focus:outline-none" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-ink-secondary">Role</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} className="w-full rounded-lg border border-hairline bg-raised/60 px-3 py-2 text-[13px] text-ink focus:outline-none" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-ink-secondary">Instructions</span>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} maxLength={4000} className="w-full resize-y rounded-lg border border-hairline bg-raised/60 px-3 py-2 text-[12px] text-ink focus:outline-none" />
          </label>
        </div>
        {error && <div className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-[12px] text-danger">{error}</div>}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-hairline px-3 py-2 text-[12px] font-medium text-ink-secondary hover:bg-raised hover:text-ink">
            Cancel
          </button>
          <button disabled={!name.trim() || busy} onClick={add} className="rounded-lg bg-accent px-3 py-2 text-[12px] font-semibold text-app hover:brightness-110 disabled:opacity-40">
            {busy ? "Adding…" : "Add bot"}
          </button>
        </div>
      </div>
    </div>
  );
}
