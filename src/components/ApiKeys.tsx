// Paste-a-key rows for PUT /api/config. The server persists to
// ~/.mauscrew/config.json and hot-reloads the provider fleet; secrets
// are write-only — GET /api/config returns configured flags, never values.
import { useEffect, useId, useRef, useState } from "react";
import { ArrowSquareOut, Check, Question, Spinner, Warning } from "@phosphor-icons/react";
import { api, useStore, type ConfigStatus } from "@/state/store";
import { useDesktopCapabilities } from "./DesktopCapabilities";
import { cn } from "@/lib/cn";

export type ConfigSection = "composio" | "box" | "opencodeGo" | "deepseekHarness";

const SECTIONS: Record<
  ConfigSection,
  { body: (value: string) => unknown; flag: (config: ConfigStatus) => boolean }
> = {
  composio: {
    body: (v) => ({ composio: { apiKey: v } }),
    flag: (c) => c.composio.configured,
  },
  box: { body: (v) => ({ box: { token: v } }), flag: (c) => c.box.configured },
  opencodeGo: { body: (v) => ({ opencodeGo: { apiKey: v } }), flag: (c) => c.opencodeGo?.configured ?? false },
  deepseekHarness: {
    body: (v) => ({ deepseekHarness: { apiKey: v } }),
    flag: (c) => c.deepseekHarness?.configured ?? false,
  },
};

const CREDENTIALS: Record<
  ConfigSection,
  {
    label: string;
    placeholder: string;
    description: string;
    href: string;
    linkLabel: string;
    optional: boolean;
    warning?: string;
  }
> = {
  composio: {
    label: "Composio project key",
    placeholder: "ak_…",
    description: "Connect Gmail, GitHub, Slack, Notion, and other apps through your own Composio project.",
    href: "https://dashboard.composio.dev",
    linkLabel: "Create or copy a project key",
    optional: true,
  },
  box: {
    label: "Box API key",
    placeholder: "Paste your Box API key",
    description: "Give bots an isolated remote Linux computer with a desktop and terminal.",
    href: "https://docs.ascii.dev/box/api-keys",
    linkLabel: "Open Box API key guide",
    optional: true,
    warning: "Box is a paid service after its trial. Usage may incur charges.",
  },
  opencodeGo: {
    label: "OpenCode Go API key",
    placeholder: "Paste your OpenCode Go API key",
    description: "Run OpenCode Go models through the maintained OpenCode CLI and ACP.",
    href: "https://opencode.ai/docs/go/",
    linkLabel: "Open OpenCode Go setup guide",
    optional: true,
  },
  deepseekHarness: {
    label: "DeepSeek API key",
    placeholder: "sk-…",
    description:
      "Run DeepSeek Harness bots. Also needs the Python SDK installed — the bot shows what is missing until it is.",
    href: "https://platform.deepseek.com/api_keys",
    linkLabel: "Create or copy a DeepSeek API key",
    optional: true,
  },
};

