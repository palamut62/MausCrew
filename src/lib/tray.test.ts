import { describe, expect, it } from "vitest";

import { waitingBots } from "./tray";
import type { Bot, Message } from "@/state/store";

function card(id: string, at: number, card: Message["card"]): Message {
  return { id, role: "bot", kind: "options", at, card };
}

function bot(overrides: Partial<Bot> & Pick<Bot, "id" | "name" | "messages">): Bot {
  return {
    threadId: `thread-${overrides.id}`,
    title: "",
    description: "",
    notifications: true,
    color: "blue",
    unread: false,
    modelSelection: { instanceId: "claude", model: "sonnet" },
    ...overrides,
  } as Bot;
}

describe("tray status", () => {
  it("lists only bots with an unanswered card, newest first", () => {
    const bots = [
      bot({ id: "a", name: "Ada", messages: [card("m1", 100, { title: "Approval needed", subtitle: "rm", requestId: "r1", tool: "Bash", options: ["Allow", "Deny"] })] }),
      bot({ id: "b", name: "Bo", messages: [card("m2", 200, { title: "Question", subtitle: "which repo?", requestId: "r2", options: [] })] }),
      bot({ id: "c", name: "Cy", messages: [card("m3", 300, { title: "Approval needed", subtitle: "rm", requestId: "r3", tool: "Bash", answered: "Allow", options: ["Allow", "Deny"] })] }),
      bot({ id: "d", name: "Di", messages: [] }),
    ];
    expect(waitingBots(bots)).toEqual([
      { id: "b", name: "Bo", kind: "question" },
      { id: "a", name: "Ada", kind: "approval" },
    ]);
  });

  it("reports an approval when a bot holds both a question and a tool call", () => {
    const bots = [
      bot({
        id: "a",
        name: "Ada",
        messages: [
          card("m1", 100, { title: "Approval needed", subtitle: "rm", requestId: "r1", tool: "Bash", options: ["Allow", "Deny"] }),
          card("m2", 200, { title: "Question", subtitle: "which repo?", requestId: "r2", options: [] }),
        ],
      }),
    ];
    expect(waitingBots(bots)).toEqual([{ id: "a", name: "Ada", kind: "approval" }]);
  });

  it("skips hidden bots and dismissed cards", () => {
    const bots = [
      bot({ id: "a", name: "Ada", hidden: true, messages: [card("m1", 100, { title: "t", subtitle: "s", requestId: "r1", tool: "Bash", options: ["Allow", "Deny"] })] }),
      bot({ id: "b", name: "Bo", messages: [card("m2", 100, { title: "t", subtitle: "s", requestId: "r2", tool: "Bash", dismissed: true, options: ["Allow", "Deny"] })] }),
    ];
    expect(waitingBots(bots)).toEqual([]);
  });
});
