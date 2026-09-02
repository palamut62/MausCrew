import { describe, expect, it } from "vitest";

import { createTeamManifest, parseTeamManifest } from "./team-manifest.ts";

describe("team manifests", () => {
  it("exports portable member keys and room routing without runtime state", () => {
    const manifest = createTeamManifest(
      {
        name: "Launch Crew",
        memberIds: ["bot-a", "bot-b"],
        bulletin: "Ship together",
        defaultResponder: { kind: "member", botId: "bot-b" },
      },
      [
        {
          id: "bot-a",
          name: "Mira",
          title: "Lead",
          description: "Coordinates the work",
          color: "purple",
        },
        {
          id: "bot-b",
          name: "Mira",
          title: "Researcher",
          description: "Finds evidence",
          color: "cyan",
        },
      ],
    );

    expect(manifest).toMatchObject({
      format: "mauscrew.team",
      version: 1,
      team: {
        name: "Launch Crew",
        members: [{ key: "mira" }, { key: "mira-2" }],
        room: {
          bulletin: "Ship together",
          defaultResponder: { kind: "member", member: "mira-2" },
        },
      },
    });
    expect(JSON.stringify(manifest)).not.toMatch(/bot-a|bot-b|thread|model|permission|message/i);
  });

  it("still imports a manifest written before the mascot engine was retired", () => {
    // Those files carry appearance.mascotExpression. Refusing them, or carrying
    // the value into a bot that has nowhere to show it, are both worse than
    // reading it and dropping it on the floor.
    const parsed = parseTeamManifest({
      format: "mauscrew.team",
      version: 1,
      team: {
        name: "Legacy Crew",
        members: [
          {
            key: "ada",
            name: "Ada",
            title: "",
            description: "",
            appearance: { color: "green", mascotExpression: "focused" },
          },
        ],
        room: { name: "Legacy Room", bulletin: "", defaultResponder: { kind: "everyone" } },
      },
    });
    expect(parsed.team.members[0].appearance).toEqual({ color: "green" });
  });

  it("parses the supported portable fields and drops unrelated settings", () => {
    const manifest = parseTeamManifest({
      format: "mauscrew.team",
      version: 1,
      team: {
        name: "  Research Lab  ",
        members: [
          {
            key: "analyst",
            name: " Ada ",
            title: " Analyst ",
            description: " Checks the evidence ",
            appearance: { color: "green" },
            modelSelection: { instanceId: "private-machine" },
            alwaysAllow: ["everything"],
          },
        ],
        room: {
          name: " Research Room ",
          bulletin: " Compare sources ",
          defaultResponder: { kind: "member", member: "analyst" },
          computer: "local",
        },
      },
    });

    expect(manifest.team.name).toBe("Research Lab");
    expect(manifest.team.members[0]).toEqual({
      key: "analyst",
      name: "Ada",
      title: "Analyst",
      description: "Checks the evidence",
      appearance: { color: "green" },
    });
    expect(manifest.team.room).toEqual({
      name: "Research Room",
      bulletin: "Compare sources",
      defaultResponder: { kind: "member", member: "analyst" },
    });
  });

  it("rejects unsupported versions and dangling member references", () => {
    expect(() => parseTeamManifest({ format: "mauscrew.team", version: 99 })).toThrow("not supported");
    expect(() =>
      parseTeamManifest({
        format: "mauscrew.team",
        version: 1,
        team: {
          name: "Broken",
          members: [
            {
              key: "one",
              name: "One",
              appearance: { color: "blue" },
            },
          ],
          room: {
            name: "Broken",
            bulletin: "",
            defaultResponder: { kind: "member", member: "missing" },
          },
        },
      }),
    ).toThrow("Unknown default responder");
  });

  it("refuses to export values that the importer would reject", () => {
    expect(() =>
      createTeamManifest(
        {
          name: "x".repeat(101),
          memberIds: ["one"],
          bulletin: "",
          defaultResponder: { kind: "member", botId: "one" },
        },
        [
          {
            id: "one",
            name: "One",
            title: "",
            description: "",
            color: "blue",
          },
        ],
      ),
    ).toThrow("team.name is too long");

    const bots = Array.from({ length: 51 }, (_, index) => ({
      id: `bot-${index}`,
      name: `Bot ${index}`,
      title: "",
      description: "",
      color: "green" as const,
    }));
    expect(() =>
      createTeamManifest(
        {
          name: "Too many",
          memberIds: bots.map((bot) => bot.id),
          bulletin: "",
          defaultResponder: { kind: "everyone" },
        },
        bots,
      ),
    ).toThrow("at most 50 members");
  });
});

