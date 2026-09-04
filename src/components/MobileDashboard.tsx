import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, CheckSquare, Gear, House, Plus, Robot } from "@phosphor-icons/react";
import { api, useStore, visibleMessages, type Bot } from "@/state/store";
import { pendingApprovals, pendingQuestion } from "./PendingApproval";
import { Sheet } from "./Sheet";

type Tab = "home" | "tasks" | "agents" | "settings" | "chat";

function taskTitle(bot: Bot) {
  return bot.tasks?.find((task) => task.threadId === bot.threadId)?.title ||
    visibleMessages(bot).find((message) => message.role === "user")?.text || "Henüz görev verilmedi";
}

function waiting(bot: Bot) {
  const messages = visibleMessages(bot);
  return pendingApprovals(messages).length > 0 || Boolean(pendingQuestion(messages));
}

function NewMobileTask({ initialBotId, onClose, onStarted }: {
  initialBotId?: string;
  onClose: () => void;
  onStarted: (botId: string) => void;
}) {
  const { state, dispatch } = useStore();
  const bots = state.bots.filter((bot) => !bot.hidden);
  const [botId, setBotId] = useState(initialBotId ?? bots.find((bot) => !bot.busy)?.id ?? bots[0]?.id ?? "");
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  // If sending fails after creating the context, a retry must reuse it.
  const [created, setCreated] = useState<{ botId: string; threadId: string } | null>(null);
  const inFlight = useRef(false);
  const bot = bots.find((item) => item.id === botId);
  const instance = state.instances.find((item) => item.instanceId === bot?.modelSelection.instanceId);
  const ready = instance?.snapshot.state === "available" && instance.snapshot.authenticated !== false;

  async function start() {
    if (inFlight.current || !bot || bot.busy || !state.connected || !ready || !text.trim()) return;
    inFlight.current = true;
    setSubmitting(true);
    setError("");
    try {
      let context = created;
      if (!context || context.botId !== bot.id) {
        const result = await api(`/api/bots/${bot.id}/tasks`, { method: "POST", body: "{}" });
        if (!result.bot?.threadId) throw new Error("Görev oluşturulamadı. Tekrar dene.");
        context = { botId: bot.id, threadId: result.bot.threadId };
        setCreated(context);
        dispatch({ type: "taskSwitched", bot: result.bot });
      }
      await api(`/api/bots/${bot.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ text: text.trim(), expectedThreadId: context.threadId }),
      });
      onStarted(bot.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Görev gönderilemedi. Tekrar dene.");
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  return <Sheet title="Yeni görev başlat" subtitle="Agent bilgisayarındaki MausCrew'de çalışır." onClose={() => { if (!inFlight.current) onClose(); }} className="mobile-task-sheet">
    <form className="mobile-task-form" onSubmit={(event) => { event.preventDefault(); void start(); }}>
      <label htmlFor="mobile-task-agent">Hangi agent çalışsın?</label>
      <select id="mobile-task-agent" value={botId} disabled={submitting || Boolean(created)} onChange={(event) => setBotId(event.target.value)}>
        {bots.map((item) => <option key={item.id} value={item.id}>{item.name}{item.busy ? " (çalışıyor)" : ""}</option>)}
      </select>
      <label htmlFor="mobile-task-prompt">Ne yapmasını istiyorsun?</label>
      <textarea id="mobile-task-prompt" value={text} onChange={(event) => setText(event.target.value)} disabled={submitting} required placeholder="Örn. rakip ürünleri araştır ve kısa bir karşılaştırma hazırla." rows={5} />
      <p className="mobile-muted">Yeni görev ayrı bir sohbet açar. Önceki görevlerin korunur.</p>
      {bot?.busy && <p role="status">Bu agent çalışıyor. Mevcut sohbetine ek istek gönderebilir veya başka bir agent seçebilirsin.</p>}
      {!state.connected && <p role="status">Bilgisayar bağlantısı bekleniyor. MausCrew açık olmalı.</p>}
      {state.connected && bot && !ready && <p role="status">Bu agent'ın sağlayıcısı hazır değil. Agent ayarlarını kontrol et.</p>}
      {error && <p role="alert" className="mobile-error">{error}</p>}
      <button className="mobile-primary" disabled={submitting || !state.connected || !ready || !bot || bot.busy || !text.trim()}>{submitting ? "Görev gönderiliyor…" : created ? "Göndermeyi tekrar dene" : "Görevi başlat"}</button>
    </form>
  </Sheet>;
}

export function MobileDashboard({ children, onBrowseDirectory }: { children: ReactNode; onBrowseDirectory: () => void }) {
  const { state, dispatch } = useStore();
  const [tab, setTab] = useState<Tab>("home");
  const [newTask, setNewTask] = useState<{ botId?: string } | null>(null);
  const [filter, setFilter] = useState("all");
  const bots = state.bots.filter((bot) => !bot.hidden);
  const active = bots.filter((bot) => bot.busy);
  const needsInput = bots.filter(waiting);
  const reviews = state.reviews.filter((item) => item.status === "pending");
  const externalView = state.activeView !== "chat";
  const showChat = tab === "chat" || externalView;

  useEffect(() => {
    document.documentElement.classList.add("mobile-remote-theme");
    return () => document.documentElement.classList.remove("mobile-remote-theme");
  }, []);

  function openBot(botId: string) {
    dispatch({ type: "select", id: botId });
    setTab("chat");
  }

  function navigate(next: Tab) {
    dispatch({ type: "select", id: state.selectedId });
    setTab(next);
  }

  function taskCard(bot: Bot) {
    const messages = visibleMessages(bot);
    const activity = messages.filter((message) => message.kind === "activity").at(-1);
    const status = waiting(bot) ? "Yanıtın gerekiyor" : bot.busy ? "Çalışıyor" : "Sohbet";
    return <article className="mobile-card" key={bot.id}>
      <div className="mobile-row"><span className="mobile-chip">{status}</span><span className="mobile-muted">{bot.name}</span></div>
      <h3>{taskTitle(bot)}</h3>
      <p className="mobile-muted mobile-clamp">{bot.busy ? activity?.tool?.spoken || "Agent görevin üzerinde çalışıyor." : "Konuşmayı açarak devam edebilirsin."}</p>
      <button className="mobile-link" onClick={() => openBot(bot.id)}>{waiting(bot) ? "İsteği incele" : "Sohbeti aç"}<ArrowRight size={16} /></button>
    </article>;
  }

  const agentRows = (items: Bot[]) => items.map((bot) => <div className="mobile-agent" key={bot.id}>
    <span className="mobile-avatar" aria-hidden>{bot.name.slice(0, 1)}</span>
    <button className="mobile-agent-name" onClick={() => openBot(bot.id)}><strong>{bot.name}</strong><span className="mobile-muted">{bot.title || (bot.busy ? "Çalışıyor" : "Göreve hazır")}</span></button>
    <button className="mobile-link" onClick={() => bot.busy ? openBot(bot.id) : setNewTask({ botId: bot.id })}>{bot.busy ? "Takip et" : "Görev ver"}</button>
  </div>);

  return <div className="mobile-dashboard">
    <header className="mobile-header">
      {showChat ? <button className="mobile-back" aria-label="Ana ekrana dön" onClick={() => navigate("home")}><ArrowLeft size={21} /></button> : <span className="mobile-logo" aria-hidden>m</span>}
      <strong>MausCrew</strong><span role="status" className={`mobile-connection ${state.connected ? "is-connected" : ""}`}>{state.connected ? "PC bağlı" : "Bağlanıyor"}</span>
    </header>
    {!state.connected && <div className="mobile-offline" role="status">Bilgisayara bağlantı yok. Görev göndermek için MausCrew açık olmalı.</div>}
    {state.error && !showChat && <div className="mobile-error" role="alert">{state.error}</div>}
    {showChat ? <div className="mobile-workspace">{children}</div> : <main className="mobile-content">
      {tab === "home" && <>
        <p className="mobile-eyebrow">MOBİL ÇALIŞMA ALANIN</p><h1>Bugün ne yapalım?</h1>
        <button className="mobile-primary" disabled={!bots.length || !state.connected} onClick={() => setNewTask({})}><Plus size={18} /> Yeni görev başlat</button>
        <div className="mobile-section-title"><h2>Devam eden</h2><span>{active.length} görev</span></div>
        {active.length ? active.map(taskCard) : <div className="mobile-card mobile-empty">{state.connected ? "Şu anda çalışan görev yok. Hazır olduğunda yeni bir görev başlat." : "Görevlerin bağlantı kurulduğunda burada görünecek."}</div>}
        {needsInput.filter((bot) => !bot.busy).map(taskCard)}
        {reviews.length > 0 && <div className="mobile-card mobile-notice"><p className="mobile-eyebrow">KARARIN GEREKİYOR</p><h3>{reviews.length} paylaşım onay bekliyor</h3><p className="mobile-muted">Gönderilmeden önce içeriği ve alıcısını incele.</p><button className="mobile-link" onClick={() => dispatch({ type: "showReviews" })}>Taslakları incele <ArrowRight size={16} /></button></div>}
        <div className="mobile-section-title"><h2>Agent'ların</h2><button className="mobile-link" onClick={() => setTab("agents")}>Tümü</button></div>
        {agentRows(bots.slice(0, 4))}
        {!bots.length && <div className="mobile-card"><p>İlk görev için bir agent ekle.</p><button className="mobile-link" onClick={onBrowseDirectory}>Agent kataloğunu aç <ArrowRight size={16} /></button></div>}
      </>}
      {tab === "tasks" && <>
        <p className="mobile-eyebrow">KALDIĞIN YERDEN DEVAM ET</p><h1>Görevlerin</h1>
        <div className="mobile-filters" aria-label="Görev filtresi">{[["all", "Tümü"], ["running", "Çalışan"], ["waiting", "Yanıt bekleyen"]].map(([value, label]) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
        {bots.filter((bot) => filter === "running" ? bot.busy : filter === "waiting" ? waiting(bot) : bot.messages.length > 0 || bot.tasks?.length).map(taskCard)}
        {!bots.some((bot) => filter === "running" ? bot.busy : filter === "waiting" ? waiting(bot) : bot.messages.length > 0 || bot.tasks?.length) && <p className="mobile-empty">Bu görünümde görev yok.</p>}
        {filter === "all" && bots.flatMap((bot) => (bot.tasks ?? []).filter((task) => task.threadId !== bot.threadId).map((task) => <article className="mobile-card" key={task.threadId}><span className="mobile-muted">{bot.name} · Önceki görev</span><h3>{task.title}</h3><button className="mobile-link" disabled={Boolean(bot.busy) || !state.connected} onClick={() => { dispatch({ type: "switchTask", botId: bot.id, threadId: task.threadId }); openBot(bot.id); }}>Sohbeti aç <ArrowRight size={16} /></button>{bot.busy && <p className="mobile-muted">Agent çalışırken önceki göreve geçilemez.</p>}</article>))}
        <button className="mobile-primary" disabled={!bots.length || !state.connected} onClick={() => setNewTask({})}><Plus size={18} /> Yeni görev</button>
      </>}
      {tab === "agents" && <><p className="mobile-eyebrow">BİRLİKTE ÇALIŞTIĞIN EKİP</p><h1>Agent'ların</h1>{agentRows(bots)}<button className="mobile-primary" onClick={onBrowseDirectory}><Plus size={18} /> Agent ekle</button></>}
      {tab === "settings" && <><p className="mobile-eyebrow">MAUSCREW REMOTE</p><h1>Ayarlar</h1><div className="mobile-card"><h3>Bilgisayar bağlantısı</h3><p className="mobile-muted">{state.connected ? "Bağlı. Görevlerini buradan yönetebilirsin." : "Bağlantı bekleniyor."}</p><p className="mobile-muted">Agent'lar bilgisayarında çalışır. Bilgisayar ve MausCrew açık kalmalı.</p></div>
        <button className="mobile-settings-row" onClick={() => dispatch({ type: "showRoutines" })}>Otomasyonlar <ArrowRight size={18} /></button>
        <button className="mobile-settings-row" onClick={() => dispatch({ type: "showWorkflows" })}>İş akışları <ArrowRight size={18} /></button>
        <button className="mobile-settings-row" onClick={() => dispatch({ type: "showReviews" })}>Onay bekleyen paylaşımlar <ArrowRight size={18} /></button>
        <button className="mobile-settings-row" onClick={() => dispatch({ type: "toggleAppSettings", open: true })}>Uygulama ayarları <ArrowRight size={18} /></button>
        <div className="mobile-owner">Ürün sahibi: <strong>Umut Çelik</strong><div><a href="https://x.com/palamut62" target="_blank" rel="noreferrer">X</a><a href="https://github.com/palamut62" target="_blank" rel="noreferrer">GitHub</a></div></div>
      </>}
    </main>}
    <nav className="mobile-nav" aria-label="Mobil ana gezinme">{([
      ["home", "Ana ekran", House], ["tasks", "Görevler", CheckSquare], ["agents", "Agent'lar", Robot], ["settings", "Ayarlar", Gear],
    ] as const).map(([value, label, Icon]) => <button key={value} aria-current={!externalView && tab === value ? "page" : undefined} onClick={() => navigate(value)}><Icon size={21} weight={tab === value ? "fill" : "regular"} /><span>{label}</span></button>)}</nav>
    {newTask && <NewMobileTask initialBotId={newTask.botId} onClose={() => setNewTask(null)} onStarted={(botId) => { setNewTask(null); openBot(botId); }} />}
  </div>;
}
