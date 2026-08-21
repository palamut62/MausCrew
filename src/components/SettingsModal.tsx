// App settings, as a real modal with sections rather than one long panel.
// Per-bot settings (persona, model, computer) stay in SettingsPanel — this
// is the stuff shared by every bot: who you are, your keys, and the
// machine your bots can borrow.
import { useEffect, useRef, useState } from "react";
import { DeviceMobile, Key, Monitor, ShieldCheck, SpeakerHigh, User, X } from "@phosphor-icons/react";
import { useStore, type AppSettingsSection } from "@/state/store";
import { ApiKeyRow, DeepSeekOptions } from "./ApiKeys";
import { ClaudeGateways } from "./ClaudeGateways";
import { useUpdaterState } from "@/lib/updater";
import { LocalComputerSection } from "./LocalComputerSection";
import { Card } from "./SettingsPrimitives";
import { VoiceSettings } from "./VoiceSettings";
import { cn } from "@/lib/cn";
import { RemoteAccessSection } from "./RemoteAccessSection";
import { SecuritySection } from "./SecuritySection";
import { AguiAgents } from "./AguiAgents";
import { McpServers } from "./McpServers";

const SECTIONS: Array<{ id: AppSettingsSection; label: string; icon: typeof User }> = [
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
    setName(state.config?.profile?.name ?? "");
    setEmail(state.config?.profile?.email ?? "");
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

function UpdatesRow() {
  const s = useUpdaterState();
  if (!window.mauscrew?.updater) return null;
  const updater = window.mauscrew.updater;
  const label =
    s?.status === "checking"
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
      <button
        onClick={() => {
          if (s?.status === "available") return void updater.download();
          if (s?.status === "downloaded") return void updater.install();
          void updater.check();
        }}
        disabled={s?.status === "checking" || s?.status === "downloading"}
        className="rounded-lg border border-hairline px-3 py-1.5 text-[13px] text-ink hover:bg-raised disabled:opacity-40"
      >
        {s?.status === "available"
          ? "Download"
          : s?.status === "downloaded"
            ? "Restart and install"
            : "Check for updates"}
      </button>
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
      onMouseDown={(e) => e.target === e.currentTarget && dispatch({ type: "toggleAppSettings", open: false })}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-settings-title"
        tabIndex={-1}
        className="flex h-[560px] w-full max-w-[860px] overflow-hidden rounded-xl border border-hairline bg-panel outline-none max-md:h-full max-md:flex-col max-md:rounded-none"
      >
        {/* section nav */}
        <nav className="flex w-[190px] shrink-0 flex-col gap-0.5 border-r border-hairline p-3 max-md:w-full max-md:flex-row max-md:overflow-x-auto max-md:border-r-0 max-md:border-b">
          <div id="app-settings-title" className="px-2 pb-2 pt-1 text-[15px] font-semibold text-ink max-md:hidden">
            Settings
          </div>
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => dispatch({ type: "toggleAppSettings", open: true, section: id })}
              aria-current={section === id ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[14px]",
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
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-[15px] font-semibold text-ink">
              {SECTIONS.find((s) => s.id === section)?.label}
            </span>
            <button
              onClick={() => dispatch({ type: "toggleAppSettings", open: false })}
              aria-label="Close settings"
              className="rounded-md p-1 text-ink-secondary hover:bg-raised hover:text-ink"
            >
              <X size={18} weight="bold" />
            </button>
          </div>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 pb-5">
            {section === "general" && (
              <>
                <Card title="Profile" subtitle="Shown in the sidebar. Saved as you go.">
                  <ProfileFields />
                </Card>
                <UpdatesRow />
              </>
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
              </Card>
            )}

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
