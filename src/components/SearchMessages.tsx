import { useState } from "react";
import { api, useStore } from "@/state/store";
type Result = { botId: string; groupId: string; threadId: string; messageId: string; title: string; text: string; at: number };
export function SearchMessages() {
  const { state, dispatch } = useStore();
  const [q, setQ] = useState(""); const [botId, setBotId] = useState(""); const [projectId, setProjectId] = useState("");
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [results, setResults] = useState<Result[]>([]); const [total, setTotal] = useState(0); const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function search(next = 0) {
    setBusy(true); setError("");
    try { const data = await api(`/api/search?${new URLSearchParams({ q, botId, projectId, from, to, offset: String(next) })}`); setResults(data.results); setTotal(data.total); setOffset(next); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  async function open(result: Result) {
    setBusy(true); setError("");
    try {
      if (result.botId) {
        const { bot } = await api(`/api/bots/${result.botId}/tasks/${result.threadId}`, { method: "POST" });
        dispatch({ type: "taskSwitched", bot });
      }
      const target = { threadId: result.threadId, messageId: result.messageId };
      sessionStorage.setItem("mauscrew:jump-message", JSON.stringify(target));
      dispatch({ type: "select", id: result.botId || result.groupId });
      dispatch({ type: "toggleAppSettings", open: false });
      window.dispatchEvent(new CustomEvent("mauscrew:jump-message", { detail: target }));
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  return <section className="space-y-4 text-ink"><h2 className="font-semibold">Tüm görevlerde ara</h2><form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void search(); }}><input aria-label="Mesajlarda ara" placeholder="En az iki karakter" minLength={2} required value={q} onChange={(e) => setQ(e.target.value)} className="rounded border border-hairline bg-inset p-2 sm:col-span-2" /><select aria-label="Bot filtresi" value={botId} onChange={(e) => setBotId(e.target.value)} className="rounded bg-inset p-2"><option value="">Tüm botlar</option>{state.bots.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select><select aria-label="Proje filtresi" value={projectId} onChange={(e) => setProjectId(e.target.value)} className="rounded bg-inset p-2"><option value="">Tüm projeler</option>{state.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select><label className="text-xs">Başlangıç<input type="date" className="block w-full rounded bg-inset p-2" value={from} onChange={(e) => setFrom(e.target.value)} /></label><label className="text-xs">Bitiş<input type="date" className="block w-full rounded bg-inset p-2" value={to} onChange={(e) => setTo(e.target.value)} /></label><button disabled={busy} className="rounded border border-hairline p-2">Ara</button></form>{error && <p role="alert" className="text-sm text-danger">{error}</p>}<p className="text-xs text-ink-secondary">{total} sonuç</p>{results.map((r) => <button disabled={busy} key={`${r.threadId}:${r.messageId}`} className="block w-full rounded-lg border border-hairline p-3 text-left" onClick={() => void open(r)}><span className="block text-sm font-medium">{r.title}</span><span className="block whitespace-pre-wrap break-words text-xs text-ink-secondary">{r.text}</span><time className="mt-2 block font-mono text-[10px] text-ink-secondary">{new Date(r.at).toLocaleString("tr-TR")}</time></button>)}<div className="flex gap-3 text-xs">{offset > 0 && <button disabled={busy} onClick={() => void search(offset - 50)}>Önceki sonuçlar</button>}{offset + results.length < total && <button disabled={busy} onClick={() => void search(offset + 50)}>Sonraki sonuçlar</button>}</div></section>;
}
