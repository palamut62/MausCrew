import { SearchMessages } from "./SearchMessages";
// App settings, as a real modal with sections rather than one long panel.
// Per-bot settings (persona, model, computer) stay in SettingsPanel — this
// is the stuff shared by every bot: who you are, your keys, and the
// machine your bots can borrow.
import { useEffect, useRef, useState } from "react";
import { DeviceMobile, Key, Monitor, ShieldCheck, SpeakerHigh, User, X } from "@phosphor-icons/react";
import { api, useStore, type AppSettingsSection } from "@/state/store";
import { ApiKeyRow, DeepSeekOptions } from "./ApiKeys";
import { ClaudeGateways } from "./ClaudeGateways";
import { FallbackChain } from "./FallbackChain";
import { PcBrowser } from "./PcBrowser";
import { useUpdaterState } from "@/lib/updater";
import { LocalComputerSection } from "./LocalComputerSection";
import { Card } from "./SettingsPrimitives";
import { VoiceSettings } from "./VoiceSettings";
import { cn } from "@/lib/cn";
import { RemoteAccessSection } from "./RemoteAccessSection";
import { SecuritySection } from "./SecuritySection";
import { AguiAgents } from "./AguiAgents";
import { McpServers } from "./McpServers";
import { TelegramSettings } from "./TelegramSettings";
import { RecoveryCenter } from "./RecoveryCenter";
import { UsageLimits } from "./UsageLimits";

const SECTIONS: Array<{ id: AppSettingsSection; label: string; icon: typeof User }> = [
  { id: "search", label: "Mesajlarda ara", icon: Monitor },
  { id: "recovery", label: "Kurtarma", icon: ShieldCheck },
  { id: "usage", label: "Kullanım sınırları", icon: Monitor },
  { id: "general", label: "General", icon: User },
  { id: "connections", label: "Connections", icon: Key },
  { id: "computer", label: "Local VM", icon: Monitor },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "voice", label: "Voice", icon: SpeakerHigh },
  { id: "remote", label: "Mobile", icon: DeviceMobile },
];

/** Name + email, persisted to /api/config {profile} on blur. */
function ProfileFields() {
  const { state, dispatch } = useStore();
  const [name, setName] = useState(state.config?.profile?.name ?? "");
  const [email, setEmail] = useState(state.config?.profile?.email ?? "");
  useEffect(() => {
    queueMicrotask(() => {
      setName(state.config?.profile?.name ?? "");
      setEmail(state.config?.profile?.email ?? "");
    });
  }, [state.config?.profile?.name, state.config?.profile?.email]);

  const save = () => {
    void fetch("/api/config", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profile: { name: name.trim(), email: email.trim().toLowerCase() } }),
    })
      .then((r) => r.json())
      .then((config) => dispatch({ type: "configStatus", config }))
      .catch(() => {});
  };

  const inputClass =
    "w-full rounded-lg border border-hairline bg-inset px-3 py-2 text-[14px] text-ink placeholder:text-ink-secondary focus:border-hairline focus:outline-none";
  return (
    <div className="flex flex-col gap-3">
      <input value={name} onChange={(e) => setName(e.target.value)} onBlur={save} placeholder="Your name" className={inputClass} />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onBlur={save}
        placeholder="you@example.com"
        className={inputClass}
      />
    </div>
  );
}

/** The one place MausCrew sends anything about you off this machine, so it
 * gets a switch and a plain sentence rather than a buried default. */
