import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/cn";
import { currentConfirm, subscribeConfirm } from "@/lib/confirm";

/** Renders the pending confirmDialog() request above every other layer. */
export function ConfirmHost() {
  const request = useSyncExternalStore(subscribeConfirm, currentConfirm);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!request) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Cancel holds focus: Enter on a destructive prompt should not delete.
    cancelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Capture phase, so the sheet or modal underneath does not close too.
      event.stopPropagation();
      request.settle(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      previous?.focus();
    };
  }, [request]);

  if (!request) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-5 backdrop-blur-sm"
      onMouseDown={(event) => event.target === event.currentTarget && request.settle(false)}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={request.message ? "confirm-dialog-message" : undefined}
        className="animate-pop-in w-full max-w-[420px] rounded-xl border border-hairline bg-card p-5"
      >
        <div id="confirm-dialog-title" className="text-[15px] font-semibold text-ink">
          {request.title}
        </div>
        {request.message && (
          <div id="confirm-dialog-message" className="mt-1.5 text-[12.5px] leading-relaxed text-ink-secondary">
            {request.message}
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => request.settle(false)}
            className="rounded-lg border border-hairline px-3 py-2 text-[12px] font-medium text-ink-secondary hover:bg-raised hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => request.settle(true)}
            className={cn(
              "rounded-lg px-3 py-2 text-[12px] font-semibold hover:brightness-110",
              request.danger ? "bg-danger text-white" : "bg-accent text-app",
            )}
          >
            {request.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
