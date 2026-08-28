// Bottom sheet — the mobile stand-in for a desktop dropdown.
//
// A `w-[320px]` menu anchored to the right edge of a header button is fine
// in a 1400px window and unusable on a 360px phone: it clips, it lands under
// the thumb, and its 13px rows are 24px tall. Anything that has to open a
// list on a phone renders this instead, full-width and thumb-reachable.
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

export function Sheet({
  title,
  subtitle,
  onClose,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Focus lands inside the sheet so the on-screen keyboard closes and the
  // next Tab/Escape belongs to the sheet rather than the page under it.
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          "animate-sheet-in flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-2xl border-t border-hairline bg-panel outline-none",
          // Wide screens get a centred card instead of an edge-to-edge sheet;
          // the same component then works for a tablet in landscape.
          "sm:mb-6 sm:max-w-[420px] sm:rounded-2xl sm:border",
          className,
        )}
      >
        {/* Grab handle: the affordance that says "drag or tap away to
            dismiss". Decorative — the close button is the real control. */}
        <div className="flex justify-center pt-2.5" aria-hidden>
          <span className="h-1 w-9 rounded-full bg-raised-hover" />
        </div>
        <div className="flex items-start gap-3 px-4 pb-3 pt-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold text-ink">{title}</div>
            {subtitle && <div className="truncate text-[12.5px] text-ink-secondary">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="-mr-1 flex size-9 shrink-0 items-center justify-center rounded-lg text-ink-secondary hover:bg-raised hover:text-ink"
          >
            <X size={18} weight="bold" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-[max(0.75rem,var(--safe-bottom))]">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** One row of a sheet. 48px tall on purpose — the whole point of the sheet
 * is that a thumb can hit it. */
export function SheetItem({
  icon,
  label,
  hint,
  onClick,
  disabled,
  active,
  danger,
}: {
  icon?: ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-40",
        active ? "bg-raised" : "hover:bg-raised/60",
        danger ? "text-danger" : "text-ink",
      )}
    >
      {icon && (
        <span className={cn("flex size-8 shrink-0 items-center justify-center", danger ? "text-danger" : "text-ink-secondary")}>
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px]">{label}</span>
        {hint && <span className="block truncate text-[12.5px] text-ink-secondary">{hint}</span>}
      </span>
    </button>
  );
}

export function SheetDivider() {
  return <div className="my-1.5 border-t border-hairline" aria-hidden />;
}
