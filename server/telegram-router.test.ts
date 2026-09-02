import { describe, expect, it } from "vitest";

import { parseRouting, routingPrompt, type RosterEntry } from "./telegram-router.ts";

const roster: RosterEntry[] = [
  { id: "b1", name: "Researcher", title: "Research", description: "You find and verify sources.", busy: false, chief: false },
  { id: "b2", name: "Coder", title: "Implementation", description: "You write and change code.", busy: true, chief: false },
  { id: "b3", name: "Chef", title: "Chief of staff", description: "You coordinate.", busy: false, chief: true },
];

describe("telegram routing prompt", () => {
  it("puts every MAUS on the list with its id, role and availability", () => {
    const prompt = routingPrompt("research competitor pricing", roster, true);
    expect(prompt).toContain("id: b1");
    expect(prompt).toContain("busy: yes");
    expect(prompt).toContain("Chief of Staff; it coordinates");
    expect(prompt).toContain("research competitor pricing");
  });

  it("states that busy is not a reason to create, and hides creation when it is off", () => {
    expect(routingPrompt("x", roster, true)).toContain("busy is still the right answer");
    const locked = routingPrompt("x", roster, false);
    expect(locked).toContain("You may not propose a new MAUS");
    expect(locked).not.toContain('"create"');
  });
});

describe("telegram routing answers", () => {
  it("accepts a MAUS that is on the roster", () => {
    expect(parseRouting('{"botId":"b1","why":"research request"}', roster, true)).toEqual({
      kind: "existing",
      botId: "b1",
      why: "research request",
    });
  });

  it("accepts a busy MAUS — the queue is the answer, not a new bot", () => {
    expect(parseRouting('{"botId":"b2","why":"code change"}', roster, true)).toMatchObject({
      kind: "existing",
      botId: "b2",
    });
  });

  it("refuses a MAUS that does not exist", () => {
    // A hallucinated id would otherwise surface to the user as silence.
    expect(parseRouting('{"botId":"nope","why":"x"}', roster, true)).toEqual({
      kind: "none",
      why: "the Chief named a MAUS that is not on the team",
    });
  });

  it("accepts a well-formed new MAUS when creation is allowed", () => {
    const answer = '{"create":{"name":"Designer","title":"Design","description":"You make things look right."},"why":"no designer"}';
    expect(parseRouting(answer, roster, true)).toEqual({
      kind: "create",
      profile: { name: "Designer", title: "Design", description: "You make things look right." },
      why: "no designer",
    });
  });

  it("refuses to create when the user has not switched it on", () => {
    const answer = '{"create":{"name":"Designer","title":"Design","description":"d"},"why":"x"}';
    expect(parseRouting(answer, roster, false)).toEqual({
      kind: "none",
      why: "nobody fits, and creating one is switched off",
    });
  });

  it("refuses a new MAUS whose name is already taken", () => {
    // Two bots with one name makes every @mention ambiguous, permanently.
    const answer = '{"create":{"name":"coder","title":"x","description":"y"},"why":"z"}';
    expect(parseRouting(answer, roster, true)).toMatchObject({ kind: "none", why: "there is already a MAUS called coder" });
  });

  it("reads JSON out of a fenced block or a sentence of preamble", () => {
    expect(parseRouting('Sure!\n```json\n{"botId":"b1","why":"fits"}\n```', roster, true)).toMatchObject({ botId: "b1" });
    expect(parseRouting('I think {"botId":"b1","why":"fits"} is right', roster, true)).toMatchObject({ botId: "b1" });
  });

  it("answers 'nobody' rather than throwing on anything unreadable", () => {
    for (const raw of ["", "no idea", "{", "[]", '{"create":{"name":""}}']) {
      expect(parseRouting(raw, roster, true).kind).toBe("none");
    }
  });
});
