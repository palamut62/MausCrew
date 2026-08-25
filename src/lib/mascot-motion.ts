// Mascot motion.
//
// A bot avatar is on screen for the whole session, so its motion has to survive
// being watched. The approach is a table rather than an animation per state:
// one sine oscillation runs forever and the state only supplies four
// coefficients for it. Thirty-nine moods therefore cost four numbers each
// instead of thirty-nine keyframe blocks, and a new mood is a row, not a file.
//
//   amplitude  vertical travel, in viewBox units (the tile is 100 wide)
//   period     one full rise-and-fall, in ms
//   tilt       body lean, in degrees
//   eye        vertical eye scale: 0 is shut, 1 is open, above 1 is startled
//
// The drawing these numbers move is MausCrew's own — the accent tile and the
// two asymmetric eye marks Avatar has always used.

export type MausState =
  | "sleeping"
  | "waking"
  | "idle"
  | "listening"
  | "thinking"
  | "searching"
  | "working"
  | "excited"
  | "surprised"
  | "suspicious"
  | "angry"
  | "drowsy"
  | "happy"
  | "curious"
  | "confused"
  | "bored"
  | "proud"
  | "shy"
  | "sad"
  | "laughing"
  | "scared"
  | "playful"
  | "celebrate"
  | "orbit"
  | "radar"
  | "progress"
  | "spawning"
  | "humming"
  | "loading"
  | "dictating"
  | "sending"
  | "receiving"
  | "uploading"
  | "writing"
  | "notifying"
  | "alerting"
  | "bouncing"
  | "dragging"
  | "powering-down";

export interface MausMotion {
  readonly amplitude: number;
  readonly period: number;
  readonly tilt: number;
  readonly eye: number;
}

/** Resting motion. An unknown state falls back to this rather than freezing. */
const IDLE: MausMotion = { amplitude: 1.6, period: 8200, tilt: 0, eye: 1 };

export const MAUS_MOTION: Record<MausState, MausMotion> = {
  // asleep: no travel at all, lids nearly shut
  sleeping: { amplitude: 0, period: 7000, tilt: 0, eye: 0.08 },
  "powering-down": { amplitude: 0.3, period: 5200, tilt: 2, eye: 0.1 },
  drowsy: { amplitude: 0.6, period: 4600, tilt: 1, eye: 0.3 },
  waking: { amplitude: 2.4, period: 900, tilt: 0, eye: 0.4 },

  // ambient: slow and shallow, so a sidebar of idle bots is not a disco
  idle: IDLE,
  humming: { amplitude: 1.4, period: 5600, tilt: 0, eye: 0.92 },
  bored: { amplitude: 0.5, period: 3800, tilt: -9, eye: 0.42 },

  // attending to you
  listening: { amplitude: 1.9, period: 2600, tilt: -3, eye: 1.02 },
  curious: { amplitude: 2.1, period: 1700, tilt: 7, eye: 1.04 },
  dictating: { amplitude: 1.8, period: 3400, tilt: 0, eye: 1 },

  // busy: a quicker cadence reads as effort without shouting
  thinking: { amplitude: 1.1, period: 2100, tilt: 4, eye: 0.72 },
  searching: { amplitude: 2.2, period: 1050, tilt: -5, eye: 0.94 },
  working: { amplitude: 2.1, period: 1750, tilt: -2, eye: 1 },
  writing: { amplitude: 1.7, period: 2300, tilt: -5, eye: 0.96 },
  loading: { amplitude: 1.8, period: 4200, tilt: 2, eye: 0.9 },
  progress: { amplitude: 1.8, period: 3600, tilt: 0, eye: 1 },
  orbit: { amplitude: 2.2, period: 3900, tilt: 13, eye: 1 },
  radar: { amplitude: 2.2, period: 3900, tilt: -13, eye: 1 },
  sending: { amplitude: 2.4, period: 1500, tilt: 3, eye: 1 },
  receiving: { amplitude: 2.4, period: 1500, tilt: -3, eye: 1 },
  uploading: { amplitude: 2, period: 2000, tilt: 0, eye: 1 },

  // pleased
  happy: { amplitude: 3.2, period: 2400, tilt: 0, eye: 1.06 },
  excited: { amplitude: 5.4, period: 1000, tilt: 0, eye: 1.1 },
  celebrate: { amplitude: 7.5, period: 1300, tilt: 0, eye: 1.14 },
  laughing: { amplitude: 4.2, period: 1150, tilt: 0, eye: 0.76 },
  playful: { amplitude: 4, period: 1400, tilt: 9, eye: 1.06 },
  proud: { amplitude: 2.2, period: 3300, tilt: 5, eye: 1 },
  spawning: { amplitude: 5.2, period: 1100, tilt: 0, eye: 1 },
  bouncing: { amplitude: 7.2, period: 2800, tilt: 0, eye: 1 },

  // wary
  surprised: { amplitude: 3.4, period: 2300, tilt: 0, eye: 1.2 },
  scared: { amplitude: 3.2, period: 820, tilt: 0, eye: 1.16 },
  suspicious: { amplitude: 0.9, period: 2700, tilt: 8, eye: 0.7 },
  confused: { amplitude: 1.2, period: 2100, tilt: -6, eye: 0.82 },
  angry: { amplitude: 1.1, period: 2050, tilt: -8, eye: 0.6 },
  alerting: { amplitude: 2.3, period: 1900, tilt: 0, eye: 1.12 },
  notifying: { amplitude: 3.1, period: 1450, tilt: 0, eye: 1.08 },

  // withdrawn
  shy: { amplitude: 0.9, period: 3100, tilt: -9, eye: 0.5 },
  sad: { amplitude: 1, period: 4300, tilt: -5, eye: 0.56 },

  dragging: { amplitude: 3, period: 1600, tilt: 6, eye: 1 },
};

