import { useEffect, useState } from "react";
import { ArrowClockwise, WifiSlash } from "@phosphor-icons/react";
import { useStore } from "@/state/store";

/** An EventSource retries by itself within a second or two, and saying
 * "disconnected" for that is noise. Past this, the gap is real — and on a
 * phone it is the difference between "the bot is thinking" and "nothing has
 * reached this screen for a while", which the user otherwise cannot tell
 * apart. */
const GRACE_MS = 3_000;

export function ConnectionBanner() {
  const { state, reconnectStream } = useStore();
  const since = state.disconnectedSince;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (since === null) {
      setVisible(false);
      return;
    }
    // Waiting out the REMAINDER of the grace period, not a fresh one: a
    // reconnect attempt that fails must not push the banner back out of view.
    const timer = setTimeout(() => setVisible(true), Math.max(0, GRACE_MS - (Date.now() - since)));
    return () => clearTimeout(timer);
  }, [since]);

  if (!visible) return null;

  return (
    <div
      role="status"
      className="flex items-center gap-2 border-b border-warning/30 bg-warning/10 px-4 py-2 text-[12.5px] text-warning [padding-top:max(0.5rem,env(safe-area-inset-top))]"
    >
      <WifiSlash size={15} weight="bold" className="shrink-0" />
      <span className="min-w-0 flex-1">
        Disconnected from the agent server — reconnecting. Anything you send now is not delivered.
      </span>
      <button
        type="button"
        onClick={reconnectStream}
        className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-md border border-warning/40 px-2.5 text-[12.5px] font-medium hover:bg-warning/15"
      >
        <ArrowClockwise size={14} weight="bold" />
        Try again
      </button>
    </div>
  );
}
