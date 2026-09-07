import { useEffect, useRef, useState } from "react";
import { api, type Message } from "@/state/store";
type Page = { messages: Message[]; versions?: Message[]; hasMore: boolean; hasNewer: boolean; leaf?: string };
export function useHistory(threadId: string, live: Message[], hasMore = false) {
  const [page, setPage] = useState<(Page & { threadId: string }) | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const serial = useRef(0);
  const current = page?.threadId === threadId ? page : null;
  async function load(params: Record<string, string> = {}) {
    const request = ++serial.current;
    setBusy(true); setError("");
    try {
      const result = await api(`/api/threads/${threadId}/window?${new URLSearchParams(params)}`);
      if (request !== serial.current) return;
      setPage({ ...result, threadId });
      if (params.around) requestAnimationFrame(() => document.getElementById(`message-${params.around}`)?.scrollIntoView({ block: "center" }));
    } catch (e) { if (request === serial.current) setError(e instanceof Error ? e.message : String(e)); }
    finally { if (request === serial.current) setBusy(false); }
  }
  useEffect(() => {
    // The sender also parks the target in sessionStorage, because the thread it
    // points at may not be mounted yet. Handling it live consumes that fallback:
    // an entry nobody clears survives reloads and pins the transcript to an old
    // message every time this view mounts again.
    const jump = (event: Event) => { const target = (event as CustomEvent).detail; if (target.threadId !== threadId) return; sessionStorage.removeItem("mauscrew:jump-message"); void load({ around: target.messageId }); };
    window.addEventListener("mauscrew:jump-message", jump);
    const pending = sessionStorage.getItem("mauscrew:jump-message");
    if (pending) { try { const target = JSON.parse(pending); if (target.threadId === threadId) { sessionStorage.removeItem("mauscrew:jump-message"); queueMicrotask(() => void load({ around: target.messageId })); } } catch { /* stale session value */ } }
    return () => { serial.current++; window.removeEventListener("mauscrew:jump-message", jump); };
    // Each task gets an independent request generation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);
  const messages = current?.messages ?? live.slice(-50);
  const older = current?.hasMore ?? (hasMore || live.length > 50);
  return { messages, versions: current?.versions, archived: Boolean(current), controls: <div className="flex flex-wrap items-center gap-2 py-2 text-xs text-ink-secondary">{older && <button disabled={busy} className="rounded border border-hairline p-2" onClick={() => void load({ before: messages[0].id, ...(current?.leaf ? { leaf: current.leaf } : {}) })}>Önceki 50 mesaj</button>}{current?.hasNewer && <button disabled={busy} className="rounded border border-hairline p-2" onClick={() => void load({ after: messages.at(-1)!.id, ...(current.leaf ? { leaf: current.leaf } : {}) })}>Sonraki 50 mesaj</button>}{current && <button className="rounded border border-hairline p-2" onClick={() => { serial.current++; setPage(null); setBusy(false); setError(""); }}>En yeni mesajlar</button>}{busy && <span>Yükleniyor…</span>}{error && <span role="alert" className="text-danger">{error}</span>}</div> };
}
