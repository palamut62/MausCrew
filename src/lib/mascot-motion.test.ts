// What a bot is doing has to be read from live state before it is read from
// the bot's job description, or a bot keeps looking busy after it failed and
// idle while it works.
import { describe, expect, it } from "vitest";

import { stateForBot } from "./mascot-motion";

describe("stateForBot", () => {
  const bot = (over: Partial<Parameters<typeof stateForBot>[0]> = {}) => ({
    name: "Pesto",
    ...over,
  });

  it("reads what the bot is doing before what it is for", () => {
    expect(stateForBot(bot({ title: "Designer", busy: true }))).toBe("working");
    expect(stateForBot(bot({ title: "Designer", unread: true }))).toBe("notifying");
    // a failed tool call outranks even busy
    expect(
      stateForBot(bot({ busy: true, messages: [{ kind: "activity", tool: { ok: false } }] })),
    ).toBe("alerting");
  });

  it("settles a resting mood from the bot's job", () => {
    expect(stateForBot(bot({ title: "Compliance" }))).toBe("scared");
    // the keyword groups overlap; the earlier row wins and must keep winning,
    // so a bot does not change character when its title is reworded
    expect(stateForBot(bot({ title: "Security review" }))).toBe("suspicious");
    expect(stateForBot(bot({ description: "Runs overnight batches" }))).toBe("drowsy");
    expect(stateForBot(bot({ title: "Uptime monitor" }))).toBe("radar");
    expect(stateForBot(bot({}))).toBe("idle");
  });

  it("notices a question waiting on the user", () => {
    expect(stateForBot(bot({ messages: [{ kind: "options" }] }))).toBe("curious");
  });
});
