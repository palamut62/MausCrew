// Bot name generator — a curated local list beats a naming API: instant,
// offline, and every name is on-brand (short, friendly, a little pet-like,
// which suits the Maus). Picks avoid names already in use; when the pool is
// exhausted it falls back to "Name 2", "Name 3", …
const NAMES = [
  "Scout", "Pixel", "Atlas", "Nova", "Juno", "Koda", "Miso", "Mochi",
  "Biscuit", "Pepper", "Clover", "Ember", "Willow", "Comet", "Orbit", "Echo",
  "Indigo", "Sage", "Zephyr", "Poppy", "Maple", "Cosmo", "Luna", "Otto",
  "Ivy", "Finch", "Wren", "Basil", "Hazel", "Nimbus", "Onyx", "Pearl",
  "Quill", "Rocket", "Sunny", "Tango", "Vega", "Waffle", "Ziggy", "Noodle",
  "Pickle", "Churro", "Panko", "Dumpling", "Pesto", "Olive", "Cocoa", "Taffy",
  "Bramble", "Fig", "Juniper", "Moss", "Pebble", "Rio", "Skye", "Tuli",
  "Ursa", "Yuki", "Zuko", "Momo", "Kiwi", "Plum", "Sprout", "Turnip",
];

/**
 * The requested name, or the first free numbered variant of it.
 *
 * Two bots called "Panko" are not a cosmetic problem: rooms address each
 * other by name, so `@Panko` silently resolves to whichever the matcher sees
 * first and the other is unreachable. Importing the same team file twice —
 * or a Chief proposing a specialist a teammate already covers — used to
 * produce exactly that. The auto-namer above already numbers a collision;
 * this applies the same rule to a name someone asked for by hand.
 */
export function uniqueBotName(requested: string, taken: Iterable<string>): string {
  const wanted = requested.trim();
  if (!wanted) return wanted;
  const used = new Set([...taken].map((n) => n.trim().toLowerCase()));
  if (!used.has(wanted.toLowerCase())) return wanted;
  for (let i = 2; ; i++) {
    const candidate = `${wanted} ${i}`;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
}

export function pickBotName(taken: Iterable<string>): string {
  const used = new Set([...taken].map((n) => n.trim().toLowerCase()));
  const free = NAMES.filter((n) => !used.has(n.toLowerCase()));
  if (free.length > 0) return free[Math.floor(Math.random() * free.length)];
  // pool exhausted — number a random base name
  const base = NAMES[Math.floor(Math.random() * NAMES.length)];
  for (let i = 2; ; i++) {
    if (!used.has(`${base.toLowerCase()} ${i}`)) return `${base} ${i}`;
  }
}