export function motionFor(state: MausState | null | undefined): MausMotion {
  return (state && MAUS_MOTION[state]) || IDLE;
}

/** Deterministic 32-bit hash — same bot, same gait, every launch. */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Per-bot timing offsets, so a sidebar of bots never breathes in unison.
 *
 * Two bots sharing a period drift into phase and start looking like one
 * animation played twice — the moment the whole thing reads as a spinner
 * instead of a room. Both numbers come from the bot's id: `phase` starts each
 * bot at a different point in the cycle, and `rate` stretches its period by up
 * to ±9% so they never re-converge. Derived rather than random, because a bot
 * that changes its gait on every reload is unsettling.
 */
export function timingFor(seed: string): { phase: number; rate: number } {
  const h = hash(seed);
  return {
    phase: ((h % 1000) / 1000) * Math.PI * 2,
    rate: 0.91 + (((h >>> 10) % 1000) / 1000) * 0.18,
  };
}

export interface MascotMessage {
  kind?: string;
  role?: string;
  tool?: { ok?: boolean } | null;
}

export interface MascotBotProfile {
  name: string;
  title?: string;
  description?: string;
  busy?: boolean;
  unread?: boolean;
  messages?: MascotMessage[];
}

/**
 * What the bot is doing wins; what the bot is for decides the rest.
 *
 * Live state changes minute to minute, so it is read first — otherwise the
 * avatar keeps smiling through a failed tool call. The keyword groups below
 * only settle the resting mood. They are not disjoint — "Security review" hits
 * both `review` and `security` — so order is the tiebreak and the earlier row
 * wins. Fixed order matters more than perfect partitioning here: a bot must
 * not change personality just because its title was reworded.
 */
export function stateForBot(bot: MascotBotProfile): MausState {
  const last = bot.messages?.[bot.messages.length - 1];
  if (last?.kind === "activity" && last.tool?.ok === false) return "alerting";
  if (bot.busy) return "working";
  if (bot.unread) return "notifying";
  if (last?.kind === "options") return "curious";

  const profile =
    `${bot.name} ${bot.title ?? ""} ${bot.description ?? ""}`.toLowerCase();
  const matches = (words: RegExp) => words.test(profile);

  if (
    matches(
      /\b(code|coding|developer|development|engineer|engineering|build|debug|program|software)\b/,
    )
  )
    return "working";
  if (
    matches(
      /\b(research|researcher|search|investigate|strategy|strategist|study|learn|knowledge)\b/,
    )
  )
    return "searching";
  if (
    matches(
      /\b(marketing|growth|launch|campaign|social|sales|outreach|brand)\b/,
    )
  )
    return "excited";
  if (
    matches(/\b(overnight|night|background|async|queue|batch|long-running)\b/)
  )
    return "drowsy";
  if (matches(/\b(monitor|monitoring|incident|alert|watch|status|uptime)\b/))
    return "radar";
  if (
    matches(/\b(review|reviewer|audit|critic|critique|quality|qa|test|legal)\b/)
  )
    return "suspicious";
  if (
    matches(/\b(security|secure|compliance|risk|privacy|finance|financial)\b/)
  )
    return "scared";
  if (
    matches(
      /\b(design|designer|creative|brainstorm|art|illustration|music|story)\b/,
    )
  )
    return "playful";
  if (
    matches(/\b(support|help|success|onboarding|coach|teacher|guide|welcome)\b/)
  )
    return "happy";

  return "idle";
}
