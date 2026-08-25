// Bot avatar — a compact coloured teammate face. Two asymmetric eye marks keep
// even 20px avatars recognizable without importing another product's logo.
//
// The drawing now lives in MausMascot, which also moves it; this file stays the
// call site every view already imports.
import { memo } from "react";
import { type MausColor } from "@/lib/colors";
import { MausMascot } from "./MausMascot";
import type { MausState } from "@/lib/mascot-motion";

/** Tile metrics, proportional to the box so 16px and 220px both read right. */
const GLYPH_RATIO = 0.38;
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

export type MausAvatarProps = {
  color: MausColor;
  /** Bot or group name the monogram is derived from; falls back to `label`. */
  name?: string;
  size?: number;
  /** Accessible title/label when the avatar stands for something other
   * than `name` (a run status, a webhook target). */
  label?: string;
  /** Mood. Omit for a resting bot; `stateForBot` derives it from live state. */
  state?: MausState;
  /** Stable id so two bots never breathe in unison. Defaults to the name. */
  seed?: string;
  /** Hold the pose — for decorative or off-screen avatars. */
  paused?: boolean;
};

function MausAvatarComponent({ color, name, size = 44, label, state, seed, paused }: MausAvatarProps) {
  const title = label ?? name ?? undefined;
  return (
    <MausMascot
      color={color}
      state={state}
      size={size}
      seed={seed ?? name ?? color}
      paused={paused}
      title={title}
      className="rounded-lg"
    />
  );
}

export const MausAvatar = memo(MausAvatarComponent);

export function InitialsAvatar({
  initials,
  size = 32,
}: {
  initials: string;
  size?: number;
}) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full border border-hairline bg-inset font-sans font-semibold uppercase tracking-tight text-ink-secondary leading-none"
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
