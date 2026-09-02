// Lives on the server side of the tree because it asserts the two halves
// agree: the templates the renderer ships and the parser the harness imports
// them with. A mock of either would defeat the point.
import { describe, expect, it } from "vitest";

import { CREW_TEMPLATES, crewManifest } from "../src/lib/crew-templates.ts";
import { parseTeamManifest } from "./team-manifest.ts";

describe("crew templates", () => {
  it("produces manifests the harness accepts", () => {
    for (const template of CREW_TEMPLATES) {
      const parsed = parseTeamManifest(crewManifest(template));
      expect(parsed.team.members).toHaveLength(template.members.length);
      expect(parsed.team.room.name).toBe(template.room);
    }
  });

  it("names a lead that exists in its own crew", () => {
    for (const template of CREW_TEMPLATES) {
      expect(template.members.map((member) => member.key)).toContain(template.lead);
      const parsed = parseTeamManifest(crewManifest(template));
      expect(parsed.team.room.defaultResponder).toEqual({ kind: "member", member: template.lead });
    }
  });

  it("keeps ids and member keys unique", () => {
    expect(new Set(CREW_TEMPLATES.map((template) => template.id)).size).toBe(CREW_TEMPLATES.length);
    for (const template of CREW_TEMPLATES) {
      expect(new Set(template.members.map((member) => member.key)).size).toBe(template.members.length);
    }
  });
});
