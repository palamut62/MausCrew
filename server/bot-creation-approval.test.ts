import { rmSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  cancelBotCreationApprovalsFor,
  createApprovedBot,
  dismissStaleBotCreationCards,
  requestBotCreationApproval,
  resolveBotCreation,
} from "./bot-creation-approval.ts";
import { DATA_DIR } from "./config.ts";
import type { ModelSelection } from "./contracts.ts";
import type { ApprovalBus } from "./peer-approval.ts";
import { Store, type BotRecord } from "./store.ts";

const selection = (): ModelSelection => ({ instanceId: "claude", model: "fake-model" });

describe("bot creation approval", () => {
  let store: Store;
  let bus: ApprovalBus;
  let from: BotRecord;

  beforeEach(() => {
    store = new Store(selection);
    from = store.patchBot(store.createBot().id, { name: "Chief" })!;
    bus = { store, broadcast: () => {} };
  });

  afterEach(() => rmSync(DATA_DIR, { recursive: true, force: true }));

  it("creates a durable profiled bot only after the user allows", async () => {
    const profile = {
      name: "Researcher",
      title: "Evidence researcher",
      description: "Find primary sources and preserve links.",
    };
    const verdict = requestBotCreationApproval(bus, from, profile);
    const card = store.messagesFor(from.threadId).find((message) => message.card?.tool === "create_bot" && !message.card.answered)!;
    expect(card.card?.title).toContain("Researcher");

    expect(resolveBotCreation(card.card!.requestId!, "allow")).toBe(true);
    expect(await verdict).toBe("allow");
    const created = createApprovedBot(bus, profile, selection());

    expect(created).toMatchObject(profile);
    expect(store.messagesFor(from.threadId).find((message) => message.id === card.id)?.card?.answered).toBe("allow");
  });

  it("denies and settles a proposal when its requesting bot is deleted", async () => {
    const verdict = requestBotCreationApproval(bus, from, {
      name: "Writer",
      title: "Writer",
      description: "Own durable writing work.",
    });
    const card = store.messagesFor(from.threadId).find((message) => message.card?.tool === "create_bot" && !message.card.answered)!;
    cancelBotCreationApprovalsFor(from.id);
    expect(await verdict).toBe("deny");
    expect(store.messagesFor(from.threadId).find((message) => message.id === card.id)?.card?.dismissed).toBe(true);
  });

  it("dismisses an orphaned creation card after a restart", () => {
    store.appendMessage(from.threadId, {
      role: "bot",
      kind: "options",
      card: {
        title: "Create Researcher",
        subtitle: "Evidence researcher",
        options: ["Allow", "Deny"],
        requestId: "dead-request",
        tool: "create_bot",
      },
    });
    expect(dismissStaleBotCreationCards(bus)).toBe(1);
    expect(dismissStaleBotCreationCards(bus)).toBe(0);
  });
});
