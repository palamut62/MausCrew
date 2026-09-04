// Monospace zen — the crew as processes. A console skin: counters that hold
// real numbers, a roster of attached agents, a stream of what actually
// happened, and one command line. Every figure on this screen comes from
// live state; nothing here is decorative telemetry.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft } from "@phosphor-icons/react";
import { api, useStore, visibleMessages, type Bot } from "@/state/store";
import { MobileLayoutPicker } from "./MobileLayoutPicker";
import { botWaiting, collectDecisions, currentActivity, taskTitle, type MobileDecision } from "@/lib/mobile";

type Pane = "console" | "settings";

function clock(at: number): string {
  return new Date(at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

interface StreamLine {
  key: string;
  at: number;
  who: string;
  text: string;
  tone: "run" | "wait" | "you";
}

/** A console line is one line — long prompts are cut, not allowed to flood. */
function line(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > 120 ? `${flat.slice(0, 119)}…` : flat;
}

/** The last things that happened, across the whole crew, newest last. */
function stream(bots: Bot[]): StreamLine[] {
  const lines: StreamLine[] = [];
  for (const bot of bots) {
    for (const message of visibleMessages(bot).slice(-8)) {
      const who = bot.name.toUpperCase();
      if (message.kind === "activity") {
        lines.push({ key: message.id, at: message.at, who, tone: "run", text: line(message.tool?.spoken || message.tool?.name || "adım") });
      } else if (message.kind === "options" && message.card && !message.card.answered) {
        lines.push({ key: message.id, at: message.at, who, tone: "wait", text: line(message.card.title || "karar bekliyor") });
      } else if (message.role === "user" && message.text) {
        lines.push({ key: message.id, at: message.at, who, tone: "you", text: line(message.text) });
      }
    }
  }
  return lines.sort((a, b) => a.at - b.at).slice(-9);
}

export function MobileMonospaceZen({ children, onBrowseDirectory }: {
  children: ReactNode;
  onBrowseDirectory: () => void;
}) {
  const { state, dispatch } = useStore();
  const [pane, setPane] = useState<Pane>("console");
  const [command, setCommand] = useState("");
  const [target, setTarget] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmAbort, setConfirmAbort] = useState(false);
  const [chat, setChat] = useState(false);
  const inFlight = useRef(false);
  const input = useRef<HTMLInputElement>(null);

  const bots = state.bots.filter((bot) => !bot.hidden);
  const busy = bots.filter((bot) => bot.busy);
  const decisions = collectDecisions(bots);
  const lines = stream(bots);
  const selected = bots.find((bot) => bot.id === target) ?? bots.find((bot) => !bot.busy) ?? bots[0];
  const externalView = state.activeView !== "chat";
  const showChat = chat || externalView;

  useEffect(() => {
    document.documentElement.classList.add("mobile-remote-theme");
    return () => document.documentElement.classList.remove("mobile-remote-theme");
  }, []);

  function openChat(botId: string) {
    dispatch({ type: "select", id: botId });
    setTarget(botId);
    setChat(true);
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

  function abort() {
    if (!confirmAbort) { setConfirmAbort(true); return; }
    for (const bot of busy) dispatch({ type: "interrupt", botId: bot.id });
    setConfirmAbort(false);
  }

  // "@ada komut" targets a bot by name; otherwise the picked one runs it. A
  // busy bot is steered on its live thread instead of being forked onto a new
  // one, so a follow-up instruction lands where the work is.
  async function exec() {
    const raw = command.trim();
    if (inFlight.current) return;
    if (!raw) { setError("Önce bir komut yaz"); return; }
    if (!state.connected) { setError("Host bağlı değil. MausCrew açık olmalı."); return; }

    let bot = selected;
    let text = raw;
    if (raw.startsWith("@")) {
      const [tag, ...rest] = raw.split(" ");
      const name = tag.slice(1).toLocaleLowerCase("tr");
      const matched = bots.find((item) => item.name.toLocaleLowerCase("tr").startsWith(name));
      if (!matched) { setError(`@${name} adında bot yok`); return; }
      bot = matched;
      text = rest.join(" ").trim();
      if (!text) { setError("Komut boş. Bot adından sonra ne yapacağını yaz."); return; }
    }
    if (!bot) { setError("Henüz bot yok"); return; }

    inFlight.current = true;
    setSending(true);
    setError("");
    try {
      let threadId = bot.threadId;
      if (!bot.busy) {
        const result = await api(`/api/bots/${bot.id}/tasks`, { method: "POST", body: "{}" });
        if (!result.bot?.threadId) throw new Error("Görev açılamadı. Tekrar dene.");
        threadId = result.bot.threadId;
        dispatch({ type: "taskSwitched", bot: result.bot });
      }
      await api(`/api/bots/${bot.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ text, expectedThreadId: threadId }),
      });
      setCommand("");
      setTarget(bot.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Komut gönderilemedi. Tekrar dene.");
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }

  if (showChat) {
    return (
      <div className="mobile-dashboard mz">
        <header className="mz-bar">
          <button className="mz-link" onClick={() => { dispatch({ type: "select", id: state.selectedId }); setChat(false); }}>
            <ArrowLeft size={14} /> geri
          </button>
          <span className={state.connected ? "mz-on" : "mz-off"}>{state.connected ? "host bağlı" : "host yok"}</span>
        </header>
        <div className="mobile-workspace">{children}</div>
      </div>
    );
  }

  if (pane === "settings") {
    return (
      <div className="mobile-dashboard mz">
        <header className="mz-bar">
          <button className="mz-link" onClick={() => setPane("console")}><ArrowLeft size={14} /> konsol</button>
          <span className="mz-dim">ayarlar</span>
        </header>
        <div className="mz-scroll">
          <MobileLayoutPicker className="mz-picker" />
          <div className="mz-settings">
            <button onClick={onBrowseDirectory}>bot ekle</button>
            <button onClick={() => dispatch({ type: "showRoutines" })}>otomasyonlar</button>
            <button onClick={() => dispatch({ type: "showWorkflows" })}>iş akışları</button>
            <button onClick={() => dispatch({ type: "showReviews" })}>bekleyen paylaşımlar</button>
            <button onClick={() => dispatch({ type: "toggleAppSettings", open: true })}>uygulama ayarları</button>
          </div>
          <p className="mz-owner">
            ürün sahibi umut çelik
            <span>
              <a href="https://x.com/palamut62" target="_blank" rel="noopener noreferrer">x</a>
              <a href="https://github.com/palamut62" target="_blank" rel="noopener noreferrer">github</a>
            </span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-dashboard mz">
      <header className="mz-bar">
        <span className="mz-brand">mauscrew</span>
        <span className="mz-bar-end">
          <span className={state.connected ? "mz-on" : "mz-off"}>{state.connected ? "host bağlı" : "host yok"}</span>
          <button className="mz-link" onClick={() => setPane("settings")}>ayarlar</button>
        </span>
      </header>

      <div className="mz-scroll">
        <div className="mz-counters">
          <div><span>çalışan</span><strong>{busy.length}/{bots.length}</strong></div>
          <div><span>bekleyen karar</span><strong className={decisions.length ? "mz-warn" : ""}>{decisions.length}</strong></div>
          <div><span>okunmamış</span><strong>{bots.filter((bot) => bot.unread).length}</strong></div>
        </div>

        {decisions.length > 0 && (
          <section className="mz-block" aria-label="Bekleyen kararlar">
            <h2>karar bekliyor</h2>
            {decisions.map((item) => {
              const submitting = state.pendingDecisions[`${item.bot.threadId}:${item.requestId}`];
              return (
                <div className="mz-decision" key={item.id}>
                  <p className="mz-decision-top">
                    <span>&gt; {item.bot.name.toLocaleLowerCase("tr")}</span>
                    <span className="mz-dim">{item.tool ?? "soru"}</span>
                  </p>
                  <p className="mz-decision-title">{item.title}</p>
                  {item.detail && <pre>{item.detail}</pre>}
                  {item.held && <p className="mz-warn">{item.held}</p>}
                  {item.kind === "approval" ? (
                    <div className="mz-decision-actions">
                      <button className="mz-deny" disabled={Boolean(submitting)} onClick={() => decide(item, "deny")}>
                        {submitting === "deny" ? "[reddediliyor]" : "[reddet]"}
                      </button>
                      <button className="mz-allow" disabled={Boolean(submitting) || !state.connected} onClick={() => decide(item, "allow")}>
                        {submitting === "allow" ? "[izin veriliyor]" : "[izin ver]"}
                      </button>
                    </div>
                  ) : (
                    <div className="mz-decision-actions">
                      {item.options.map((option) => (
                        <button
                          key={option}
                          className="mz-allow"
                          disabled={Boolean(submitting) || !state.connected}
                          onClick={() => dispatch({ type: "answerCard", botId: item.bot.id, messageId: item.messageId, answer: option })}
                        >
                          [{option.toLocaleLowerCase("tr")}]
                        </button>
                      ))}
                    </div>
                  )}
                  <button className="mz-link" onClick={() => openChat(item.bot.id)}>sohbette aç</button>
                </div>
              );
            })}
          </section>
        )}

        <section className="mz-block" aria-label="Botlar">
          <h2>roster</h2>
          {!bots.length && <p className="mz-dim">henüz bot yok. ayarlardan ekle.</p>}
          {bots.map((bot) => {
            const waits = botWaiting(bot);
            const status = waits ? "bekliyor" : bot.busy ? "çalışıyor" : "boşta";
            return (
              <button
                key={bot.id}
                className={`mz-proc is-${waits ? "wait" : bot.busy ? "run" : "idle"}`}
                onClick={() => { setTarget(bot.id); setCommand(`@${bot.name.toLocaleLowerCase("tr")} `); input.current?.focus(); }}
              >
                <span className="mz-proc-top">
                  <span>&gt; {bot.name.toLocaleLowerCase("tr")}</span>
                  <span className="mz-proc-state">{status}</span>
                </span>
                <span className="mz-proc-sub">{bot.busy ? currentActivity(bot) || taskTitle(bot) : taskTitle(bot)}</span>
              </button>
            );
          })}
        </section>

        <section className="mz-block" aria-label="Akış">
          <h2>akış</h2>
          <div className="mz-stream">
            {!lines.length && <p className="mz-dim">henüz kayıt yok.</p>}
            {lines.map((line) => (
              <p key={line.key} className={`mz-line is-${line.tone}`}>
                <span className="mz-time">{clock(line.at)}</span>
                <span className="mz-who">{line.who}</span>
                <span>{line.text}</span>
              </p>
            ))}
          </div>
        </section>
      </div>

      {error && <p className="mz-error" role="alert">{error}</p>}
      <footer className="mz-footer">
        <form className="mz-prompt" onSubmit={(event) => { event.preventDefault(); void exec(); }}>
          <span aria-hidden>&gt;</span>
          <label className="mz-sr" htmlFor="mz-command">Komut</label>
          <input
            ref={input}
            id="mz-command"
            value={command}
            autoComplete="off"
            disabled={sending || !bots.length}
            placeholder={selected ? `@${selected.name.toLocaleLowerCase("tr")} yeni görev` : "önce bot ekle"}
            onChange={(event) => { setCommand(event.target.value); setError(""); }}
          />
          <button type="submit" disabled={sending || !bots.length}>{sending ? "gidiyor" : "çalıştır"}</button>
        </form>
        {busy.length > 0 && (
          <div className="mz-abort">
            <button onClick={abort} className={confirmAbort ? "mz-abort-armed" : ""}>
              {confirmAbort ? `[${busy.length} botu gerçekten durdur]` : "[çalışanları durdur]"}
            </button>
            {confirmAbort && <button className="mz-link" onClick={() => setConfirmAbort(false)}>vazgeç</button>}
          </div>
        )}
      </footer>
    </div>
  );
}