function AnalyticsRow() {
  const { state, dispatch } = useStore();
  const analytics = state.config?.analytics;
  const enabled = analytics?.enabled ?? false;
  const locked = analytics?.locked ?? false;

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const toggle = () => {
    if (locked || saving) return;
    setSaving(true); setError("");
    void api("/api/config", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ analytics: { enabled: !enabled } }),
    })
      .then((config) => dispatch({ type: "configStatus", config }))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setSaving(false));
  };

  return (
    <Card
      title="Usage analytics"
      subtitle="A short list of product events (app opened, message sent, bot created) and the email you gave at first run. Never message text, never transcripts, never keys. Turning this off stops the analytics library from loading at all."
    >
      {error && <p role="alert" className="mb-2 text-xs text-danger">{error}</p>}
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1 text-[13px] text-ink-secondary">
          {locked
            ? "Disabled for this machine by MAUSCREW_DISABLE_ANALYTICS."
            : enabled
              ? "Sending product events; your submitted email may identify them."
              : "Usage analytics is off."}
        </div>
        <button
          role="switch"
          aria-checked={enabled}
          aria-label="Usage analytics"
          disabled={locked || saving}
          onClick={toggle}
          title={locked ? "MAUSCREW_DISABLE_ANALYTICS is set" : undefined}
          className={cn(
            "relative h-[26px] w-[44px] shrink-0 rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-40",
            enabled ? "bg-accent" : "bg-raised",
          )}
        >
          <span
            className={cn(
              "absolute top-[3px] size-5 rounded-sm bg-white transition-all",
              enabled ? "left-[21px]" : "left-[3px]",
            )}
          />
        </button>
      </div>
    </Card>
  );
}

function UpdatesRow() {
  const s = useUpdaterState();
  const updater = window.mauscrew?.updater;
  const label =
    !updater
      ? "Update checks are available in the desktop app."
      : s?.status === "checking"
      ? "Checking…"
      : s?.status === "available"
        ? `${s.version} available`
        : s?.status === "downloading"
          ? `Downloading ${Math.round(s.percent ?? 0)}%`
          : s?.status === "downloaded"
            ? `${s.version} ready — restart to apply`
            : s?.status === "error"
              ? `Check failed: ${s.message ?? "unknown error"}`
              : "You're on the latest version we know of.";
  return (
    <Card title="Updates" subtitle={label}>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-secondary">
            Installed version
          </div>
          <div className="mt-0.5 font-mono text-[14px] font-medium tabular-nums text-ink">
            MausCrew v{__APP_VERSION__}
          </div>
        </div>
        {updater && (
          <button
            onClick={() => {
              if (s?.status === "available") return void updater.download();
              if (s?.status === "downloaded") return void updater.install();
              void updater.check();
            }}
            disabled={s?.status === "checking" || s?.status === "downloading"}
            className="shrink-0 rounded-lg border border-hairline px-3 py-1.5 text-[13px] text-ink hover:bg-raised disabled:opacity-40"
          >
            {s?.status === "available"
              ? "Download"
              : s?.status === "downloaded"
                ? "Restart and install"
                : "Check for updates"}
          </button>
        )}
      </div>
    </Card>
  );
}

function StartupRow() {
  const startup = window.mauscrew?.startup;
  const [status, setStatus] = useState<{ available: boolean; enabled: boolean } | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let alive = true;
    void startup?.get().then((result) => alive && setStatus(result));
    return () => {
      alive = false;
    };
  }, [startup]);

  if (!startup || !status?.available) return null;
  const toggle = async () => {
    setPending(true);
    try {
      setStatus(await startup.set(!status.enabled));
    } finally {
      setPending(false);
    }
  };
  return (
    <Card
      title="Start at login"
      subtitle="Keep the local harness, routines, and notifications available whenever this PC is on. Closing the window still leaves MausCrew in the system tray."
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1 text-[13px] text-ink-secondary">
          {status.enabled ? "MausCrew starts when you sign in." : "MausCrew starts only when you open it."}
        </div>
        <button
          role="switch"
          aria-checked={status.enabled}
          aria-label="Start MausCrew at login"
          disabled={pending}
          onClick={() => void toggle()}
          className={cn(
            "relative h-[26px] w-[44px] shrink-0 rounded-md transition-colors disabled:opacity-40",
            status.enabled ? "bg-accent" : "bg-raised",
          )}
        >
          <span className={cn("absolute top-[3px] size-5 rounded-sm bg-white transition-all", status.enabled ? "left-[21px]" : "left-[3px]")} />
        </button>
      </div>
    </Card>
  );
}

