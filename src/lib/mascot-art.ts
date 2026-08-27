// Where the character art lives, and where its face sits inside it.
//
// The bodies are drawn artwork — one per colour, each a different silhouette,
// so a bot is recognisable at a glance rather than being a coloured square.
// The face is not: it is drawn over the art at runtime, because the mood the
// bot is in changes minute to minute and a baked expression cannot.
//
// This is what makes the drawn character and the motion table fit together.
// The artwork supplies identity, which does not change; the code supplies
// expression, which does. Trying to get both from the artwork would need one
// file per colour per mood — ten colours by thirty-nine moods — and would
// still animate worse than two transform attributes a frame.

import type { MausColor } from "./colors";

/** Every body is drawn on this square. */
export const ART_SIZE = 384;

/**
 * The visor, in artwork coordinates.
 *
 * Measured from the source art rather than guessed: eight of the ten bodies
 * put it at exactly the same place, which is what makes overpainting it safe.
 * The two that differ are close enough that the drawn panel covers them.
 */
export const VISOR = { x: 108, y: 128, width: 168, height: 103, radius: 27 };
/** The visor's own colour, so the panel drawn over it is invisible. */
export const VISOR_INK = "#171C1D";

/** Eye placement inside the visor, in artwork coordinates. */
export const EYE = {
  dx: 28.5,
  cy: VISOR.y + VISOR.height / 2,
  width: 16,
  height: 39,
};

/** Bodies, by the colour a bot already stores. */
const ART: Record<MausColor, string> = {
  green: "green",
  blue: "blue",
  red: "red",
  orange: "orange",
  purple: "purple",
  cyan: "cyan",
  pink: "pink",
  yellow: "yellow",
  teal: "teal",
  coral: "coral",
};

export function artFor(color: MausColor): string {
  return `/mascots/${ART[color] ?? ART.green}.png`;
}

/**
 * The colour the eyes glow, per body.
 *
 * Taken from each drawing's own palette so the face belongs to the body it is
 * painted on: a mint bot's eyes are mint, a red bot's are warm. A single
 * shared colour looked borrowed on half of them.
 */
export const EYE_INK: Record<MausColor, string> = {
  green: "#AEE7BF",
  blue: "#6FE3FF",
  red: "#FFB3B3",
  orange: "#FFD2A6",
  purple: "#E3B6FF",
  cyan: "#8FF3F4",
  pink: "#FFC7DE",
  yellow: "#FFE7A8",
  teal: "#9FD6D0",
  coral: "#DCE6EF",
};
