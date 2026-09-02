// Reading a shared team file, before anything is created.
//
// A package can be handed over by anyone, so the window has to be able to say
// what is in one — how many playbooks, what they claim to be for, what the bot
// says it already knows — and the reader has to be able to decline parts of it
// before any of it reaches the machine. These two functions are that: parse
// what the file claims, and strip what the reader refused.

export interface PendingTeamImport {
  manifest: unknown;
  name: string;
  roomName: string;
  members: Array<{
    name: string;
    title: string;
    /** What the file says this bot can do and knows. Read straight from the
     * package so the reader sees the sender's claim, not our summary of it. */
    skills: Array<{ name: string; whenToUse: string }>;
    memory: string;
  }>;
}

export function importPreview(manifest: unknown): PendingTeamImport {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error("This file does not contain a team.");
  }
  const root = manifest as Record<string, unknown>;
  if (root.format !== "mauscrew.team" && root.format !== "openmaus.team") {
    throw new Error("This is not a MausCrew team file.");
  }
  if (root.version !== 1) throw new Error(`Team file version ${String(root.version)} is not supported.`);
  if (!root.team || typeof root.team !== "object" || Array.isArray(root.team)) {
    throw new Error("This team file is missing its team definition.");
  }
  const team = root.team as Record<string, unknown>;
  if (typeof team.name !== "string" || !team.name.trim()) throw new Error("This team does not have a name.");
  if (!Array.isArray(team.members) || team.members.length === 0) throw new Error("This team has no members.");
  const members = team.members.map((member, index) => {
    if (!member || typeof member !== "object" || Array.isArray(member)) {
      throw new Error(`Team member ${index + 1} is invalid.`);
    }
    const value = member as Record<string, unknown>;
    if (typeof value.name !== "string" || !value.name.trim()) {
      throw new Error(`Team member ${index + 1} does not have a name.`);
    }
    const skills = Array.isArray(value.skills)
      ? value.skills.flatMap((entry) => {
          if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
          const skill = entry as Record<string, unknown>;
          const name = typeof skill.name === "string" ? skill.name.trim() : "";
          if (!name) return [];
          const when = typeof skill.whenToUse === "string" && skill.whenToUse.trim()
            ? skill.whenToUse.trim()
            : typeof skill.description === "string"
              ? skill.description.trim()
              : "";
          return [{ name, whenToUse: when }];
        })
      : [];
    return {
      name: value.name.trim(),
      title: typeof value.title === "string" ? value.title.trim() : "",
      skills,
      memory: typeof value.memory === "string" ? value.memory.trim() : "",
    };
  });
  const room = team.room;
  const roomName =
    room && typeof room === "object" && !Array.isArray(room) && typeof (room as Record<string, unknown>).name === "string"
      ? String((room as Record<string, unknown>).name).trim()
      : team.name.trim();
  return { manifest, name: team.name.trim(), roomName, members };
}

/** The same file with the content the reader declined stripped out. Structural
 * only: nothing is rewritten, so what remains is still the sender's file and
 * still has to satisfy the server's parser. */
export function withoutUnwanted(manifest: unknown, take: { skills: boolean; memory: boolean }): unknown {
  if (take.skills && take.memory) return manifest;
  const root = manifest as { team?: { members?: unknown[] } };
  const members = Array.isArray(root?.team?.members) ? root.team!.members : [];
  return {
    ...(manifest as object),
    team: {
      ...(root.team as object),
      members: members.map((member) => {
        const { skills, memory, ...rest } = (member ?? {}) as Record<string, unknown>;
        return {
          ...rest,
          ...(take.skills && skills !== undefined ? { skills } : {}),
          ...(take.memory && memory !== undefined ? { memory } : {}),
        };
      }),
    },
  };
}
