// Persistent sidebar update card, driven by the preload's updater bridge.
// It stays out of the way while idle/checking and appears only when the user
// can act on an update (or when a manual attempt needs retrying).
import { useEffect, useState } from "react";
import { Spin } from "./Spin";
import { ArrowClockwise, ArrowLineDown, Sparkle } from "@phosphor-icons/react";
import { useUpdaterState } from "@/lib/updater";
import { cn } from "@/lib/cn";

// The one action button in the card. Disabled drops the accent fill for the
// flat raised grey — the "I heard you" the click needs while the main process
// gets going.
const primaryAction =
  "flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent py-1.5 text-[13px] font-medium text-app transition-colors disabled:cursor-default disabled:bg-raised disabled:text-ink-secondary";

// electron-updater surfaces failures as a whole HTTP dump — status line,
// every response header, stack trace. That is unreadable in a 300px popup,
// so name the two cases that actually happen and clip anything else to its
// first line.
function friendlyError(message?: string): string {
  if (!message) return "Something went wrong.";
  if (/cannot find .*\.yml|404/i.test(message))
    return "No update has been published for this platform yet.";
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|net::/i.test(message))
    return "Couldn't reach the update server.";
  return message.split("\n")[0].slice(0, 140);
}

export function SidebarUpdateCard() {
  const s = useUpdaterState();
  // A click has to go renderer → main → broadcast before the real status
  // arrives. Latch the pressed button as busy on the same frame so it greys
  // out immediately; the incoming status clears the latch.
  const [pending, setPending] = useState<"download" | "install" | "check" | null>(null);
  const status = s?.status;
  useEffect(() => queueMicrotask(() => setPending(null)), [status]);

  if (!s || s.status === "idle" || s.status === "checking") return null;
  const updater = window.mauscrew!.updater!;

  // while busy the card owns the moment: no dismissing, no second click
  const installing = s.status === "installing";
  const busy = s.status === "downloading" || installing;

  const title =
    s.status === "available"
      ? `MausCrew ${s.version} is available`
      : s.status === "downloading"
        ? `Downloading ${s.version ?? "update"}…`
        : s.status === "downloaded"
          ? `${s.version} is ready`
          : installing
            ? "Restarting to update…"
            : "Update check failed";
  const subtitle =
    s.status === "available"
      ? "A newer version is ready to download."
      : s.status === "downloading"
        ? // no percent yet means the transfer hasn't reported in — don't imply 0
          s.percent == null
          ? "Starting download…"
          : `${Math.round(s.percent)}%`
        : s.status === "downloaded"
          ? "Restart to finish updating."
          : installing
            ? "MausCrew will reopen in a moment."
            : friendlyError(s.message);

  return (
    <div className="mb-2 rounded-xl border border-accent/25 bg-accent/5 p-3">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-accent/15 text-accent">
          <Sparkle size={14} weight="bold" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-semibold text-ink">{title}</div>
          <div className="mt-0.5 truncate text-[12.5px] text-ink-secondary" title={subtitle}>
            {subtitle}
          </div>
        </div>
      </div>

      {s.status === "downloading" && (
        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-raised">
          <div
            className={cn(
              "h-full rounded-full bg-accent transition-[width]",
              // before the first progress report, a sliver that breathes beats
              // a zero-width bar that looks stalled
              s.percent == null && "w-1/4 animate-pulse",
            )}
            style={s.percent == null ? undefined : { width: `${Math.min(100, Math.max(0, s.percent))}%` }}
          />
        </div>
      )}

      {installing && (
        <div className="mt-2.5 flex gap-2">
          <button
            disabled
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-raised py-1.5 text-[13px] font-medium text-ink-secondary"
          >
            <Spin size={13} weight="fill" /> Restarting…
          </button>
        </div>
      )}

      {!busy && (
        <div className="mt-2.5 flex gap-2">
          {s.status === "available" && (
            <button
              onClick={() => {
                setPending("download");
                void updater.download();
              }}
              disabled={pending !== null}
              className={primaryAction}
            >
              {pending === "download" ? (
                <>
                  <Spin size={13} weight="fill" /> Starting…
                </>
              ) : (
                <>
                  <ArrowLineDown size={13} weight="bold" /> Download
                </>
              )}
            </button>
          )}
          {s.status === "downloaded" && (
            <button
              onClick={() => {
                setPending("install");
                void updater.install();
              }}
              disabled={pending !== null}
              className={primaryAction}
            >
              {pending === "install" ? (
                <>
                  <Spin size={13} weight="fill" /> Restarting…
                </>
              ) : (
                <>
                  <ArrowClockwise size={13} weight="bold" /> Restart to update
                </>
              )}
            </button>
          )}
          {s.status === "error" && (
            <button
              onClick={() => {
                setPending("check");
                void updater.check();
              }}
              disabled={pending !== null}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-raised py-1.5 text-[13px] text-ink hover:bg-raised-hover disabled:text-ink-secondary disabled:hover:bg-raised"
            >
              {pending === "check" ? (
                <>
                  <Spin size={13} weight="fill" /> Checking…
                </>
              ) : (
                "Try again"
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
