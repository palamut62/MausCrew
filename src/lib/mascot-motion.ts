// What a bot is doing, as one word.
//
// The characters animate themselves now — each is a reel the artist drew — so
// the coefficient table that used to drive a generated face has no consumer
// and was removed with it. This is the half that survived: reading live state
// into a single mood word. The sidebar uses it, and it is what a state-driven
// face would need again if one returns.

export type MausState =
  | "idle"
  | "working"
  | "notifying"
  | "curious"
  | "searching"
  | "excited"
  | "drowsy"
  | "radar"
  | "suspicious"
  | "scared"
  | "playful"
  | "happy"
  | "alerting";

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
