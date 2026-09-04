// Decision rail — the phone opens on the one thing blocked on you, not on a
// list to browse. Behind it, a 46px rail of strips carries the crew: one
// strip per bot, filled while it works, capped dark while it waits on you.
// There is no tab bar; the band at the top of the rail is the only door
// between the two layers.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react";
import { api, useStore, visibleMessages, type Bot } from "@/state/store";
import { MAUS_COLORS } from "@/lib/colors";
import { MobileLayoutPicker } from "./MobileLayoutPicker";
import {
  botWaiting,
  collectDecisions,
  currentActivity,
  orderDecisions,
  relativeTime,
  taskTitle,
  type MobileDecision,
} from "@/lib/mobile";

type Layer = "auto" | "rail" | "settings";
type Row = { st: string; text: string; tone?: "ok" | "now" | "you" | "next" };

function where(bot: Bot): string {
  if (bot.computer === "cloud") return "bulut bilgisayarında";
  if (bot.computer === "vm") return "yerel sanal makinede";
  if (bot.computer === "local") return "senin bilgisayarında";
  if (bot.computer === "off") return "bilgisayarsız";
  return "otomatik bilgisayarda";
}

function stateWord(bot: Bot): string {
  if (botWaiting(bot)) return "seni bekliyor";
  if (bot.busy) return "çalışıyor";
  return "boşta";
}

/** A feed row is a glance, not a transcript — raw tool payloads get cut. */
function line(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > 110 ? `${flat.slice(0, 109)}…` : flat;
}

/** The bot's work as one column: what it did, what you said, what it is on now. */
function feedRows(bot: Bot): Row[] {
  const rows: Row[] = [];
  for (const message of visibleMessages(bot).slice(-14)) {
    if (message.role === "user" && message.text) {
      rows.push({ st: "sen", text: line(message.text), tone: "you" });
    } else if (message.kind === "activity") {
      rows.push({ st: "bitti", text: line(message.tool?.spoken || message.tool?.name || "Adım"), tone: "ok" });
    } else if (message.kind === "text" && message.text) {
      rows.push({ st: "bitti", text: line(message.text), tone: "ok" });
    } else if (message.kind === "options" && message.card && !message.card.answered) {
      rows.push({ st: "karar", text: line(message.card.title || "Senden karar bekliyor"), tone: "now" });
    }
  }
  if (bot.busy) rows.push({ st: "şimdi", text: line(currentActivity(bot) || "Çalışıyor"), tone: "now" });
  if (!rows.length) rows.push({ st: "sırada", text: "Henüz bir adım yok", tone: "next" });
  return rows.slice(-12);
}