function SharedWorkspaceRow() {
  const chooser = window.mauscrew?.chooseWorkspace;
  const [path, setPath] = useState("");
  const [savedPath, setSavedPath] = useState("");
  const [pending, setPending] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    void fetch("/api/shared-workspace")
      .then(async (response) => {
        if (!response.ok) throw new Error("Shared workspace is available only in the desktop app.");
        return response.json() as Promise<{ path?: string }>;
      })
      .then((result) => {
        if (!alive) return;
        const nextPath = result.path ?? "";
        setPath(nextPath);
        setSavedPath(nextPath);
      })
      .catch((cause) => alive && setError(cause instanceof Error ? cause.message : "Could not load workspace."))
      .finally(() => alive && setPending(false));
    return () => {
      alive = false;
    };
  }, []);

  if (!chooser) return null;

  const save = async (nextPath = path.trim()) => {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/shared-workspace", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: nextPath }),
      });
      const result = (await response.json()) as { path?: string; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not save workspace.");
      const saved = result.path ?? "";
      setPath(saved);
      setSavedPath(saved);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save workspace.");
    } finally {
      setPending(false);
    }
  };

  const choose = async () => {
    const selected = await chooser();
    if (selected) {
      setPath(selected);
      await save(selected);
    }
  };

  return (
    <Card
      title="Shared workspace"
      subtitle="Bots without a private workspace work in this local folder and can share files. A bot's private workspace always takes priority."
    >
      <div className="flex gap-2">
        <input
          aria-label="Shared workspace directory"
          value={path}
          onChange={(event) => setPath(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void save();
          }}
          placeholder="Choose a local folder"
          disabled={pending}
          className="min-w-0 flex-1 rounded-lg border border-hairline bg-inset px-3 py-2 text-[14px] text-ink placeholder:text-ink-secondary focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => void choose()}
          disabled={pending}
          className="rounded-lg border border-hairline px-3 py-2 text-[13px] text-ink hover:bg-raised disabled:opacity-40"
        >
          Choose
        </button>
        {path.trim() !== savedPath && (
          <button
            type="button"
            onClick={() => void save()}
            disabled={pending}
            className="rounded-lg bg-accent px-3 py-2 text-[13px] text-white disabled:opacity-40"
          >
            Save
          </button>
        )}
        {savedPath && (
          <button
            type="button"
            onClick={() => void save("")}
            disabled={pending}
            className="rounded-lg border border-hairline px-3 py-2 text-[13px] text-ink-secondary hover:bg-raised disabled:opacity-40"
          >
            Clear
          </button>
        )}
      </div>
      {error && <div role="alert" className="mt-2 text-[12px] text-danger">{error}</div>}
    </Card>
  );
}

