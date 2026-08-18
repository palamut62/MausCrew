// Bot avatar — a mono monogram tile. Bot identity is carried by one thing
// only: a fully opaque hairline border in the bot's own color. No mascot, no
// gradient, no face. The Blob Studio cursor mascot (CursorAvatar.tsx) and the
// mascot engine (@/lib/mascot) are left in the tree on purpose so switching
// back is a one-line change, but nothing renders them any more.
import { forwardRef, memo, useImperativeHandle } from "react";
import { MAUS_COLORS, type MausColor, type MausMotion, type MausState } from "@/lib/mascot";

/**
 * Legacy face-placement knobs from the Maus body era. Kept so the preview
 * harness's sliders keep compiling — the matching props are accepted and
 * ignored by the monogram tile.
 */
export const FACE_X = 80;
export const FACE_Y = 102;
export const FACE_SCALE = 0.47;
export const EYE_SCALE = 1.12;
export const MOUTH_WEIGHT = 11;

/** Tile metrics, proportional to the box so 16px and 220px both read right. */
const GLYPH_RATIO = 0.4;
const MIN_GLYPH = 9;

/**
 * Initials from a bot or group name: two words give one letter each
 * ("Deep Seek" -> DS), one word gives its first two ("DeepSeek" -> DE),
 * nothing gives "?".
 */
export function monogramFor(name: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Imperative handle from the mascot era — accepted, no-op. */
export type MausAvatarHandle = {
  blink: () => void;
  spin: (durationMs?: number) => void;
  setExpression: (index: number) => void;
};

export type MausAvatarProps = {
  color: MausColor;
  /** Bot or group name the monogram is derived from; falls back to `label`. */
  name?: string;
  size?: number;
  label?: string;
  /** Mascot-era knobs — accepted, ignored. */
  state?: MausState;
  expression?: number;
  motion?: MausMotion;
  motionKey?: number;
  turn?: number;
  gaze?: { x?: number; y?: number };
  spring?: number;
  eyeScale?: number;
  showMouth?: boolean;
  mouthStroke?: number;
  forward?: boolean;
  trackPointer?: boolean;
  animated?: boolean;
  eyeSpacing?: number;
  faceX?: number;
  faceY?: number;
  faceScale?: number;
};

function MausAvatarComponent(
  { color, name, size = 44, label }: MausAvatarProps,
  ref: React.Ref<MausAvatarHandle>,
) {
  useImperativeHandle(ref, () => ({
    blink: () => {},
    spin: () => {},
    setExpression: () => {},
  }));

  const accent = MAUS_COLORS[color] ?? MAUS_COLORS.green;
  const title = label ?? name ?? undefined;

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-md border bg-inset font-mono uppercase tracking-tight text-ink leading-none select-none"
      style={{
        width: size,
        height: size,
        borderColor: accent,
        fontSize: Math.max(MIN_GLYPH, Math.round(size * GLYPH_RATIO)),
      }}
      title={title}
      aria-label={title}
    >
      {monogramFor(name ?? label)}
    </span>
  );
}

export const MausAvatar = memo(forwardRef(MausAvatarComponent));

export function InitialsAvatar({
  initials,
  size = 32,
}: {
  initials: string;
  size?: number;
}) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-md border border-hairline bg-inset font-mono uppercase tracking-tight text-ink-secondary leading-none"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(MIN_GLYPH, Math.round(size * GLYPH_RATIO)),
      }}
    >
      {initials || "?"}
    </div>
  );
}
