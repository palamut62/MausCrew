// Browser control on this machine.
//
// Off by default, and deliberately so. It needs a separate install, most bots
// never open a browser, and a bot that can drive a real browser on the user's
// own computer is a bigger step than one that can only look at a screenshot.
import { useCallback, useEffect, useState } from "react";
import { ArrowClockwise, LinkSimple, X } from "@phosphor-icons/react";
import { Spin } from "./Spin";
import { api, useStore } from "@/state/store";
import { confirmDialog } from "@/lib/confirm";

interface ProfileStatus {
  profilePath: string;
  exists: boolean;
  signingIn: boolean;
  lastSeen: { origins: string[]; at: number } | null;
  problem?: string;
}

/**
 * Signing MausCrew's browser into a site before a bot needs it.
 *
 * The isolated profile is what keeps a bot out of the user's everyday Chrome;
 * the cost is that it starts signed into nothing, so the first visit to any
 * site used to be a bot stopping at a login wall. This opens that same
 * profile as an ordinary window with nobody driving it.
 *
 * Hidden while an explicit CDP session is attached: that browser is the
 * user's own and already has their sessions.
 */
function ProfileSignIn() {
  const { dispatch } = useStore();
  const [status, setStatus] = useState<ProfileStatus | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setStatus((await api("/api/browser-profile")) as ProfileStatus);
    } catch {
      /* desktop-only endpoint, or the harness is restarting */
    }
  }, []);

  useEffect(() => {
    void refresh();
    // Only while a window is open: the snapshot lands when it closes, and
    // polling a static answer forever is noise.
    const timer = window.setInterval(() => void refresh(), 3000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const post = async (action: "sign-in" | "cancel" | "forget", body: Record<string, unknown> = {}) => {
    setBusy(true);
    try {
      setStatus((await api(`/api/browser-profile/${action}`, {
        method: "POST",
        body: JSON.stringify(body),
      })) as ProfileStatus);
    } catch (error) {
      dispatch({ type: "error", message: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  };

  if (!status) return null;
  const sites = status.lastSeen?.origins ?? [];

  return (
    <div className="mt-3 border-t border-hairline pt-3">
      <div className="text-[12.5px] text-ink">Sign in ahead of time</div>
      <div className="mt-0.5 text-[11.5px] leading-[1.5] text-ink-secondary">
        Opens MausCrew's own browser profile as a normal window, with nothing driving it. Sign in there once and
        every bot that uses this browser stays signed in — instead of stopping at the login wall mid-task.
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && url.trim()) void post("sign-in", { url: url.trim() });
          }}
          placeholder="https://example.com/login"
          className="min-w-0 flex-1 rounded-lg border border-hairline bg-panel px-3 py-2 text-[12px] text-ink outline-none placeholder:text-ink-secondary/60"
        />
        {status.signingIn ? (
          <button
            disabled={busy}
            onClick={() => void post("cancel")}
            className="flex items-center gap-1.5 rounded-lg border border-hairline px-2.5 py-1.5 text-[11.5px] text-ink-secondary hover:bg-raised hover:text-ink disabled:opacity-40"
          >
            <X size={12} /> Close window
          </button>
        ) : (
          <button
            disabled={busy || !url.trim()}
            onClick={() => void post("sign-in", { url: url.trim() })}
            className="rounded-lg bg-accent px-3 py-1.5 text-[11.5px] font-semibold text-app disabled:opacity-40"
          >
            Open browser
          </button>
        )}
      </div>
      {status.signingIn && (
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-raised px-3 py-2 text-[11px] text-ink-secondary">
          <Spin size={12} weight="fill" /> The window is open. Sign in, then close it — what it keeps is listed here.
        </div>
      )}
      {sites.length > 0 && (
        <div className="mt-2">
          <div className="text-[11px] text-ink-secondary">
            Signed in as of {new Date(status.lastSeen!.at).toLocaleString()} — {sites.length} site{sites.length === 1 ? "" : "s"}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {sites.slice(0, 24).map((site) => (
              <span key={site} className="rounded-md bg-raised px-2 py-0.5 font-mono text-[10.5px] text-ink-secondary">{site}</span>
            ))}
            {sites.length > 24 && <span className="text-[10.5px] text-ink-secondary">+{sites.length - 24} more</span>}
          </div>
        </div>
      )}
      {status.problem && (
        <div className="mt-2 rounded-lg bg-danger/10 px-3 py-2 text-[11px] text-danger">{status.problem}</div>
      )}
      {status.exists && (
        <button
          disabled={busy || status.signingIn}
          onClick={async () => {
            if (await confirmDialog({ title: "Sign this browser out of everything?", message: "Every session in MausCrew's profile is deleted.", confirmLabel: "Sign out", danger: true })) {
              void post("forget");
            }
          }}
          className="mt-2 text-[11px] text-danger hover:underline disabled:opacity-40"
        >
          Sign out of everything
        </button>
      )}
    </div>
  );
}

export function PcBrowser() {
  const { state, dispatch } = useStore();
  const saved = state.config?.pcBrowser;
  const [busy, setBusy] = useState(false);
  const [sessions, setSessions] = useState<Array<{ endpoint: string; browser: string; tabs: Array<{ id: string; title: string; url: string }> }>>([]);
  const [discovered, setDiscovered] = useState(false);

  const patch = async (next: { enabled?: boolean; headless?: boolean; cdpEndpoint?: string }) => {
    setBusy(true);
    try {
      const merged = {
        enabled: saved?.enabled ?? false,
        headless: saved?.headless ?? false,
        cdpEndpoint: saved?.cdpEndpoint ?? "",
        ...next,
      };
      await api("/api/config", { method: "PATCH", body: JSON.stringify({ pcBrowser: merged }) });
      const config = (await api("/api/config")) as typeof state.config;
      if (config) dispatch({ type: "configStatus", config });
    } catch (error) {
      dispatch({ type: "error", message: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  };

  const discover = async () => {
    setBusy(true);
    try {
      const result = await api("/api/browser-sessions");
      setSessions(result.sessions ?? []);
      setDiscovered(true);
    } catch (error) {
      dispatch({ type: "error", message: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-hairline bg-inset p-3.5">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={saved?.enabled ?? false}
          disabled={busy}
          onChange={(event) => void patch({ enabled: event.target.checked })}
          className="mt-0.5 size-4 shrink-0 accent-accent"
        />
        <span className="min-w-0">
          <span className="flex items-center gap-2 text-[13px] font-medium text-ink">
            Let bots use a browser on this computer
            {busy && <Spin size={12} weight="fill" />}
          </span>
          <span className="mt-1 block text-[12px] leading-[1.5] text-ink-secondary">
            Real browser control rather than clicking pixels. Use MausCrew's isolated profile, or
            explicitly attach a Chromium session that you launched with remote debugging.
          </span>
          <span className="mt-1.5 block text-[11.5px] leading-[1.5] text-ink-secondary">
            Needs Playwright, which is not bundled:{" "}
            <code className="rounded bg-raised px-1.5 py-0.5">npm install -g playwright</code> then{" "}
            <code className="rounded bg-raised px-1.5 py-0.5">npx playwright install chromium</code>
          </span>
        </span>
      </label>

      {saved?.enabled && (
        <div className="mt-3 border-t border-hairline pt-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[12.5px] text-ink">Browser session</div>
              <div className="mt-0.5 text-[11.5px] text-ink-secondary">
                {saved.cdpEndpoint ? `Attached to ${saved.cdpEndpoint}` : "Using MausCrew's isolated profile"}
              </div>
            </div>
            <div className="flex gap-2">
              {saved.cdpEndpoint && <button disabled={busy} onClick={() => void patch({ cdpEndpoint: "" })} className="flex items-center gap-1.5 rounded-lg border border-hairline px-2.5 py-1.5 text-[11px] text-ink-secondary hover:bg-raised hover:text-ink"><X size={12} />Detach</button>}
              <button disabled={busy} onClick={() => void discover()} className="flex items-center gap-1.5 rounded-lg border border-hairline px-2.5 py-1.5 text-[11px] text-ink-secondary hover:bg-raised hover:text-ink"><ArrowClockwise size={12} weight="bold" />Discover</button>
            </div>
          </div>
          {discovered && (
            <div className="mt-2 space-y-2">
              {!sessions.length && <div className="rounded-lg bg-raised px-3 py-2 text-[11px] leading-relaxed text-ink-secondary">No explicit localhost browser session was found on ports 9222, 9223, 9229, or 9333. MausCrew will not scrape a normal browser profile.</div>}
              {sessions.map((session) => (
                <button key={session.endpoint} disabled={busy} onClick={() => void patch({ enabled: true, headless: false, cdpEndpoint: session.endpoint })} className="w-full rounded-lg border border-hairline bg-panel px-3 py-2 text-left hover:bg-raised">
                  <span className="flex items-center gap-2 text-[11.5px] font-medium text-ink"><LinkSimple size={13} />{session.browser}</span>
                  <span className="mt-1 block truncate text-[10.5px] text-ink-secondary">{session.tabs.length ? session.tabs.map((tab) => tab.title || tab.url).slice(0, 3).join(" - ") : "No open page tabs"}</span>
                </button>
              ))}
            </div>
          )}
          {!saved.cdpEndpoint && <ProfileSignIn />}
          <label className="mt-3 flex items-start gap-3">
          <input
            type="checkbox"
            checked={saved?.headless ?? false}
            disabled={busy}
            onChange={(event) => void patch({ headless: event.target.checked })}
            className="mt-0.5 size-4 shrink-0 accent-accent"
          />
          <span className="min-w-0">
            <span className="block text-[12.5px] text-ink">Run it hidden</span>
            <span className="mt-0.5 block text-[11.5px] leading-[1.5] text-ink-secondary">
              By default the window is visible, so you can watch what a bot is doing and take over
              when it hits a sign-in. Hiding it is faster and quieter, but you lose both.
            </span>
          </span>
          </label>
          {saved.cdpEndpoint && <div className="mt-3 rounded-lg border border-warning/25 bg-warning/5 px-3 py-2 text-[11px] leading-relaxed text-ink-secondary">The attached session may contain signed-in tabs. Bots are instructed to stay inside task-relevant tabs, and you can interrupt them with Take control in the live work card.</div>}
        </div>
      )}
    </div>
  );
}