function CredentialHelp({ section }: { section: ConfigSection }) {
  const credential = CREDENTIALS[section];
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverId = useId();

  useEffect(() => {
    if (!open) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative ml-auto">
      <button
        ref={buttonRef}
        type="button"
        aria-label={`About ${credential.label}`}
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => setOpen((current) => !current)}
        className="flex size-6 items-center justify-center rounded-md text-ink-secondary outline-none transition-colors hover:bg-raised hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/70"
      >
        <Question size={14} weight="bold" aria-hidden="true" />
      </button>
      {open && (
        <div
          id={popoverId}
          role="group"
          aria-label={`${credential.label} help`}
          className="animate-pop-in absolute right-0 z-30 mt-1.5 w-[270px] rounded-xl border border-hairline bg-panel p-3 text-left"
        >
          <div className="text-[12px] leading-[1.45] text-ink-secondary">{credential.description}</div>
          {credential.warning && (
            <div className="mt-2 flex gap-1.5 rounded-lg border border-warning/25 bg-warning/10 px-2 py-1.5 text-[11px] leading-[1.4] text-warning">
              <Warning size={13} weight="bold" className="mt-px shrink-0" aria-hidden="true" />
              <span>{credential.warning}</span>
            </div>
          )}
          <a
            href={credential.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="mt-2.5 flex items-center gap-1.5 text-[12px] font-medium text-accent hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
          >
            {credential.linkLabel}
            <ArrowSquareOut size={12} weight="bold" aria-hidden="true" />
          </a>
        </div>
      )}
    </div>
  );
}

export function ApiKeyRow({
  section,
  onSaved,
}: {
  section: ConfigSection;
  /** Called after a successful save with the section's new configured flag. */
  onSaved?: (configured: boolean) => void;
}) {
  const { state, dispatch } = useStore();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const configured = state.config ? SECTIONS[section].flag(state.config) : false;
  const clearing = !value.trim() && configured;
  const credential = CREDENTIALS[section];
  // A key kept in the OS credential store that can no longer be decrypted
  // reads as "never entered" everywhere else in the UI. Say what actually
  // happened instead, next to the field that fixes it.
  const { capabilities } = useDesktopCapabilities();
  const storeLost = capabilities?.credentialStore?.readable === false && !configured;

  const save = () => {
    if (saving || (!value.trim() && !configured)) return;
    setSaving(true);
    setError(null);
    const request = section === "composio" && window.mauscrew?.setCredential
      ? window.mauscrew.setCredential("composioApiKey", value.trim())
      : api("/api/config", {
          method: "PUT",
          body: JSON.stringify(SECTIONS[section].body(value.trim())),
        });
    request
      .then((status: ConfigStatus) => {
        dispatch({ type: "configStatus", config: status });
        setValue("");
        onSaved?.(SECTIONS[section].flag(status));
      })
      .catch((e) => setError(e.message))
      .finally(() => setSaving(false));
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2 text-[13px] text-ink-secondary">
        <span className={cn("size-1.5 rounded-full", configured ? "bg-success" : "bg-raised-hover")} />
        <span>{credential.label}</span>
        {credential.optional && (
          <span className="rounded bg-raised px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide text-ink-secondary">
            Optional
          </span>
        )}
        {configured && <span className="text-[11px] text-success">Connected</span>}
        <CredentialHelp section={section} />
      </div>
      <div className="flex gap-2">
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder={configured ? "••••••••  (paste to replace)" : credential.placeholder}
          aria-label={credential.label}
          autoComplete="off"
          className="w-full rounded-lg border border-hairline bg-inset px-3 py-2 text-[13px] text-ink placeholder:text-ink-secondary focus:border-hairline focus:outline-none"
        />
        <button
          onClick={save}
          disabled={saving || (!value.trim() && !configured)}
          className={cn(
            "flex w-[72px] shrink-0 items-center justify-center gap-1.5 rounded-lg py-2 text-[13px]",
            clearing
              ? "bg-raised text-danger hover:bg-raised-hover"
              : "bg-raised text-ink hover:bg-raised-hover",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
          title={clearing ? "Remove the saved key" : "Save"}
        >
          {saving ? <Spinner size={13} weight="fill" className="animate-spin" /> : clearing ? "Clear" : <><Check size={13} weight="fill" />Save</>}
        </button>
      </div>
      {error && <div className="mt-1 text-[12px] text-danger">{error}</div>}
      {storeLost && !error && (
        <div role="status" className="mt-1.5 flex items-start gap-1.5 text-[12px] text-warning">
          <Warning size={13} weight="fill" className="mt-0.5 shrink-0" />
          <span>
            A key was saved here before but the operating system can no longer decrypt it — this
            happens when the app is reinstalled or renamed. Paste it once more to restore it.
          </span>
        </div>
      )}
    </div>
  );
}

/** DeepSeek settings that are not credentials: which endpoint the key is sent
 * to, and whether the runtime may report telemetry.
 *
 * Kept beside the key row rather than in a separate panel because the two
 * decisions are the same decision — §97 says the user must be told that a
 * custom base URL receives their API key, and that warning is only useful
 * next to the field that holds the key. */
export function DeepSeekOptions() {
  const { state, dispatch } = useStore();
  const saved = state.config?.deepseekHarness;
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const telemetryId = useId();
  const sandboxId = useId();
  const runtimeId = useId();
  const baseUrlId = useId();

  // null means "not edited yet", so a save elsewhere does not clobber typing
  const shown = baseUrl ?? saved?.baseUrl ?? "";
  const telemetry = saved?.telemetry ?? "off";
  const sandboxMode = saved?.sandboxMode ?? "workspace-write";
  const runtimeStrategy = saved?.runtimeStrategy ?? "bundled";

  const put = (body: Record<string, unknown>) => {
    setSaving(true);
    setError(null);
    api("/api/config", { method: "PUT", body: JSON.stringify({ deepseekHarness: body }) })
      .then((status: ConfigStatus) => {
        dispatch({ type: "configStatus", config: status });
        setBaseUrl(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setSaving(false));
  };

  // Advisory only — the server decides what is acceptable and answers 400.
  // This exists so the user reads the consequence before pressing Save, not
  // after.
  const trimmed = shown.trim();
  const custom = Boolean(trimmed) && !/^https:\/\/api\.deepseek\.com\/?$/i.test(trimmed);
  const plaintext = /^http:\/\//i.test(trimmed) && !/^http:\/\/(localhost|127\.0\.0\.1)\b/i.test(trimmed);

  return (
    <div className="mt-3 space-y-3">
      <div>
        <label htmlFor={baseUrlId} className="mb-1.5 block text-[13px] text-ink-secondary">
          DeepSeek endpoint
        </label>
        <div className="flex gap-2">
          <input
            id={baseUrlId}
            type="url"
            inputMode="url"
            value={shown}
            onChange={(e) => setBaseUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && put({ baseUrl: trimmed })}
            placeholder="https://api.deepseek.com (default)"
            autoComplete="off"
            className="w-full rounded-lg border border-hairline bg-inset px-3 py-2 text-[13px] text-ink placeholder:text-ink-secondary focus:border-hairline focus:outline-none"
          />
          <button
            onClick={() => put({ baseUrl: trimmed })}
            disabled={saving || (baseUrl === null)}
            className="flex w-[72px] shrink-0 items-center justify-center gap-1.5 rounded-lg bg-raised py-2 text-[13px] text-ink hover:bg-raised-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Spinner size={13} weight="fill" className="animate-spin" /> : <><Check size={13} weight="fill" />Save</>}
          </button>
        </div>
        {custom && (
          <div className="mt-1.5 flex gap-1.5 rounded-lg border border-warning/25 bg-warning/10 px-2 py-1.5 text-[11px] leading-[1.4] text-warning">
            <Warning size={13} weight="bold" className="mt-px shrink-0" aria-hidden="true" />
            <span>
              Your DeepSeek API key will be sent to this host{plaintext ? " over plain HTTP, unencrypted" : ""}. Only
              use an endpoint you trust.
            </span>
          </div>
        )}
      </div>

      <div>
        <label htmlFor={runtimeId} className="mb-1.5 block text-[13px] text-ink-secondary">
          Runtime installation
        </label>
        <select
          id={runtimeId}
          value={runtimeStrategy}
          disabled={saving}
          onChange={(e) => put({ runtimeStrategy: e.target.value })}
          className="w-full rounded-lg border border-hairline bg-inset px-3 py-2 text-[13px] text-ink focus:border-hairline focus:outline-none disabled:opacity-50"
        >
          <option value="system">System Python</option>
          <option value="managed">MausCrew managed venv</option>
          <option value="bundled">Bundled runtime (native transport)</option>
        </select>
        <div className="mt-1.5 text-[11px] leading-[1.45] text-ink-secondary">
          Managed uses <code className="font-mono">~/.mauscrew/runtimes/deepseek/venv</code>. Bundled starts the
          pinned wheel&rsquo;s single-file runtime directly; Python is used only to locate that executable.
        </div>
      </div>

      <div>
        <label htmlFor={sandboxId} className="mb-1.5 block text-[13px] text-ink-secondary">
          File sandbox
        </label>
        <select
          id={sandboxId}
          value={sandboxMode}
          disabled={saving}
          onChange={(e) => put({ sandboxMode: e.target.value })}
          className="w-full rounded-lg border border-hairline bg-inset px-3 py-2 text-[13px] text-ink focus:border-hairline focus:outline-none disabled:opacity-50"
        >
          <option value="read-only">Read only</option>
          <option value="workspace-write">Workspace write (default)</option>
          <option value="danger-full-access">Full file access</option>
        </select>
        <div className="mt-1.5 text-[11px] leading-[1.45] text-ink-secondary">
          The local DeepSeek sandbox fails closed if it cannot enforce this policy. Full file access still asks through
          MausCrew before mutating or high-risk tools run. Read-only and workspace-write keep the current runtime&rsquo;s
          unconfined local shell disabled; safe file edits use the sandboxed editor.
        </div>
        {sandboxMode === "danger-full-access" && (
          <div className="mt-1.5 flex gap-1.5 rounded-lg border border-warning/25 bg-warning/10 px-2 py-1.5 text-[11px] leading-[1.4] text-warning">
            <Warning size={13} weight="bold" className="mt-px shrink-0" aria-hidden="true" />
            <span>The runtime can modify files outside the workspace after you approve a tool. Use only when necessary.</span>
          </div>
        )}
      </div>

      <div>
        <label htmlFor={telemetryId} className="mb-1.5 block text-[13px] text-ink-secondary">
          DeepSeek telemetry
        </label>
        <select
          id={telemetryId}
          value={telemetry}
          disabled={saving}
          onChange={(e) => put({ telemetry: e.target.value })}
          className="w-full rounded-lg border border-hairline bg-inset px-3 py-2 text-[13px] text-ink focus:border-hairline focus:outline-none disabled:opacity-50"
        >
          <option value="off">Off — send nothing (default)</option>
          <option value="feedback-only">Feedback only</option>
          <option value="full">Full</option>
        </select>
        <div className="mt-1.5 text-[11px] leading-[1.45] text-ink-secondary">
          Off is enforced as a hard opt-out before the runtime loads. Note that DeepSeek may still send an anonymous
          user id with API requests, which this switch does not control.
        </div>
      </div>

      {error && <div className="text-[12px] text-danger">{error}</div>}
    </div>
  );
}

