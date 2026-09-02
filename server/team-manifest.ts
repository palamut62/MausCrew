import type { GroupDefaultResponder, MausColor } from "./store.ts";

export const TEAM_MANIFEST_FORMAT = "mauscrew.team" as const;
export const TEAM_MANIFEST_VERSION = 1 as const;
const LEGACY_TEAM_MANIFEST_FORMAT = "openmaus.team";

const COLORS: readonly MausColor[] = [
  "green",
  "blue",
  "red",
  "orange",
  "purple",
  "cyan",
  "pink",
  "yellow",
  "teal",
  "coral",
];

/** A playbook, in the same shape the workspace `SKILL.md` already holds.
 * Deliberately the file's own fields and nothing more: a skill that survives
 * the round trip is one the Skill Center can edit afterwards. */
export interface TeamManifestSkill {
  name: string;
  description: string;
  whenToUse?: string;
  instructions: string;
}

export interface TeamManifestMember {
  key: string;
  name: string;
  title: string;
  description: string;
  appearance: {
    color: MausColor;
  };
  /** What the bot can DO, not just what it was told to be. A shared file
   * without these makes a bot that reads the part and cannot play it. */
  skills?: TeamManifestSkill[];
  /** The bot's own memory profile, as the prose it is stored as.
   *
   * Only the profile: the shared memory file is the user's own words about
   * their setup and the journal is a running record of their work, and
   * neither is the bot's to carry into someone else's machine. Even this one
   * is opt-in at export — it is the field most likely to hold something
   * personal, and a share should never move that by default. */
  memory?: string;
}

/** Skills are procedures, so a long one is normal; a hundred of them in one
 * shared file is not, and neither is a memory the size of a book. */
const MAX_SKILLS_PER_MEMBER = 40;
const MAX_SKILL_NAME = 64;
const MAX_SKILL_DESCRIPTION = 500;
const MAX_SKILL_WHEN_TO_USE = 1_000;
const MAX_SKILL_INSTRUCTIONS = 128 * 1024;
const MAX_MEMORY = 16_000;
/** Same rule as the skill store's own directory names: a manifest must not be
 * able to describe a skill the Skill Center could then never open. */
const SKILL_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type TeamManifestResponder =
  | { kind: "member"; member: string }
  | { kind: "everyone" }
  | { kind: "mentions" };

export interface TeamManifestV1 {
  format: typeof TEAM_MANIFEST_FORMAT;
  version: typeof TEAM_MANIFEST_VERSION;
  team: {
    name: string;
    description?: string;
    members: TeamManifestMember[];
    room: {
      name: string;
      bulletin: string;
      defaultResponder: TeamManifestResponder;
    };
  };
}

interface ExportableBot {
  id: string;
  name: string;
  title: string;
  description: string;
  color: MausColor;
  /** Resolved by the caller, which owns the workspace and the memory store.
   * Absent means "the user chose not to share this", not "there is none". */
  skills?: TeamManifestSkill[];
  memory?: string;
}

