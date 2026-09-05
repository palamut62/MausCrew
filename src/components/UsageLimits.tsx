import { useEffect, useState } from "react";
import { api, useStore } from "@/state/store";
import { Card } from "./SettingsPrimitives";
interface Limits { dailyTokens: number; dailyTurns: number; taskTokens: number; taskTurns: number }
interface Usage { limits: Limits; day: string; today: { tokens: number; turns: number }; tasks: Record<string, { tokens: number; turns: number }> }
const fields: Array<[keyof Limits, string]> = [["dailyTokens", "Günlük token"], ["dailyTurns", "Günlük tur"], ["taskTokens", "Görev başına token"], ["taskTurns", "Görev başına tur"]];
export function UsageLimits() {
  const { state } = useStore();
  const [usage, setUsage] = useState<Usage>();
  const [draft, setDraft] = useState<Limits>();
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { let live = true; void api("/api/usage-limits").then((data) => { if (live) { setUsage(data); setDraft(data.limits); } }).catch((e) => live && setMessage(String(e))); return () => { live = false; }; }, []);
  return <Card title="Kullanım sınırları" subtitle="0 sınırsızdır. Günlük sınır tüm botlara, görev sınırı her konuşmaya ayrı uygulanır. Kontrol sunucuda yapılır; zamanlanmış ve botlar arası işler de kapsanır.">
    {message && <p role="status" className="mb-3 text-sm">{message}</p>}
    {usage && <p className="mb-4 text-sm">Bugün ({usage.day}): {usage.today.tokens.toLocaleString()} token · {usage.today.turns} tur</p>}
    <div className="grid grid-cols-2 gap-3">{draft && fields.map(([key, label]) => <label key={key} className="text-sm">{label}<input className="mt-1 w-full rounded-lg border border-hairline bg-inset px-3 py-2" type="number" min="0" step="1" max="1000000000" value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: Number(e.target.value) })} /></label>)}</div>
    <p className="my-3 text-xs text-ink-secondary">Token sayısı sağlayıcı raporladığında güncellenir; devam eden işlem raporlama aralığı kadar sınırı aşabilir. Token raporlamayan sağlayıcılar için tur sınırı kullanın. Ücret bilgisi tüm sağlayıcılarda mevcut değildir.</p>
    <button className="rounded-lg bg-accent px-4 py-2 text-sm text-app disabled:opacity-40" disabled={!draft || saving} onClick={() => {
      setSaving(true); setMessage("");
      void api("/api/usage-limits", { method: "PUT", body: JSON.stringify(draft) }).then((data) => { setUsage(data); setMessage("Sınırlar kaydedildi."); }).catch((e) => setMessage(String(e))).finally(() => setSaving(false));
    }}>Sınırları kaydet</button>
    <div className="mt-4 space-y-2">{usage && state.bots.flatMap((b) => (b.tasks ?? []).filter((t) => usage.tasks[t.threadId]).map((t) => <div key={t.threadId} className="text-xs">{b.name} · {t.title}: {usage.tasks[t.threadId].tokens.toLocaleString()} token / {usage.tasks[t.threadId].turns} tur</div>))}</div>
  </Card>;
}
