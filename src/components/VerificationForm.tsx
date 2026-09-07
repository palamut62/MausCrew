import { useState } from "react";
import { api } from "@/state/store";
export function VerificationForm<T>({ path, cardId, onVerified, fileCheck = false }: { path: string; cardId?: string; onVerified: (value: T) => void; fileCheck?: boolean }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("test");
  const [note, setNote] = useState("");
  const [file, setFile] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function verify() {
    setBusy(true); setError("");
    try { const value = await api(path, { method: "POST", body: JSON.stringify({ cardId, kind, note, path: file }) }); onVerified(value); setOpen(false); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  const style = "rounded border border-hairline bg-panel px-2 py-1.5 text-xs disabled:opacity-50";
  if (!open) return <button className={style} onClick={() => setOpen(true)}>Sonucu doğrula</button>;
  return <div className="mt-2 space-y-2 rounded border border-hairline p-2">
    <p className="text-xs text-ink-secondary">Yalnızca gerçekten kontrol ettiğiniz sonucu kaydedin. Bu kayıt kullanıcı doğrulamasıdır.</p>
    <select aria-label="Doğrulama türü" className={style} value={kind} onChange={(e) => setKind(e.target.value)}><option value="test">Kod: test sonucu</option><option value="file">Rapor: dosya kontrolü</option><option value="browser">Tarayıcı: sonuç kontrolü</option><option value="review">Diğer: çıktı incelemesi</option></select>
    {kind === "file" && fileCheck && <input aria-label="Doğrulanan dosya yolu" placeholder="Dosyanın tam yolu" className={`${style} w-full`} value={file} onChange={(e) => setFile(e.target.value)} />}
    <textarea aria-label="Doğrulama kanıtı" placeholder="Çalıştırılan test ve sonuç, incelenen dosya veya kontrol edilen sayfa durumu" className={`${style} w-full`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
    {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    <div className="flex gap-2"><button className={style} disabled={busy || note.trim().length < 5 || (fileCheck && kind === "file" && !file.trim())} onClick={() => void verify()}>Kontrol ettim, doğrulamayı kaydet</button><button className={style} disabled={busy} onClick={() => setOpen(false)}>Vazgeç</button></div>
  </div>;
}
