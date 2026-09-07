import { useEffect, useState } from "react";
import { api, useStore, type Bot } from "@/state/store";
interface Scenario { id: string; title: string; criteria: string }
interface Result { id: string; engine: string; model?: string; scenarioId: string; status: string; durationMs: number; inputTokens?: number; outputTokens?: number; output?: string; error?: string }
interface Job { id: string; sourceThreadId: string; toBotId: string; state: string; message: string; error?: string }
const button = "rounded border border-hairline bg-panel px-2 py-1.5 text-xs disabled:opacity-50";
export function TaskOperations({ bot }: { bot: Bot }) {
  const { state } = useStore();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selected, setSelected] = useState("invoice-extraction");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    const load = async () => {
      try { const [data, queue] = await Promise.all([api("/api/evaluations"), api("/api/delegations")]); if (live) { setScenarios(data.scenarios); setResults(data.results); setJobs(queue.items); } }
      catch (e) { if (live) setError(String(e)); }
    };
    void load(); const timer = setInterval(() => void load(), 2000);
    return () => { live = false; clearInterval(timer); };
  }, []);
  async function run(path: string, body?: object) {
    setBusy(true); setError("");
    try { await api(path, { method: "POST", body: JSON.stringify(body ?? {}) }); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  return <div className="mt-3 space-y-4 border-t border-hairline pt-3">
    {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    <section aria-label="Bot değerlendirmesi" className="space-y-2">
      <h3 className="text-sm font-medium">Bot değerlendirmesi</h3>
      <p className="text-xs text-ink-secondary">Seçili botun motorunda gerçek bir tur çalışır ve kullanım kotası tüketir. Motorları aynı senaryoda karşılaştırın. Bunlar sınırlı örnek görevlerdir.</p>
      <select aria-label="Değerlendirme senaryosu" className={`${button} max-w-full`} value={selected} onChange={(e) => setSelected(e.target.value)}>{scenarios.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</select>
      <p className="text-xs text-ink-secondary">{scenarios.find((s) => s.id === selected)?.criteria}</p>
      <button className={button} disabled={busy || bot.busy || results.some((r) => r.status === "running" && r.engine === bot.modelSelection.instanceId)} onClick={() => void run("/api/evaluations", { botId: bot.id, scenarioId: selected })}>Bu botla değerlendirmeyi çalıştır</button>
      <div className="space-y-2">{results.filter((r) => r.scenarioId === selected).slice(-12).reverse().map((r) => <article key={r.id} className="rounded border border-hairline p-2 text-xs"><strong>{r.engine} / {r.model ?? "Bilinmiyor"}</strong><p>{({ running: "Çalışıyor", success: "Başarılı", failed: "Ölçüt karşılanmadı", error: "Çalıştırma hatası" } as Record<string,string>)[r.status]} · {(r.durationMs / 1000).toFixed(1)} sn</p><p>Token giriş/çıkış: {r.inputTokens ?? "Bilinmiyor"} / {r.outputTokens ?? "Bilinmiyor"}</p>{(r.output || r.error) && <details><summary>Sonucu göster</summary><pre className="whitespace-pre-wrap break-words">{r.error || r.output}</pre></details>}</article>)}</div>
    </section>
    <section aria-label="İş devri kuyruğu" className="space-y-2"><h3 className="text-sm font-medium">İş devri kuyruğu</h3>
      {jobs.filter((j) => j.sourceThreadId === bot.threadId).slice(-20).map((job) => <article className="rounded border border-hairline p-2 text-xs" key={job.id}><strong>{state.bots.find((b) => b.id === job.toBotId)?.name ?? "Silinen bot"} · {job.state}</strong><p className="break-words">{job.message.slice(0, 240)}</p>{job.error && <p>{job.error}</p>}{["interrupted", "failed"].includes(job.state) && <><p className="text-ink-secondary">Tekrarlamadan önce hedef botun çıktısını kontrol edin.</p><button className={button} disabled={busy} onClick={() => void run(`/api/delegations/${job.id}/retry`)}>Kontrol ettim, yeniden dene</button></>}{!["sent", "dispatching", "cancelled"].includes(job.state) && <button className={`${button} ml-2`} disabled={busy} onClick={() => void run(`/api/delegations/${job.id}/cancel`)}>İptal et</button>}</article>)}
    </section>
  </div>;
}
