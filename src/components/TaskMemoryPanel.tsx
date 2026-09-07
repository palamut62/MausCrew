import { useEffect, useState } from "react";
import { api, useStore, type Bot } from "@/state/store";
interface Entry { id: string; kind: string; text: string; sourceMessageId?: string }
const labels: Record<string, string> = { decision: "Karar", artifact: "Üretilen dosya", verified: "Doğrulanan sonuç", remaining: "Kalan iş" };
const control = "rounded border border-hairline bg-panel px-2 py-1.5 text-xs disabled:opacity-50";
export function TaskMemoryPanel({ bot }: { bot: Bot }) {
  const { dispatch } = useStore();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [kind, setKind] = useState("decision");
  const [text, setText] = useState("");
  const [source, setSource] = useState("");
  const [editId, setEditId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const path = `/api/bots/${bot.id}/tasks/${bot.threadId}/memory`;
  useEffect(() => {
    let live = true;
    void api(path).then((data) => { if (live) setEntries(data.entries); }).catch((e) => { if (live) setError(String(e)); });
    return () => { live = false; };
  }, [path, bot.busy]);
  async function mutate(id?: string) {
    setBusy(true); setError("");
    try {
      if (id) { await api(`${path}/${id}`, { method: "DELETE" }); setEntries((items) => items.filter((item) => item.id !== id)); }
      else {
        const { entry } = await api(path, { method: editId ? "PUT" : "POST", body: JSON.stringify({ id: editId, kind, text, sourceMessageId: source || undefined }) });
        setEntries((items) => editId ? items.map((item) => item.id === editId ? entry : item) : [...items, entry]);
      }
      setEditId(undefined); setText(""); setSource("");
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  return <section className="mt-3 space-y-2 border-t border-hairline pt-3" aria-label="Görev hafızası">
    <h3 className="text-sm font-medium">Bu görevin hafızası</h3>
    <p className="text-xs text-ink-secondary">Kararlar ve kalan işler sonuç başlıklarından; dosyalar çıktı kartlarından kaydedilir. Düzeltmeleriniz korunur.</p>
    {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    {!entries.length && <p className="text-xs text-ink-secondary">Bu görev için henüz kayıt yok.</p>}
    {entries.map((entry) => <article key={entry.id} className="space-y-1 rounded border border-hairline bg-panel p-2 text-xs">
      <strong>{labels[entry.kind] ?? entry.kind}</strong><p className="whitespace-pre-wrap break-words">{entry.text}</p>
      <div className="flex flex-wrap gap-2">
        {entry.sourceMessageId && <button className={control} onClick={() => { const detail = { threadId: bot.threadId, messageId: entry.sourceMessageId }; dispatch({ type: "toggleSettings", open: false }); window.dispatchEvent(new CustomEvent("mauscrew:jump-message", { detail })); }}>Kaynak mesaja git</button>}
        <button className={control} disabled={busy} onClick={() => { setEditId(entry.id); setText(entry.text); setKind(entry.kind); setSource(entry.sourceMessageId ?? ""); }}>Düzenle</button>
        <button className={control} disabled={busy} onClick={() => void mutate(entry.id)}>Sil</button>
      </div>
    </article>)}
    <div className="flex flex-wrap gap-2"><select aria-label="Hafıza türü" className={control} value={kind} onChange={(e) => setKind(e.target.value)}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <select aria-label="Kaynak mesaj" className={`${control} min-w-0 max-w-full`} value={source} onChange={(e) => setSource(e.target.value)}><option value="">Kaynak mesaj (isteğe bağlı)</option>{source && !bot.messages.some((m) => m.id === source) && <option value={source}>Kayıtlı kaynak</option>}{bot.messages.filter((m) => m.text).slice(-40).map((m) => <option key={m.id} value={m.id}>{m.text?.slice(0, 60)}</option>)}</select></div>
    <textarea aria-label="Hafıza notu" className={`${control} w-full`} value={text} maxLength={4000} onChange={(e) => setText(e.target.value)} />
    <button className={control} disabled={busy || !text.trim()} onClick={() => void mutate()}>{editId ? "Kaydet" : "Not ekle"}</button>
    {editId && <button className={`${control} ml-2`} onClick={() => { setEditId(undefined); setText(""); setSource(""); }}>Vazgeç</button>}
  </section>;
}
