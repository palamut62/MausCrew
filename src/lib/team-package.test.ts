import { describe, expect, it } from "vitest";

import { importPreview, withoutUnwanted } from "./team-package";

const pkg = (member: Record<string, unknown>) => ({
  format: "mauscrew.team",
  version: 1,
  team: {
    name: "Field Team",
    members: [{ key: "scout", name: "Scout", title: "Research", appearance: { color: "cyan" }, ...member }],
    room: { name: "Field", bulletin: "", defaultResponder: { kind: "everyone" } },
  },
});

describe("reading a shared package", () => {
  it("shows what each bot brings, in the sender's own words", () => {
    const preview = importPreview(
      pkg({
        skills: [
          { name: "connect-navimow", description: "Connect a mower", whenToUse: "use this when the user needs to connect a mower" },
          { name: "control-navimow", description: "Start and stop a mower" },
        ],
        memory: "Never mow before confirming the lawn is clear.",
      }),
    );
    const member = preview.members[0]!;
    expect(member.skills.map((skill) => skill.name)).toEqual(["connect-navimow", "control-navimow"]);
    expect(member.skills[0]!.whenToUse).toContain("connect a mower");
    // no whenToUse: the description is the next best answer to "what is this for"
    expect(member.skills[1]!.whenToUse).toBe("Start and stop a mower");
    expect(member.memory).toBe("Never mow before confirming the lawn is clear.");
  });

  it("reads a file written before packages existed as carrying nothing", () => {
    const member = importPreview(pkg({})).members[0]!;
    expect(member.skills).toEqual([]);
    expect(member.memory).toBe("");
  });

  it("ignores skill entries it cannot make sense of instead of refusing the file", () => {
    // The server validates for real. This is a preview: a malformed entry
    // must not cost the reader the whole file they were about to look at.
    const member = importPreview(pkg({ skills: [{ description: "no name" }, null, "nope", { name: "kept", description: "d" }] })).members[0]!;
    expect(member.skills.map((skill) => skill.name)).toEqual(["kept"]);
  });

  it("still refuses a file that is not a team at all", () => {
    expect(() => importPreview({ format: "something.else", version: 1 })).toThrow(/not a MausCrew team file/);
    expect(() => importPreview({ ...pkg({}), version: 2 })).toThrow(/version 2 is not supported/);
    expect(() => importPreview("a string")).toThrow(/does not contain a team/);
  });
});

describe("declining part of a package", () => {
  const file = pkg({ skills: [{ name: "s", description: "d" }], memory: "m" });

  it("hands back the same file when nothing was declined", () => {
    expect(withoutUnwanted(file, { skills: true, memory: true })).toBe(file);
  });

  it("removes what the reader unticked and keeps the rest intact", () => {
    const stripped = withoutUnwanted(file, { skills: false, memory: true }) as typeof file;
    const member = stripped.team.members[0]! as Record<string, unknown>;
    expect(member).not.toHaveProperty("skills");
    expect(member.memory).toBe("m");
    // identity is untouched: this is still the sender's bot
    expect(member.name).toBe("Scout");
    expect(member.appearance).toEqual({ color: "cyan" });
    expect(stripped.team.room).toEqual(file.team.room);
    expect(stripped.format).toBe("mauscrew.team");
  });

  it("can decline both", () => {
    const member = (withoutUnwanted(file, { skills: false, memory: false }) as typeof file).team.members[0]! as Record<string, unknown>;
    expect(member).not.toHaveProperty("skills");
    expect(member).not.toHaveProperty("memory");
  });

  it("leaves the sender's file untouched", () => {
    withoutUnwanted(file, { skills: false, memory: false });
    expect(file.team.members[0]).toHaveProperty("skills");
  });
});
