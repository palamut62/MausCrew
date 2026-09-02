import { describe, expect, it } from "vitest";

import { projectActivity } from "./project-activity";
import type { Bot, Group, Message, Project } from "@/state/store";

const project = (roomIds: string[]): Project => ({ id: "p1", name: "Ship it", roomIds } as Project);

const message = (at: number, over: Partial<Message> = {}): Message => ({
  id: `m${at}`,
  role: "bot",
  kind: "text",
  at,
  ...over,
} as Message);

const room = (id: string, messages: Message[], over: Partial<Group> = {}): Group => ({
  id,
  threadId: `t-${id}`,
  name: id,
  memberIds: [],
  defaultResponder: { kind: "everyone" },
  bulletin: "",
  unread: false,
  createdAt: 0,
  messages,
  ...over,
} as Group);

const bots = [{ id: "b1", name: "Reviewer" }] as Bot[];

describe("project activity", () => {
  it("reports the newest message across every room in the project", () => {
    const rooms = [
      room("a", [message(100, { text: "older", from: { botId: "b1", name: "Reviewer", color: "blue" } })]),
      room("b", [message(300, { text: "newest", from: { botId: "b1", name: "Reviewer", color: "blue" } })]),
      // Belongs to another project: it is newer, and must not be reported here.
      room("c", [message(900, { text: "someone else's" })]),
    ];
    expect(projectActivity(project(["a", "b"]), rooms, bots)).toMatchObject({
      preview: "Reviewer: newest",
      at: 300,
      working: false,
    });
  });

  it("prefers a bot mid-turn over the last settled message", () => {
    const rooms = [room("a", [message(100, { text: "done" })], { busyBotId: "b1" })];
    expect(projectActivity(project(["a"]), rooms, bots)).toMatchObject({
      preview: "Reviewer is working…",
      working: true,
    });
  });

  it("raises the unread flag from any room in the project", () => {
    const rooms = [room("a", [message(100, { text: "x" })]), room("b", [], { unread: true })];
    expect(projectActivity(project(["a", "b"]), rooms, bots).unread).toBe(true);
  });

  it("names what is missing rather than showing an empty line", () => {
    expect(projectActivity(project([]), [], bots).preview).toBe("No rooms yet");
    expect(projectActivity(project(["a"]), [room("a", [])], bots).preview).toBe("No messages yet");
  });

  it("labels the user's own last message the way a room row does", () => {
    const rooms = [room("a", [message(100, { role: "user", text: "ship it" })])];
    expect(projectActivity(project(["a"]), rooms, bots).preview).toBe("You: ship it");
  });

  it("falls back to a tool chip when the last thing that happened was an action", () => {
    const rooms = [room("a", [message(100, { kind: "activity", tool: { name: "ran tests", ok: true } })])];
    expect(projectActivity(project(["a"]), rooms, bots).preview).toBe("ran tests");
  });
});