// A shared bot that carries only its prompt arrives able to describe the job
// and unable to do it. These fields are what make a package a package: the
// playbooks it can run, and — only when the sender says so — what it knows.
describe("packaged skills and memory", () => {
  const skill = (name: string) => ({
    name,
    description: `What ${name} does`,
    whenToUse: `use this when the user asks for ${name}`,
    instructions: `# ${name}\n\nDo the thing.`,
  });

  it("carries a member's skills and memory through a round trip", () => {
    const manifest = createTeamManifest(
      { name: "Solo", memberIds: ["bot-a"], bulletin: "", defaultResponder: { kind: "everyone" } },
      [
        {
          id: "bot-a",
          name: "Scout",
          title: "Research",
          description: "Finds evidence",
          color: "cyan",
          skills: [skill("connect-navimow"), skill("control-navimow")],
          memory: "Never mow before confirming the lawn is clear.",
        },
      ],
    );
    const member = manifest.team.members[0]!;
    expect(member.skills?.map((s) => s.name)).toEqual(["connect-navimow", "control-navimow"]);
    expect(member.memory).toBe("Never mow before confirming the lawn is clear.");
    // and the file survives being read back as an untrusted one
    expect(parseTeamManifest(manifest).team.members[0]!.skills).toHaveLength(2);
  });

  it("omits both fields when the sender did not share them", () => {
    const manifest = createTeamManifest(
      { name: "Solo", memberIds: ["bot-a"], bulletin: "", defaultResponder: { kind: "everyone" } },
      [{ id: "bot-a", name: "Scout", title: "", description: "", color: "cyan" }],
    );
    const member = manifest.team.members[0]!;
    expect(member).not.toHaveProperty("skills");
    expect(member).not.toHaveProperty("memory");
  });

  it("still reads a file written before packages existed", () => {
    const legacy = {
      format: "mauscrew.team",
      version: 1,
      team: {
        name: "Old",
        members: [{ key: "a", name: "Ada", title: "", description: "", appearance: { color: "green" } }],
        room: { name: "Old", bulletin: "", defaultResponder: { kind: "everyone" } },
      },
    };
    const parsed = parseTeamManifest(legacy);
    expect(parsed.team.members[0]!.skills).toBeUndefined();
    expect(parsed.team.members[0]!.memory).toBeUndefined();
  });

  const withSkills = (skills: unknown) => ({
    format: "mauscrew.team",
    version: 1,
    team: {
      name: "T",
      members: [{ key: "a", name: "Ada", title: "", description: "", appearance: { color: "green" }, skills }],
      room: { name: "T", bulletin: "", defaultResponder: { kind: "everyone" } },
    },
  });

  it("refuses a skill name the Skill Center could never open", () => {
    // the store's directories are kebab-case; a manifest must not be able to
    // describe a skill that cannot exist as a folder
    expect(() => parseTeamManifest(withSkills([skill("../escape")]))).toThrow(/kebab-case/);
    expect(() => parseTeamManifest(withSkills([skill("Not Kebab")]))).toThrow(/kebab-case/);
  });

  it("refuses a duplicate skill, an oversized bundle and a malformed entry", () => {
    expect(() => parseTeamManifest(withSkills([skill("dup"), skill("dup")]))).toThrow(/Duplicate skill/);
    expect(() => parseTeamManifest(withSkills(Array.from({ length: 41 }, (_, i) => skill(`s-${i}`))))).toThrow(/at most/);
    expect(() => parseTeamManifest(withSkills([{ name: "no-body", description: "x" }]))).toThrow(/instructions is required/);
    expect(() => parseTeamManifest(withSkills("not-a-list"))).toThrow(/must be a list/);
  });

  it("refuses a memory larger than the field allows", () => {
    const oversized = {
      format: "mauscrew.team",
      version: 1,
      team: {
        name: "T",
        members: [{ key: "a", name: "Ada", title: "", description: "", appearance: { color: "green" }, memory: "x".repeat(16_001) }],
        room: { name: "T", bulletin: "", defaultResponder: { kind: "everyone" } },
      },
    };
    expect(() => parseTeamManifest(oversized)).toThrow(/too long/);
  });
});
