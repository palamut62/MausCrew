// Bot avatar — a compact coloured teammate face. Two asymmetric eye marks keep
// even 20px avatars recognizable without importing another product's logo.
import { memo } from "react";
import { MAUS_COLORS, type MausColor } from "@/lib/mascot";

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
};

function MausAvatarComponent({ color, name, size = 44, label }: MausAvatarProps) {
  const accent = MAUS_COLORS[color] ?? MAUS_COLORS.green;
  const title = label ?? name ?? undefined;

  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg leading-none select-none shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10)]"
      style={{
        width: size,
        height: size,
        backgroundColor: accent,
      }}
      title={title}
      aria-label={title}
    >
      <span
        aria-hidden="true"
        className="absolute rounded-full bg-black/85"
        style={{
          width: Math.max(2, Math.round(size * 0.09)),
          height: Math.max(5, Math.round(size * 0.28)),
          left: Math.round(size * 0.35),
          top: Math.round(size * 0.27),
          transform: "rotate(-7deg)",
        }}
      />
      <span
        aria-hidden="true"
        className="absolute rounded-full bg-black/85"
        style={{
          width: Math.max(2, Math.round(size * 0.09)),
          height: Math.max(4, Math.round(size * 0.22)),
          right: Math.round(size * 0.27),
          top: Math.round(size * 0.32),
          transform: "rotate(-7deg)",
        }}
      />
    </span>
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