export function SettingsModal() {
  const { state, dispatch } = useStore();
  const section = state.appSettingsSection;
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    dialog?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dispatch({ type: "toggleAppSettings", open: false });
        return;
      }
      if (event.key !== "Tab" || !dialog) return;

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previousFocus?.focus();
    };
  }, [dispatch]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-[2px] max-md:p-0 md:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && dispatch({ type: "toggleAppSettings", open: false })}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-settings-title"
        tabIndex={-1}
        className="animate-pop-in flex h-[calc(100dvh-3rem)] w-full max-w-[1100px] overflow-hidden rounded-2xl border border-hairline bg-panel shadow-[0_24px_80px_rgba(0,0,0,0.55)] outline-none max-md:h-full max-md:flex-col max-md:rounded-none"
      >
        {/* section nav */}
        {/* Below md this is a horizontal, scrollable tab strip. It claims the
            top inset itself: the dialog is `fixed`, so it is laid out against
            the viewport and never sees #root's safe-area padding. */}
        <nav className="flex w-[210px] shrink-0 flex-col gap-1 border-r border-hairline bg-card/35 p-3 max-md:w-full max-md:flex-row max-md:overflow-x-auto max-md:border-r-0 max-md:border-b max-md:pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div id="app-settings-title" className="px-2 pb-2 pt-1 text-[15px] font-semibold text-ink max-md:hidden">
            Settings
          </div>
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => dispatch({ type: "toggleAppSettings", open: true, section: id })}
              aria-current={section === id ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[14px]",
                // In the mobile tab strip a label must not be squeezed to a
                // vertical sliver by the tabs beside it.
                "max-md:min-h-[44px] max-md:shrink-0 max-md:whitespace-nowrap",
                section === id ? "bg-raised text-ink" : "text-ink-secondary hover:bg-raised/50 hover:text-ink",
              )}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
          <div className="mt-auto border-t border-hairline px-2 pt-3 text-[10.5px] leading-relaxed text-ink-secondary max-md:hidden">
            <div>Product Owner</div>
            <div className="font-medium text-ink">Umut Çelik</div>
            <div className="mt-1 flex gap-2">
              <a href="https://x.com/palamut62" target="_blank" rel="noreferrer" className="hover:text-ink hover:underline">
                X
              </a>
              <a href="https://github.com/palamut62" target="_blank" rel="noreferrer" className="hover:text-ink hover:underline">
                GitHub
              </a>
            </div>
          </div>
        </nav>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between px-8 pb-4 pt-7 max-md:px-5 max-md:pt-4">
            <span className="text-[18px] font-semibold text-ink">
              {SECTIONS.find((s) => s.id === section)?.label}
            </span>
            <button
              onClick={() => dispatch({ type: "toggleAppSettings", open: false })}
              aria-label="Close settings"
              className="-mr-2 flex size-10 shrink-0 items-center justify-center rounded-md text-ink-secondary hover:bg-raised hover:text-ink"
            >
              <X size={18} weight="bold" />
            </button>
          </div>

          <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-8 pb-8 max-md:px-5 max-md:pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            {section === "general" && (
              <>
                <Card title="Profile" subtitle="Shown in the sidebar. Saved as you go.">
                  <ProfileFields />
                </Card>
                <AnalyticsRow />
                <StartupRow />
                <SharedWorkspaceRow />
                <UpdatesRow />
              </>
            )}

            {section === "connections" && (
              <Card
                title="Telegram bot"
                subtitle="Send every MausCrew bot's results and action-needed alerts to one Telegram chat, labelled with that bot's profile."
              >
                <TelegramSettings />
              </Card>
            )}

            {section === "connections" && (
              <Card
                title="Keys"
                subtitle="Shared by all bots. Saving a key reloads providers instantly; keys are stored locally and never shown again."
              >
                <div className="flex flex-col gap-4">
                  <ApiKeyRow section="composio" />
                  <ApiKeyRow section="box" />
                  <ApiKeyRow section="opencodeGo" />
                  <div>
                    <ApiKeyRow section="deepseekHarness" />
                    {/* endpoint and telemetry belong to this key, so they sit
                        inside its row rather than as free-floating settings */}
                    <DeepSeekOptions />
                  </div>
                </div>
              </Card>
            )}

            {section === "connections" && (
              <Card
                title="Remote AG-UI agents"
                subtitle="Bring a LangGraph, CrewAI, Mastra, Pydantic AI, or custom AG-UI endpoint into MausCrew as a bot engine."
              >
                <AguiAgents />
              </Card>
            )}

            {section === "connections" && (
              <Card
                title="MCP servers"
                subtitle="Add local stdio tools, test their handshake, grant them to bots, and route calls through MausCrew approvals."
              >
                <McpServers />
              </Card>
            )}

            {section === "connections" && (
              <Card
                title="Claude gateways"
                subtitle="Run the Claude Code engine against another provider. Each gateway is its own engine in the model picker."
              >
                <ClaudeGateways />
                <FallbackChain />
                <PcBrowser />
              </Card>
            )}

            {section === "search" && <SearchMessages />}
            {section === "recovery" && <RecoveryCenter />}
            {section === "usage" && <UsageLimits />}
            {section === "voice" && <VoiceSettings />}

            {section === "computer" && <LocalComputerSection />}
            {section === "security" && <SecuritySection />}
            {section === "remote" && <RemoteAccessSection />}
          </div>
        </div>
      </div>
    </div>
  );
}
