import { useCallback, useEffect, useState } from "react";
import { api, useStore } from "@/state/store";
import { Card } from "./SettingsPrimitives";

interface Summary { createdAt: number; fileCount: number; bytes: number; files: string[] }
interface RecoveryState {
  issues: Array<{ id: string; file: string; backupAvailable: boolean }>;
  backups: Array<Summary & { id: string }>;
  workflows: Array<{ id: string; title: string }>;
  restartRequired: boolean;
}
export function RecoveryCenter() {
  const { dispatch } = useStore();
  const [data, setData] = useState<RecoveryState>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [restart, setRestart] = useState(false);
  const [candidate, setCandidate] = useState<unknown>();
  const [preview, setPreview] = useState<Summary>();
  const [confirm, setConfirm] = useState(false);
  const load = useCallback(async () => { setData(await api("/api/recovery")); }, []);
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError("");
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  useEffect(() => { queueMicrotask(() => void load().catch((e) => setError(String(e)))); }, [load]);
  const inspect = async (value: unknown) => {
    const summary = await api("/api/backups/preview", { method: "POST", body: JSON.stringify(value) });
    setCandidate(value); setPreview(summary); setConfirm(false);
  };
  const download = async () => {
    const value = await api("/api/backups/export");
    const url = URL.createObjectURL(new Blob([JSON.stringify(value)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = `MausCrew-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const button = "rounded-lg border border-hairline px-3 py-2 text-sm disabled:opacity-40 hover:bg-raised";
  return <>
    <Card title="Kurtarma merkezi" subtitle="Bozuk dosyalar korunur. Geri yüklemenin ardından uygulama yeniden başlatılır.">
      {error && <p role="alert" className="mb-3 text-sm text-danger">{error}</p>}
      {!data && !error && <p role="status">Kayıtlar kontrol ediliyor…</p>}
      {data?.issues.length === 0 && <p className="text-sm text-ink-secondary">Bozuk kayıt tespit edilmedi.</p>}
      {data?.issues.map((issue) => <div key={issue.id} className="my-3 flex flex-wrap items-center gap-3 rounded-lg border border-hairline p-3">
        <span className="min-w-0 flex-1 break-all text-sm">{issue.file}</span>
        <button className={button} disabled={busy || !issue.backupAvailable || restart} onClick={() => void run(async () => {
          await api("/api/recovery/last-good", { method: "POST", body: JSON.stringify({ id: issue.id }) }); setRestart(true);
        })}>{issue.backupAvailable ? "Son sağlam kopyayı hazırla" : "Sağlam kopya yok; yedek yükleyin"}</button>
      </div>)}
      {(restart || data?.restartRequired) && <div role="status" className="my-3 rounded-lg bg-raised p-3 text-sm">
        Geri yükleme hazır. Yeni iş başlatmadan uygulamayı yeniden açın.
        {window.mauscrew?.restartApp ? <button className={`${button} ml-2`} onClick={() => void window.mauscrew?.restartApp?.()}>Şimdi yeniden başlat</button> : <p>MausCrew masaüstü uygulamasını tamamen kapatıp yeniden açın.</p>}
      </div>}
      {!!data?.workflows.length && <button className={`${button} mt-3`} onClick={() => { dispatch({ type: "toggleAppSettings", open: false }); dispatch({ type: "showWorkflows" }); }}>{data.workflows.length} yarım iş akışını incele</button>}
    </Card>
    <Card title="Yedekleme ve geri yükleme" subtitle="Botlar, sohbetler, projeler, hafıza ve otomasyon kayıtları. Uygulama bağlantı ayarları, API anahtarları, webhook imza sırları, tarayıcı oturumları ve proje çalışma klasörleri dahil değildir. Yedek özel konuşmalar içerir; güvenli yerde saklayın.">
      <div className="flex flex-wrap gap-2">
        <button className={button} disabled={busy} onClick={() => void run(async () => { await api("/api/backups", { method: "POST" }); await load(); })}>Yerel yedek oluştur</button>
        <button className={button} disabled={busy} onClick={() => void run(download)}>Yedeği indir</button>
        <label className={button}>Yedek dosyası seç<input aria-label="Yedek dosyası" type="file" accept=".json" className="mt-2 block max-w-full text-xs" disabled={busy} onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void run(async () => { if (file.size > 70 * 1024 * 1024) throw new Error("Yedek en fazla 70 MB olabilir."); await inspect(JSON.parse(await file.text())); });
        }} /></label>
      </div>
      {data?.backups.map((b) => <div key={b.id} className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="flex-1">{new Date(b.createdAt).toLocaleString()} · {b.fileCount} dosya</span>
        <button className={button} disabled={busy} onClick={() => void run(async () => inspect(await api(`/api/backups/file/${b.id}`)))}>İçeriği incele</button>
      </div>)}
      {preview && <div className="mt-4 rounded-xl border border-hairline p-4">
        <p className="font-medium">Geri yükleme önizlemesi</p>
        <p className="my-2 text-sm">{new Date(preview.createdAt).toLocaleString()} · {preview.fileCount} dosya · {(preview.bytes / 1024).toFixed(0)} KB</p>
        <details className="text-sm"><summary>Dosyaları göster</summary><ul className="max-h-40 overflow-auto">{preview.files.map((f) => <li key={f} className="break-all">{f}</li>)}</ul></details>
        <label className="my-3 flex gap-2 text-sm"><input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />Mevcut kayıtların bu yedekteki sürümleriyle değişmesini onaylıyorum. Önceki dosyalar korunacak.</label>
        <button className={button} disabled={!confirm || busy || restart} onClick={() => void run(async () => { await api("/api/backups/restore", { method: "POST", body: JSON.stringify(candidate) }); setRestart(true); setPreview(undefined); })}>Geri yüklemeyi hazırla</button>
      </div>}
    </Card>
    <p className="text-xs text-ink-secondary">Ürün sahibi: Umut Çelik · <a className="underline" href="https://x.com/palamut62" target="_blank" rel="noreferrer">X</a> · <a className="underline" href="https://github.com/palamut62" target="_blank" rel="noreferrer">GitHub</a></p>
  </>;
}
