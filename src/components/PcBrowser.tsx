// Browser control on this machine.
//
// Off by default, and deliberately so. It needs a separate install, most bots
// never open a browser, and a bot that can drive a real browser on the user's
// own computer is a bigger step than one that can only look at a screenshot.
import { useState } from "react";
import { Spin } from "./Spin";
import { api, useStore } from "@/state/store";

export function PcBrowser() {
  const { state, dispatch } = useStore();
  const saved = state.config?.pcBrowser;
  const [busy, setBusy] = useState(false);

  const patch = async (next: { enabled?: boolean; headless?: boolean }) => {
    setBusy(true);
    try {
      const merged = { enabled: saved?.enabled ?? false, headless: saved?.headless ?? false, ...next };
      await api("/api/config", { method: "PATCH", body: JSON.stringify({ pcBrowser: merged }) });
      const config = (await api("/api/config")) as typeof state.config;
      if (config) dispatch({ type: "configStatus", config });
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
            Real browser control rather than clicking pixels: it knows when a page has finished
            loading and what an element is, so a bot can work a form on a live site. It runs in
            MausCrew's own browser profile, never your everyday one, so a bot is only ever signed
            into what it signed into itself.
          </span>
          <span className="mt-1.5 block text-[11.5px] leading-[1.5] text-ink-secondary">
            Needs Playwright, which is not bundled:{" "}
            <code className="rounded bg-raised px-1.5 py-0.5">npm install -g playwright</code> then{" "}
            <code className="rounded bg-raised px-1.5 py-0.5">npx playwright install chromium</code>
          </span>
        </span>
      </label>

      {saved?.enabled && (
        <label className="mt-3 flex items-start gap-3 border-t border-hairline pt-3">
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
      )}
    </div>
  );
}