function NewTaskSheet({ bots, onClose, onStarted }: {
  bots: Bot[];
  onClose: () => void;
  onStarted: (botId: string) => void;
}) {
  const { state, dispatch } = useStore();
  const [text, setText] = useState("");
  const [botId, setBotId] = useState(bots.find((bot) => !bot.busy)?.id ?? bots[0]?.id ?? "");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const inFlight = useRef(false);
  // A failed send after the context exists must reuse it, not fork another.
  const created = useRef<{ botId: string; threadId: string } | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { area.current?.focus(); }, []);

  async function start() {
    const bot = bots.find((item) => item.id === botId);
    if (inFlight.current || !bot) return;
    if (!text.trim()) { setError("İşi bir cümleyle yaz"); area.current?.focus(); return; }
    if (!state.connected) { setError("Bilgisayar bağlantısı yok. MausCrew açık olmalı."); return; }
    inFlight.current = true;
    setSending(true);
    setError("");
    try {
      let context = created.current;
      if (!context || context.botId !== bot.id) {
        const result = await api(`/api/bots/${bot.id}/tasks`, { method: "POST", body: "{}" });
        if (!result.bot?.threadId) throw new Error("Görev oluşturulamadı. Tekrar dene.");
        context = { botId: bot.id, threadId: result.bot.threadId };
        created.current = context;
        dispatch({ type: "taskSwitched", bot: result.bot });
      }
      await api(`/api/bots/${bot.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ text: text.trim(), expectedThreadId: context.threadId }),
      });
      created.current = null;
      onStarted(bot.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Görev gönderilemedi. Tekrar dene.");
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }

  return (
    <div className="rail-sheet" role="dialog" aria-modal="true" aria-label="Yeni iş">
      <div className="rail-sheet-in">
        <h2>Yeni iş</h2>
        <form onSubmit={(event) => { event.preventDefault(); void start(); }}>
          <label className="rail-sr" htmlFor="rail-task">İş tanımı</label>
          <textarea
            ref={area}
            id="rail-task"
            value={text}
            disabled={sending}
            placeholder="Aylık raporu hazırla"
            onChange={(event) => { setText(event.target.value); setError(""); }}
          />
          <label className="rail-sr" htmlFor="rail-task-bot">Hangi bot</label>
          <select id="rail-task-bot" value={botId} disabled={sending || !bots.length} onChange={(event) => setBotId(event.target.value)}>
            {!bots.length && <option value="">Henüz bot yok</option>}
            {bots.map((bot) => <option key={bot.id} value={bot.id}>{bot.name} · {stateWord(bot)}</option>)}
          </select>
          {error && <p className="rail-error" role="alert">{error}</p>}
          <div className="rail-pair">
            <button type="button" className="rail-ghost" onClick={onClose}>Vazgeç</button>
            <button type="submit" className="rail-go" disabled={sending || !bots.length}>{sending ? "Gönderiliyor…" : "Başlat"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function MobileDecisionRail({ children, onBrowseDirectory }: {
  children: ReactNode;
  onBrowseDirectory: () => void;
}) {
  const { state, dispatch } = useStore();
  const [layer, setLayer] = useState<Layer>("auto");
  const [deferred, setDeferred] = useState<string[]>([]);
  const [activeId, setActiveId] = useState("");
  const [taskOpen, setTaskOpen] = useState(false);
  const [chat, setChat] = useState(false);
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState("");
  const [sendingNote, setSendingNote] = useState(false);

  const bots = state.bots.filter((bot) => !bot.hidden);
  const decisions = orderDecisions(collectDecisions(bots), deferred);
  const current = decisions[0];
  const active = bots.find((bot) => bot.id === activeId) ?? bots[0];
  const externalView = state.activeView !== "chat";
  const showChat = chat || externalView;

  useEffect(() => {
    document.documentElement.classList.add("mobile-remote-theme");
    return () => document.documentElement.classList.remove("mobile-remote-theme");
  }, []);

  function openChat(botId: string) {
    dispatch({ type: "select", id: botId });
    setActiveId(botId);
    setChat(true);
  }

  function leaveChat() {
    dispatch({ type: "select", id: state.selectedId });
    setChat(false);
  }

  function decide(item: MobileDecision, behavior: "allow" | "deny") {
    dispatch({
      type: "decideRequest",
      threadId: item.bot.threadId,
      requestId: item.requestId,
      behavior,
      message: behavior === "deny" ? "Denied by the user." : undefined,
    });
  }

  function answer(item: MobileDecision, option: string) {
    dispatch({ type: "answerCard", botId: item.bot.id, messageId: item.messageId, answer: option });
  }

  // Deferring moves a decision to the back of the queue. Ids the desktop has
  // since answered are dropped here rather than in an effect, so the list
  // never grows past what is actually pending.
  function defer(item: MobileDecision) {
    const live = new Set(decisions.map((entry) => entry.id));
    setDeferred((previous) => [...previous.filter((id) => id !== item.id && live.has(id)), item.id]);
  }

  async function sendNote(event: React.FormEvent) {
    event.preventDefault();
    const text = note.trim();
    if (!active) return;
    if (!text) { setNoteError("Önce bir şeyler yaz"); return; }
    if (!state.connected) { setNoteError("Bilgisayar bağlantısı yok."); return; }
    setSendingNote(true);
    setNoteError("");
    try {
      await api(`/api/bots/${active.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ text, expectedThreadId: active.threadId }),
      });
      setNote("");
    } catch (cause) {
      setNoteError(cause instanceof Error ? cause.message : "Gönderilemedi. Tekrar dene.");
    } finally {
      setSendingNote(false);
    }
  }

  const submitting = current
    ? state.pendingDecisions[`${current.bot.threadId}:${current.requestId}`]
    : undefined;

  function decisionCard(item: MobileDecision) {
    const accent = MAUS_COLORS[item.bot.color];
    return (
      <article className="rail-card">
        <p className="rail-who">
          <span className="rail-dot" style={{ background: accent }} aria-hidden />
          {item.bot.name}, {taskTitle(item.bot)}, {relativeTime(item.at)}
        </p>
        <h1>{item.title}</h1>
        <div className="rail-ctx">
          {item.tool && <div className="rail-row"><span className="rail-st">araç</span><span>{item.tool}</span></div>}
          {item.risk && <div className="rail-row"><span className="rail-st">risk</span><span>{item.risk}</span></div>}
          {item.held && <div className="rail-row"><span className="rail-st">neden</span><span>{item.held}</span></div>}
        </div>
        {item.detail && <pre className="rail-detail">{item.detail}</pre>}
        <button className="rail-open" onClick={() => openChat(item.bot.id)}>
          Sohbette aç <ArrowRight size={15} />
        </button>
      </article>
    );
  }

  const railBand = (
    <button className="rail-band" onClick={() => setLayer("auto")}>
      <span>{decisions.length === 0 ? "Karar yok" : decisions.length === 1 ? "1 karar seni bekliyor" : `${decisions.length} karar seni bekliyor`}</span>
      <span className="rail-band-end">{decisions.length === 0 ? "Ekibin durumu" : "Karara dön"}</span>
    </button>
  );

  if (showChat) {
    return (
      <div className="mobile-dashboard rail-shell">
        <header className="rail-bar">
          <button className="rail-link" onClick={leaveChat}><ArrowLeft size={18} /> Geri</button>
          <span className="rail-muted">{state.connected ? "PC bağlı" : "Bağlanıyor"}</span>
        </header>
        <div className="mobile-workspace">{children}</div>
      </div>
    );
  }

  if (layer === "settings") {
    return (
      <div className="mobile-dashboard rail-shell">
        <header className="rail-bar">
          <button className="rail-link" onClick={() => setLayer("auto")}><ArrowLeft size={18} /> Geri</button>
          <span className="rail-muted">Ayarlar</span>
        </header>
        <div className="rail-scroll">
          <MobileLayoutPicker />
          <div className="rail-settings">
            <button onClick={onBrowseDirectory}>Bot ekle <ArrowRight size={17} /></button>
            <button onClick={() => dispatch({ type: "showRoutines" })}>Otomasyonlar <ArrowRight size={17} /></button>
            <button onClick={() => dispatch({ type: "showWorkflows" })}>İş akışları <ArrowRight size={17} /></button>
            <button onClick={() => dispatch({ type: "showReviews" })}>Onay bekleyen paylaşımlar <ArrowRight size={17} /></button>
            <button onClick={() => dispatch({ type: "toggleAppSettings", open: true })}>Uygulama ayarları <ArrowRight size={17} /></button>
          </div>
          <p className="rail-owner">
            Ürün sahibi <strong>Umut Çelik</strong>
            <span>
              <a href="https://x.com/palamut62" target="_blank" rel="noopener noreferrer">X</a>
              <a href="https://github.com/palamut62" target="_blank" rel="noopener noreferrer">GitHub</a>
            </span>
          </p>
        </div>
      </div>
    );
  }

  if (layer === "rail") {
    const rows = active ? feedRows(active) : [];
    return (
      <div className="mobile-dashboard rail-shell">
        {railBand}
        <div className="rail-body">
          <nav className="rail-strips" aria-label="Botlar">
            {bots.map((bot) => {
              const accent = MAUS_COLORS[bot.color];
              const waits = botWaiting(bot);
              const on = bot.id === active?.id;
              return (
                <button
                  key={bot.id}
                  className={`rail-strip${on ? " is-on" : ""}${waits ? " needs" : ""}`}
                  aria-current={on}
                  aria-label={`${bot.name}, ${stateWord(bot)}`}
                  style={{ background: on ? `color-mix(in srgb, ${accent} 24%, var(--color-raised))` : "var(--color-raised)" }}
                  onClick={() => setActiveId(bot.id)}
                >
                  <span className="rail-gauge">
                    {(waits || bot.busy) && <span className="rail-fill" style={{ background: accent }} />}
                  </span>
                  <span className="rail-ltr"><span>{bot.name.slice(0, 1)}</span></span>
                </button>
              );
            })}
          </nav>
          <div className="rail-panel">
            {!active && <p className="rail-muted">Henüz bot yok. Ayarlardan ekleyebilirsin.</p>}
            {active && <>
              <h1>{active.name}</h1>
              <p className="rail-who">
                <span className="rail-dot" style={{ background: MAUS_COLORS[active.color] }} aria-hidden />
                {active.title || "Bot"}, {where(active)}
              </p>
              <p className="rail-task">{taskTitle(active)}</p>
              <div className="rail-feed">
                {rows.map((row, index) => (
                  <div className={`rail-row${row.tone === "next" ? " is-next" : ""}`} key={index}>
                    <span className={`rail-st is-${row.tone ?? "ok"}`}>{row.st}</span>
                    <span>{row.text}</span>
                  </div>
                ))}
              </div>
              <button className="rail-open" onClick={() => openChat(active.id)}>Sohbeti aç <ArrowRight size={15} /></button>
            </>}
          </div>
        </div>
        {noteError && <p className="rail-error" role="alert">{noteError}</p>}
        <form className="rail-composer" onSubmit={sendNote}>
          <label className="rail-sr" htmlFor="rail-note">Bota söyle</label>
          <input
            id="rail-note"
            value={note}
            autoComplete="off"
            disabled={!active || sendingNote}
            placeholder={active ? `${active.name} için not` : "Bot yok"}
            onChange={(event) => { setNote(event.target.value); setNoteError(""); }}
          />
          <button type="submit" disabled={!active || sendingNote}>{sendingNote ? "…" : "Gönder"}</button>
        </form>
      </div>
    );
  }

  if (current) {
    return (
      <div className="mobile-dashboard rail-shell">
        <header className="rail-bar">
          <span className="rail-muted">Karar 1 / {decisions.length}</span>
          <button className="rail-link" onClick={() => setLayer("rail")}>Ekibe geç</button>
        </header>
        {!state.connected && <p className="rail-error" role="status">Bilgisayar bağlantısı yok. Karar gönderilemez.</p>}
        <div className="rail-cardwrap">{decisionCard(current)}</div>
        <footer className="rail-actions">
          {current.kind === "approval" ? (
            <div className="rail-pair">
              <button className="rail-ghost" disabled={Boolean(submitting)} onClick={() => decide(current, "deny")}>
                {submitting === "deny" ? "Reddediliyor…" : "Reddet"}
              </button>
              <button className="rail-go" disabled={Boolean(submitting) || !state.connected} onClick={() => decide(current, "allow")}>
                {submitting === "allow" ? "İzin veriliyor…" : "İzin ver"}
              </button>
            </div>
          ) : (
            <div className="rail-options">
              {current.options.map((option) => (
                <button key={option} className="rail-go" disabled={Boolean(submitting) || !state.connected} onClick={() => answer(current, option)}>
                  {option}
                </button>
              ))}
            </div>
          )}
          <button className="rail-defer" onClick={() => defer(current)}>Ertele, sonra sor</button>
        </footer>
      </div>
    );
  }

  return (
    <div className="mobile-dashboard rail-shell">
      <header className="rail-bar">
        <span className="rail-muted">{state.connected ? "PC bağlı" : "Bağlanıyor"}</span>
        <button className="rail-link" onClick={() => setLayer("rail")}>Ekibe geç</button>
      </header>
      <div className="rail-scroll">
        <h1 className="rail-calm-h">Karar kalmadı</h1>
        <p className="rail-calm-p">
          {bots.length
            ? "Botlar çalışıyor. Biri sana takılırsa bu ekran onun sorusuna dönüşür."
            : "Henüz bot yok. İlk botunu ekleyerek başla."}
        </p>
        <div className="rail-roster">
          {bots.map((bot) => (
            <button className="rail-mate" key={bot.id} onClick={() => { setActiveId(bot.id); setLayer("rail"); }}>
              <span className="rail-mate-top">
                <span className="rail-dot" style={{ background: botWaiting(bot) || bot.busy ? MAUS_COLORS[bot.color] : "var(--color-hairline)" }} aria-hidden />
                <strong>{bot.name}</strong>
                <span className="rail-mate-state">{stateWord(bot)}</span>
              </span>
              <span className="rail-mate-sub">{bot.busy ? currentActivity(bot) || taskTitle(bot) : taskTitle(bot)}</span>
            </button>
          ))}
        </div>
      </div>
      <footer className="rail-foot">
        <button className="rail-wide" onClick={() => (bots.length ? setTaskOpen(true) : onBrowseDirectory())}>
          {bots.length ? "Yeni iş ver" : "Bot ekle"}
        </button>
        <p className="rail-credit">
          Ürün sahibi Umut Çelik · <button onClick={() => setLayer("settings")}>Ayarlar</button>
        </p>
      </footer>
      {taskOpen && (
        <NewTaskSheet
          bots={bots}
          onClose={() => setTaskOpen(false)}
          onStarted={(botId) => { setTaskOpen(false); setActiveId(botId); setLayer("rail"); }}
        />
      )}
    </div>
  );
}
