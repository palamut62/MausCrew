// Where the character art lives.
//
// Each colour is a short animated reel the artist drew: the body squashing and
// stretching, and the eyes cycling through slits, angled, closed and wide. A
// still frame sits beside every reel for the cases where motion is wrong —
// reduced-motion, and avatars that are decoration rather than live teammates.

import type { MausColor } from "./colors";

/** Every character is drawn on this square. */
export const ART_SIZE = 192;

/** The moving character. */
export function artFor(color: MausColor): string {
  return `/mascots/${color}.gif`;
}

/** One frame of it, for when movement would be wrong. */
export function stillFor(color: MausColor): string {
  return `/mascots/${color}.png`;
}
