import { useState } from "react";
import { api, useStore, type ReviewItem } from "@/state/store";

const labels = { pending: "Onay bekliyor", sending: "Gönderiliyor", sent: "Teslim doğrulandı", failed: "Gönderilmedi", unknown: "Teslim belirsiz", dismissed: "Reddedildi" };
const button = "rounded-lg border border-hairline px-3 py-2 text-xs disabled:opacity-40 hover:bg-raised";
function ReviewCard({ item }: { item: ReviewItem }) {
  const { dispatch } = useStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: item.title, target: item.target, content: item.content });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [checked, setChecked] = useState(false);
  const [receipt, setReceipt] = useState("");
  async function update(suffix: string, body: object, method = "POST") {
    setBusy(true); setError("");
    try {
      const result = await api(`/api/review-queue/${item.id}${suffix}`, { method, body: JSON.stringify(body) });
      dispatch({ type: "reviewPatched", item: result.item }); setEditing(false);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  const editable = item.status === "pending" || item.status === "failed";
  return <article className="rounded-xl border border-hairline bg-panel p-4 text-ink">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-medium">{item.title}</h2><span className="text-xs text-ink-secondary">{labels[item.status]} · Sürüm {item.revision ?? 1}</span></div>
    {editing ? <div className="my-3 space-y-3">{(["title", "target", "content"] as const).map((field) => <label key={field} className="block text-xs">{{ title: "Başlık", target: "Hedef / alıcı", content: "İçerik" }[field]}{field === "content" ? <textarea rows={8} className="mt-1 w-full rounded border border-hairline bg-inset p-2" value={draft[field]} onChange={(e) => setDraft({ ...draft, [field]: e.target.value })} /> : <input className="mt-1 w-full rounded border border-hairline bg-inset p-2" value={draft[field]} onChange={(e) => setDraft({ ...draft, [field]: e.target.value })} />}</label>)}<button className={button} disabled={busy} onClick={() => void update("", { ...draft, revision: item.revision ?? 1 }, "PATCH")}>Kaydet</button> <button className={button} onClick={() => setEditing(false)}>Vazgeç</button></div> : <><p className="mt-1 break-words text-xs text-ink-secondary">Hedef: {item.target}</p><pre className="my-3 max-h-72 overflow-auto whitespace-pre-wrap break-words font-sans text-sm">{item.content}</pre></>}
    {item.result && <p className="my-2 whitespace-pre-wrap text-xs text-ink-secondary">{item.result}</p>}
    {item.receipt && <p className="my-2 break-all text-xs">Teslim kaydı ({item.receipt.verifiedBy === "user" ? "kullanıcı doğrulaması" : "bağlayıcı doğrulaması"}): {item.receipt.url?.startsWith("https://") ? <a className="underline" href={item.receipt.url} target="_blank" rel="noreferrer">{item.receipt.id}</a> : item.receipt.id}</p>}
    {editable && !editing && <div className="flex flex-wrap gap-2"><button className={button} disabled={busy} onClick={() => { setDraft({ title: item.title, target: item.target, content: item.content }); setEditing(true); }}>Düzenle</button><button className={button} disabled={busy} onClick={() => void update("/dismiss", {})}>Reddet</button><button className={button + " bg-accent text-app"} disabled={busy} onClick={() => void update("/approve", { revision: item.revision ?? 1 })}>Bu sürümü onayla ve gönder</button></div>}
    {item.status === "unknown" && <div className="space-y-3 rounded-lg border border-warning/40 p-3 text-xs"><p>Tekrar göndermeden önce hedef uygulamayı kontrol edin. Modelin yanıtı teslim kanıtı sayılmaz.</p><label className="flex items-center gap-2"><input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />Hedefi kontrol ettim</label><input aria-label="Teslim kaydı" placeholder="Mesaj kimliği veya HTTPS bağlantısı" className="w-full rounded border border-hairline bg-inset p-2" value={receipt} onChange={(e) => setReceipt(e.target.value)} /><div className="flex flex-wrap gap-2"><button className={button} disabled={busy || !checked || !receipt.trim()} onClick={() => void update("/verify", { checkedTarget: true, delivered: true, receiptId: receipt.trim(), ...(receipt.startsWith("https://") ? { url: receipt.trim() } : {}) })}>Teslim edildiğini kaydet</button><button className={button} disabled={busy || !checked} onClick={() => void update("/verify", { checkedTarget: true, delivered: false })}>Teslim edilmediğini kaydet</button></div></div>}
    {error && <p role="alert" className="mt-3 text-xs text-danger">{error}</p>}
  </article>;
}
export function ReviewQueuePage() {
  const { state } = useStore();
  return <main className="min-w-0 flex-1 overflow-y-auto bg-app px-5 py-6 md:px-8"><div className="mx-auto max-w-4xl"><h1 className="text-[22px] font-semibold text-ink">Onay kuyruğu</h1><p className="mb-6 mt-1 text-sm text-ink-secondary">Hedefi ve içeriği düzenleyin, incelediğiniz sürümü onaylayın ve teslim kaydını kontrol edin.</p><div className="space-y-3">{state.reviews.length ? state.reviews.map((item) => <ReviewCard key={item.id} item={item} />) : <p className="text-sm text-ink-secondary">İncelenecek gönderim yok.</p>}</div></div></main>;
}
