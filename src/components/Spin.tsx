// The app's one spinner. Wraps the icon so every rotation in the window shares
// a phase — see lib/spin-sync for why that is worth a component.
import { Spinner } from "@phosphor-icons/react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { spinDelay } from "@/lib/spin-sync";

export interface SpinProps {
  size?: number;
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone";
  className?: string;
  /** Render the glyph without turning it — a queued run is not a running one. */
  spinning?: boolean;
}

export function Spin({
  size = 13,
  weight = "fill",
  className,
  spinning = true,
}: SpinProps) {
  // Captured once per mount on purpose: re-reading the clock on a later render
  // would move the delay and make this spinner jump out of the shared phase.
  const [delay] = useState(spinDelay);

  return (
    <Spinner
      size={size}
      weight={weight}
      className={cn(spinning && "maus-spin", className)}
      style={spinning ? { animationDelay: delay } : undefined}
    />
  );
}