interface ExportableTeam {
  name: string;
  memberIds: string[];
  bulletin: string;
  defaultResponder: GroupDefaultResponder;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

function requiredString(value: unknown, field: string, max: number): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required`);
  const result = value.trim();
  if (result.length > max) throw new Error(`${field} is too long`);
  return result;
}

function optionalString(value: unknown, field: string, max: number): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new Error(`${field} must be text`);
  const result = value.trim();
  if (result.length > max) throw new Error(`${field} is too long`);
  return result || undefined;
}

/** The skills a member ships, or undefined when it ships none.
 *
 * Absent and empty are kept distinct all the way through: a file that says
 * nothing about skills and a file that says "no skills" both install nothing,
 * but only the second is a claim the sender made. */
function parseSkills(value: unknown, field: string): TeamManifestSkill[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) throw new Error(`${field} must be a list`);
  if (value.length > MAX_SKILLS_PER_MEMBER) {
    throw new Error(`${field} may hold at most ${MAX_SKILLS_PER_MEMBER} skills`);
  }
  const seen = new Set<string>();
  return value.map((raw, index): TeamManifestSkill => {
    const at = `${field}[${index}]`;
    if (!isRecord(raw)) throw new Error(`${at} must be an object`);
    const name = requiredString(raw.name, `${at}.name`, MAX_SKILL_NAME);
    if (!SKILL_NAME_RE.test(name)) {
      throw new Error(`${at}.name must be lowercase kebab-case`);
    }
    if (seen.has(name)) throw new Error(`Duplicate skill: ${name}`);
    seen.add(name);
    const whenToUse = optionalString(raw.whenToUse, `${at}.whenToUse`, MAX_SKILL_WHEN_TO_USE);
    return {
      name,
      description: requiredString(raw.description, `${at}.description`, MAX_SKILL_DESCRIPTION),
      ...(whenToUse ? { whenToUse } : {}),
      instructions: requiredString(raw.instructions, `${at}.instructions`, MAX_SKILL_INSTRUCTIONS),
    };
  });
}

/** Parse an untrusted shared file into the small, portable subset we support. */
export function parseTeamManifest(value: unknown): TeamManifestV1 {
  if (!isRecord(value)) throw new Error("This is not a team file");
  if (value.format !== TEAM_MANIFEST_FORMAT && value.format !== LEGACY_TEAM_MANIFEST_FORMAT) {
    throw new Error("This is not a MausCrew team file");
  }
  if (value.version !== TEAM_MANIFEST_VERSION) {
    throw new Error(`Team file version ${String(value.version)} is not supported`);
  }
  if (!isRecord(value.team)) throw new Error("team is required");

  const team = value.team;
  const name = requiredString(team.name, "team.name", 100);
  const description = optionalString(team.description, "team.description", 2_000);
  if (!Array.isArray(team.members) || team.members.length === 0) {
    throw new Error("A team needs at least one member");
  }
  if (team.members.length > 50) throw new Error("A team can have at most 50 members");

  const seenKeys = new Set<string>();
  const members = team.members.map((raw, index): TeamManifestMember => {
    const field = `team.members[${index}]`;
    if (!isRecord(raw)) throw new Error(`${field} must be an object`);
    const key = requiredString(raw.key, `${field}.key`, 64);
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(key)) {
      throw new Error(`${field}.key may only contain lowercase letters, numbers, - and _`);
    }
    if (seenKeys.has(key)) throw new Error(`Duplicate member key: ${key}`);
    seenKeys.add(key);

    const appearance = raw.appearance;
    if (!isRecord(appearance)) throw new Error(`${field}.appearance is required`);
    if (typeof appearance.color !== "string" || !COLORS.includes(appearance.color as MausColor)) {
      throw new Error(`${field}.appearance.color is not supported`);
    }
    // appearance.mascotExpression is read and dropped on purpose: manifests
    // exported before the mascot engine was retired still carry it, and an
    // unknown-field error would make those files unimportable for no gain.

    const skills = parseSkills(raw.skills, `${field}.skills`);
    const memory = optionalString(raw.memory, `${field}.memory`, MAX_MEMORY);
    return {
      key,
      name: requiredString(raw.name, `${field}.name`, 100),
      title: optionalString(raw.title, `${field}.title`, 200) ?? "",
      description: optionalString(raw.description, `${field}.description`, 4_000) ?? "",
      appearance: {
        color: appearance.color as MausColor,
      },
      ...(skills ? { skills } : {}),
      ...(memory ? { memory } : {}),
    };
  });

  if (!isRecord(team.room)) throw new Error("team.room is required");
  const responder = team.room.defaultResponder;
  if (!isRecord(responder) || typeof responder.kind !== "string") {
    throw new Error("team.room.defaultResponder is required");
  }
  let defaultResponder: TeamManifestResponder;
  if (responder.kind === "everyone" || responder.kind === "mentions") {
    defaultResponder = { kind: responder.kind };
  } else if (responder.kind === "member") {
    const member = requiredString(responder.member, "team.room.defaultResponder.member", 64);
    if (!seenKeys.has(member)) throw new Error(`Unknown default responder: ${member}`);
    defaultResponder = { kind: "member", member };
  } else {
    throw new Error(`Unknown default responder kind: ${responder.kind}`);
  }

  return {
    format: TEAM_MANIFEST_FORMAT,
    version: TEAM_MANIFEST_VERSION,
    team: {
      name,
      ...(description ? { description } : {}),
      members,
      room: {
        name: requiredString(team.room.name, "team.room.name", 100),
        bulletin: optionalString(team.room.bulletin, "team.room.bulletin", 12_000) ?? "",
        defaultResponder,
      },
    },
  };
}

function memberKey(name: string, index: number, used: Set<string>): string {
  const stem =
    name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || `member-${index + 1}`;
  let key = stem;
  let suffix = 2;
  while (used.has(key)) key = `${stem}-${suffix++}`;
  used.add(key);
  return key;
}

/** Build a shareable definition only: no IDs, transcripts, engines or permissions. */
export function createTeamManifest(team: ExportableTeam, bots: ExportableBot[]): TeamManifestV1 {
  const byId = new Map(bots.map((bot) => [bot.id, bot]));
  const usedKeys = new Set<string>();
  const keyById = new Map<string, string>();
  const members = team.memberIds.map((id, index) => {
    const bot = byId.get(id);
    if (!bot) throw new Error(`Team member ${id} no longer exists`);
    const key = memberKey(bot.name, index, usedKeys);
    keyById.set(id, key);
    return {
      key,
      name: bot.name,
      title: bot.title,
      description: bot.description,
      appearance: {
        color: bot.color,
      },
      ...(bot.skills?.length ? { skills: bot.skills } : {}),
      ...(bot.memory?.trim() ? { memory: bot.memory } : {}),
    };
  });

  let defaultResponder: TeamManifestResponder;
  if (team.defaultResponder.kind === "member") {
    const member = keyById.get(team.defaultResponder.botId) ?? members[0]?.key;
    if (!member) throw new Error("A team needs at least one member");
    defaultResponder = { kind: "member", member };
  } else {
    defaultResponder = { kind: team.defaultResponder.kind };
  }

  const manifest: TeamManifestV1 = {
    format: TEAM_MANIFEST_FORMAT,
    version: TEAM_MANIFEST_VERSION,
    team: {
      name: team.name,
      members,
      room: {
        name: team.name,
        bulletin: team.bulletin,
        defaultResponder,
      },
    },
  };
  // Keep export and import in lockstep: a file produced here must satisfy
  // the exact same limits and normalization as an untrusted shared file.
  return parseTeamManifest(manifest);
}
