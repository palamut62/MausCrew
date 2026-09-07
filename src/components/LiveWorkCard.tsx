import { useStore, type Message } from "@/state/store";
import { VerificationForm } from "./VerificationForm";
export function LiveWorkCard({ message, botId }: { message: Message; botId?: string }) {
  const { state, dispatch } = useStore();
  const props = message.ui?.props ?? {};
  const id = String(props.botId ?? botId ?? "");
  const threadId = String(props.threadId ?? state.bots.find((bot) => bot.id === id)?.threadId ?? "");
  const status = String(props.status ?? "working");
  const running = status === "working" || status === "preparing";
  const verified = props.verification === "user" || props.verification === "evidence";
  const labels: Record<string, string> = { preparing: "Hazırlanıyor", working: "Çalışıyor", "action-needed": "Yanıt bekliyor", "human-control": "Kontrol sizde", done: verified ? "Doğrulandı" : "Tamamlandı bildirildi", failed: "Başarısız", stopped: "Durduruldu" };
  const evidence = props.evidence as { note?: string } | undefined;
  return <article className="w-full max-w-[720px] space-y-3 overflow-hidden rounded-xl border border-hairline bg-panel p-4" aria-label="Görev durumu">
    <div className="flex flex-wrap justify-between gap-2"><strong className="text-sm">{String(props.title ?? "Görev")}</strong><span className="font-mono text-xs text-ink-secondary">{labels[status] ?? status}</span></div>
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs"><dt>Sorumlu</dt><dd>{String(props.owner ?? state.bots.find((b) => b.id === id)?.name ?? "Bot")}</dd>
      <dt>Bekleme nedeni</dt><dd>{String(props.waitReason || (status === "human-control" ? "Bilgisayar kontrolü sizde." : "Yok"))}</dd>
      <dt>Sıradaki adım</dt><dd>{String(props.nextStep || props.lastAction || "İşleniyor")}</dd>
      <dt>Doğrulama</dt><dd>{verified ? "Kullanıcı doğruladı" : "Henüz doğrulanmadı"}</dd></dl>
    {!!(props.output || props.summary) && <div className="whitespace-pre-wrap break-words text-xs leading-relaxed">{String(props.output || props.summary)}</div>}
    {evidence?.note && <p className="whitespace-pre-wrap text-xs text-ink-secondary">Kanıt: {evidence.note}</p>}
    {status === "done" && !verified && id && threadId && <VerificationForm<{ message: Message }> path={`/api/bots/${id}/tasks/${threadId}/work-card/verify`} cardId={message.id} fileCheck onVerified={(value) => dispatch({ type: "messagePatched", threadId, message: value.message })} />}
    {(running || status === "action-needed" || status === "human-control") && <button className="rounded border border-hairline px-3 py-2 text-xs" onClick={() => dispatch({ type: "setTakeover", botId: id, active: status !== "human-control", ...(status === "human-control" ? { resume: true } : {}) })}>{status === "human-control" ? "Kontrolü bota geri ver" : "Kontrolü al"}</button>}
  </article>;
}
