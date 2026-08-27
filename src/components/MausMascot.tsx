// The bot avatar: the drawn characters, playing their own animation.
//
// Each character is a short reel the artist drew — the body squashing and
// stretching, and the eyes cycling through four expressions: slits, angled,
// closed, and wide. Playing that reel is what makes a bot feel alive in a way
// a coloured square never did.
//
// The reel is the animation, so the mood table is not consulted for it. That
// is the honest trade: the artwork gives motion nothing generated could match,
// and in exchange the face follows its own loop rather than the bot's current
// state. The state still reaches the user — through the activity chips, the
// spinner, the busy styling — just not through the face.
//
// A still frame is kept for the cases where motion is wrong: reduced-motion,
// and anywhere the avatar is decoration rather than a live teammate.
import { memo } from "react";
import { type MausColor } from "@/lib/colors";
import { artFor, stillFor } from "@/lib/mascot-art";
import type { MausState } from "@/lib/mascot-motion";

const prefersReducedMotion = () =>
  typeof window !== "undefined"
  && typeof window.matchMedia === "function"
  && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export interface MausMascotProps {
  color: MausColor;
  /** Kept for the call sites that pass it; the reel plays regardless. */
  state?: MausState;
  size?: number;
  seed?: string;
  /** Hold a still frame — for decorative avatars and long lists. */
  paused?: boolean;
  title?: string;
  className?: string;
}

function MausMascotComponent({
  color,
  state = "idle",
  size = 44,
  paused = false,
  title,
  className,
}: MausMascotProps) {
  const still = paused || prefersReducedMotion();
  return (
    <img
      src={still ? stillFor(color) : artFor(color)}
      width={size}
      height={size}
      alt={title ?? ""}
      // A decorative avatar beside a name the reader already has is noise to a
      // screen reader; one that stands alone needs its label.
      aria-hidden={title ? undefined : true}
      draggable={false}
      data-maus-state={state}
      className={className}
      style={{
        display: "block",
        flexShrink: 0,
        width: size,
        height: size,
        userSelect: "none",
        // The art is drawn square with its own padding; nothing should crop it.
        objectFit: "contain",
      }}
    />
  );
}

export const MausMascot = memo(MausMascotComponent);
