// Monospace zen — the crew as processes. A console skin: bracket tokens, a
// process roster with its decision inline, and a timestamped stream. Every
// figure comes from live state — the latency counter is a measured round trip
// to the local harness, not decoration.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft } from "@phosphor-icons/react";
import { api, useStore, visibleMessages, type Bot } from "@/state/store";
import { MobileLayoutPicker } from "./MobileLayoutPicker";
import { botWaiting, collectDecisions, currentActivity, taskTitle, type MobileDecision } from "@/lib/mobile";

type Pane = "console" | "settings";

// Console tokens are cased invariantly: Turkish casing would print SKILL as
// SKILL with a dotted capital, and the same rule runs on both sides of an
// "@name" match so what you read is what you can type.
const proc = (name: string) => name.toUpperCase().replace(/\s+/g, "_");
const tag = (name: string) => name.toLowerCase().replace(/\s+/g, "_");

function clock(at: number): string {
  return new Date(at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/** How long ago, in the console's own shorthand: 4m12s, 1h04m. */
function elapsed(at: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m${String(seconds % 60).padStart(2, "0")}s`;
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}m`;
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
  const flat = text.replace(/\*\*|__/g, "").replace(/\s+/g, " ").trim();
  return flat.length > 110 ? `${flat.slice(0, 109)}…` : flat;
}

/** waiting first, then running, then idle */
function rank(bot: Bot): number {
  if (botWaiting(bot)) return 0;
  if (bot.busy) return 1;
  return 2;
}

function lastAt(bot: Bot): number | undefined {
  return visibleMessages(bot).at(-1)?.at;
}

/** The last things that happened, across the whole crew, newest last. */
function stream(bots: Bot[]): StreamLine[] {
  const lines: StreamLine[] = [];
  for (const bot of bots) {
    for (const message of visibleMessages(bot).slice(-8)) {
      const who = tag(bot.name);
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

/** Re-renders once a second while anything is running, so elapsed counters
 * advance instead of freezing until the next server event. */
function useTick(running: boolean): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [running]);
}

/** The bot's last spoken reply, for the status line after a turn settles. */
function lastReply(bot: Bot): string | undefined {
  const message = visibleMessages(bot).filter((item) => item.role === "bot" && item.kind === "text" && item.text).at(-1);
  return message?.text ? line(message.text) : undefined;
}

/** Round trip to the local harness, sampled so the counter is a real number. */
function useLatency(connected: boolean): number | null {
  const [ms, setMs] = useState<number | null>(null);
  useEffect(() => {
    if (!connected) return;
    let live = true;
    const sample = async () => {
      const started = performance.now();
      try {
        await fetch("/api/health", { cache: "no-store" });
        if (live) setMs(Math.round(performance.now() - started));
      } catch {
        if (live) setMs(null);
      }
    };
    void sample();
    const timer = setInterval(() => void sample(), 10_000);
    return () => { live = false; clearInterval(timer); };
  }, [connected]);
  return connected ? ms : null;
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
  const [showIdle, setShowIdle] = useState(false);
  const inFlight = useRef(false);
  const input = useRef<HTMLInputElement>(null);

  const bots = state.bots.filter((bot) => !bot.hidden);
  const busy = bots.filter((bot) => bot.busy);
  const decisions = collectDecisions(bots);
  const lines = stream(bots);
  const selected = bots.find((bot) => bot.id === target) ?? bots.find((bot) => !bot.busy) ?? bots[0];
  const externalView = state.activeView !== "chat";
  const showChat = chat || externalView;
  const latency = useLatency(state.connected);
  const watched = bots.find((bot) => bot.id === target) ?? selected;
  // A roster is for processes that are doing something. Anything blocked or
  // running stays on screen; idle bots fold away so the stream below them is
  // still reachable on a phone with a large crew.
  const ranked = [...bots].sort((a, b) => rank(a) - rank(b));
  const active = ranked.filter((bot) => rank(bot) < 2);
  const idle = ranked.filter((bot) => rank(bot) === 2);
  const shown = showIdle ? ranked : [...active, ...idle.slice(0, Math.max(0, 3 - active.length))];
  const hidden = ranked.length - shown.length;
  useTick(busy.length > 0 || sending);

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

  // "@ad komut" targets a bot by name; otherwise the picked one runs it. A busy
  // bot is steered on its live thread instead of being forked onto a new one,
  // so a follow-up instruction lands where the work is.
  async function exec() {
    const raw = command.trim();
    if (inFlight.current) return;
    if (!raw) { setError("Önce bir komut yaz"); return; }
    if (!state.connected) { setError("Host bağlı değil. MausCrew açık olmalı."); return; }

    let bot = selected;
    let text = raw;
    if (raw.startsWith("@")) {
      const [name, ...rest] = raw.split(" ");
      const wanted = name.slice(1).toLowerCase();
      const matched = bots.find((item) => tag(item.name).startsWith(wanted));
      if (!matched) { setError(`@${wanted} adında bot yok`); return; }
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
            <ArrowLeft size={13} /> [GERİ]
          </button>
          <span className={state.connected ? "mz-on" : "mz-off"}>HOST: {state.connected ? "ONLINE" : "OFFLINE"}</span>
        </header>
        <div className="mobile-workspace">{children}</div>
      </div>
    );
  }

  if (pane === "settings") {
    return (
      <div className="mobile-dashboard mz">
        <header className="mz-bar">
          <button className="mz-link" onClick={() => setPane("console")}><ArrowLeft size={13} /> [KONSOL]</button>
          <span className="mz-dim">CONFIG</span>
        </header>
        <div className="mz-scroll">
          <MobileLayoutPicker />
          <p className="mz-rule"><span>-- SYSTEM</span><i /></p>
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
        <span className="mz-brand">[MAUSCREW::REMOTE]</span>
        <span className="mz-bar-end">
          <span className={state.connected ? "mz-on" : "mz-off"}>HOST: {state.connected ? "ONLINE" : "OFFLINE"}</span>
          <button className="mz-link" onClick={() => setPane("settings")}>[CFG]</button>
        </span>
      </header>

      <div className="mz-scroll">
        <div className="mz-counters">
          <div>
            <span>ACTIVE</span>
            <strong>{busy.length} BOTS</strong>
          </div>
          <div>
            <span>AWAITING</span>
            <strong className={decisions.length ? "mz-warn" : "mz-dim"}>{decisions.length} REQ</strong>
          </div>
          <div>
            <span>LATENCY</span>
            <strong className={latency === null ? "mz-dim" : "mz-on"}>{latency === null ? "--" : `${latency}ms`}</strong>
          </div>
        </div>

        <p className="mz-rule"><span>-- PROCESS_ROSTER</span><i /></p>
        {!bots.length && <p className="mz-dim mz-empty">henüz bot yok. [CFG] menüsünden ekle.</p>}
        {shown.map((bot) => {
          const pending = decisions.filter((item) => item.bot.id === bot.id);
          const waits = pending.length > 0 || botWaiting(bot);
          const at = lastAt(bot);
          const status = waits ? "[WAIT_PROMPT]" : bot.busy ? `[BUSY: ${at ? elapsed(at) : "--"}]` : "[IDLE]";
          return (
            <div className={`mz-proc is-${waits ? "wait" : bot.busy ? "run" : "idle"}`} key={bot.id}>
              <button className="mz-proc-open" onClick={() => openChat(bot.id)}>
                <span className="mz-proc-top">
                  <span className="mz-proc-name">&gt; {proc(bot.name)}</span>
                  <span className="mz-proc-state">{status}</span>
                </span>
                <span className="mz-proc-sub">
                  {waits && pending[0]
                    ? `needs: ${pending[0].title.toLowerCase()}${pending[0].tool ? ` — ${pending[0].tool}` : ""}`
                    : bot.busy
                      ? currentActivity(bot) || taskTitle(bot)
                      : taskTitle(bot)}
                </span>
              </button>
              {pending[0] && (() => {
                const item = pending[0];
                const submitting = state.pendingDecisions[`${item.bot.threadId}:${item.requestId}`];
                if (item.detail) {
                  return (
                    <>
                      <pre className="mz-proc-detail">{item.detail}</pre>
                      <div className="mz-proc-actions">{actions(item, submitting)}</div>
                    </>
                  );
                }
                return <div className="mz-proc-actions">{actions(item, submitting)}</div>;
              })()}
            </div>
          );
        })}

        {hidden > 0 && (
          <button className="mz-more" onClick={() => setShowIdle(true)}>[+{hidden} IDLE]</button>
        )}
        {showIdle && idle.length > 0 && (
          <button className="mz-more" onClick={() => setShowIdle(false)}>[- BOŞTAKİLERİ GİZLE]</button>
        )}

        <p className="mz-rule mz-rule-plain"><span># LIVE STREAM:</span></p>
        <div className="mz-stream">
          {!lines.length && <p className="mz-dim">henüz kayıt yok.</p>}
          {lines.map((entry, index) => (
            <p key={entry.key} className={`mz-line${index === lines.length - 1 ? " is-last" : ""} is-${entry.tone}`}>
              <span className="mz-time">[{clock(entry.at)}]</span>
              <span className="mz-who">{entry.who}:</span>
              <span>{entry.text}</span>
            </p>
          ))}
          <p className="mz-cursor">&gt; cursor waiting…</p>
        </div>
      </div>

      {error && <p className="mz-error" role="alert">{error}</p>}
      <footer className="mz-footer">
        {watched && (
          <p className="mz-status" role="status" aria-live="polite">
            <span className="mz-status-name">&gt; {proc(watched.name)}</span>
            {sending ? (
              <span className="mz-status-state mz-on">[TX…]</span>
            ) : (
              <span className={`mz-status-state ${botWaiting(watched) ? "mz-warn" : watched.busy ? "mz-on" : "mz-dim"}`}>
                {botWaiting(watched)
                  ? "[WAIT_PROMPT]"
                  : watched.busy
                    ? `[BUSY: ${lastAt(watched) ? elapsed(lastAt(watched)!) : "--"}]`
                    : "[IDLE]"}
              </span>
            )}
            <span className="mz-status-text">
              {sending
                ? "komut gönderiliyor"
                : watched.busy
                  ? currentActivity(watched) || "çalışıyor"
                  : lastReply(watched) || taskTitle(watched)}
            </span>
          </p>
        )}
        <form className="mz-prompt" onSubmit={(event) => { event.preventDefault(); void exec(); }}>
          <span aria-hidden>&gt;</span>
          <label className="mz-sr" htmlFor="mz-command">Komut</label>
          <input
            ref={input}
            id="mz-command"
            value={command}
            autoComplete="off"
            disabled={sending || !bots.length}
            placeholder={selected ? `@${tag(selected.name)} yeni görev…` : "önce bot ekle"}
            onChange={(event) => { setCommand(event.target.value); setError(""); }}
          />
          <button type="submit" className="mz-exec" disabled={sending || !bots.length}>{sending ? "TX…" : "EXEC"}</button>
        </form>
        {busy.length > 0 && (
          <div className="mz-abort">
            <button onClick={abort} className={confirmAbort ? "mz-abort-armed" : ""}>
              {confirmAbort ? `[■ ${busy.length} PROSESİ DURDUR]` : "[■ ABORT]"}
            </button>
            {confirmAbort && <button className="mz-link" onClick={() => setConfirmAbort(false)}>[vazgeç]</button>}
          </div>
        )}
      </footer>
    </div>
  );

  function actions(item: MobileDecision, submitting: string | undefined) {
    if (item.kind === "approval") {
      return (
        <>
          <button className="mz-allow" disabled={Boolean(submitting) || !state.connected} onClick={() => decide(item, "allow")}>
            {submitting === "allow" ? "ALLOWING…" : "ALLOW"}
          </button>
          <button className="mz-deny" disabled={Boolean(submitting)} onClick={() => decide(item, "deny")}>
            {submitting === "deny" ? "DENYING…" : "DENY"}
          </button>
        </>
      );
    }
    return item.options.map((option) => (
      <button
        key={option}
        className="mz-allow"
        disabled={Boolean(submitting) || !state.connected}
        onClick={() => dispatch({ type: "answerCard", botId: item.bot.id, messageId: item.messageId, answer: option })}
      >
        {option.toUpperCase()}
      </button>
    ));
  }
}
