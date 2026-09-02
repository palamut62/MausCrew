import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TelegramAgent, type TelegramAgentOptions } from "./telegram-agent.ts";
import type { RosterEntry } from "./telegram-router.ts";

const dirs: string[] = [];
function tempFile() {
  const dir = mkdtempSync(join(tmpdir(), "mauscrew-telegram-agent-"));
  dirs.push(dir);
  return join(dir, "conversations.json");
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const roster: RosterEntry[] = [
  { id: "b1", name: "Researcher", title: "Research", description: "You find sources.", busy: false, chief: false },
  { id: "b2", name: "Coder", title: "Code", description: "You write code.", busy: true, chief: false },
];

function harness(over: Partial<TelegramAgentOptions> = {}) {
  const sent: Array<{ text: string; replyTo?: number }> = [];
  const work: Array<{ botId: string; text: string; deliveryId: string; threadId?: string }> = [];
  const created: unknown[] = [];
  const answered: Array<[string, string]> = [];
  let messageId = 900;
  const options: TelegramAgentOptions = {
    file: tempFile(),
    roster: () => roster,
    ask: async () => '{"botId":"b1","why":"research"}',
    canCreate: () => false,
    createBot: async (profile) => {
      created.push(profile);
      return { id: "new-1", name: profile.name };
    },
    startWork: async (input) => {
      work.push(input);
      return { threadId: input.threadId ?? `thread-${input.botId}` };
    },
    answerCard: async (requestId, answer) => {
      answered.push([requestId, answer]);
      return true;
    },
    send: async (text, opts) => {
      sent.push({ text, ...(opts?.replyTo ? { replyTo: opts.replyTo } : {}) });
      return ++messageId;
    },
    ...over,
  };
  return { agent: new TelegramAgent(options), sent, work, created, answered, options };
}

const message = (over: Partial<{ text: string; messageId: number; replyToMessageId: number; deliveryId: string }> = {}) =>
  ({
    kind: "message" as const,
    updateId: 1,
    deliveryId: over.deliveryId ?? "tg-12345-100",
    text: over.text ?? "research competitor pricing",
    messageId: over.messageId ?? 100,
    ...(over.replyToMessageId ? { replyToMessageId: over.replyToMessageId } : {}),
    at: 1_700_000_000_000,
  });

describe("telegram agent", () => {
  it("gives the work to the MAUS the Chief picked and says so", async () => {
    const h = harness();
    await h.agent.handle(message());
    expect(h.work).toEqual([{ botId: "b1", text: "research competitor pricing", deliveryId: "tg-12345-100" }]);
    expect(h.sent[0]).toEqual({ text: "Researcher is on it.", replyTo: 100 });
  });

  it("answers in the language the Chief replied in", async () => {
    const h = harness({ ask: async () => '{"botId":"b1","why":"research","reply":"Researcher bakıyor, sonucu ileteceğim."}' });
    await h.agent.handle(message({ text: "rakiplerin fiyatlarını araştır" }));
    expect(h.sent[0]!.text).toBe("Researcher bakıyor, sonucu ileteceğim.");
  });

  it("falls back to English only when the Chief wrote no line", async () => {
    const h = harness({ ask: async () => '{"botId":"b1","why":"research"}' });
    await h.agent.handle(message());
    expect(h.sent[0]!.text).toBe("Researcher is on it.");
  });

  it("queues behind a busy MAUS rather than creating one", async () => {
    // The rule that matters: busy is not a reason to make a second bot.
    const h = harness({ ask: async () => '{"botId":"b2","why":"code"}', canCreate: () => true });
    await h.agent.handle(message());
    expect(h.created).toEqual([]);
    expect(h.work[0]).toMatchObject({ botId: "b2" });
    expect(h.sent[0]!.text).toContain("mid-task");
  });

  it("creates a MAUS when nobody fits and creation is switched on", async () => {
    const h = harness({
      canCreate: () => true,
      ask: async () => '{"create":{"name":"Designer","title":"Design","description":"You design."},"why":"no designer"}',
    });
    await h.agent.handle(message({ text: "design a logo" }));
    expect(h.created).toEqual([{ name: "Designer", title: "Design", description: "You design." }]);
    expect(h.work[0]).toMatchObject({ botId: "new-1" });
    expect(h.sent[0]!.text).toContain("created Designer");
  });

  it("refuses to create while the setting is off, and says where to turn it on", async () => {
    const h = harness({ ask: async () => '{"create":{"name":"Designer","title":"D","description":"d"},"why":"none fit"}' });
    await h.agent.handle(message());
    expect(h.created).toEqual([]);
    expect(h.work).toEqual([]);
    expect(h.sent[0]!.text).toContain("Settings → Telegram");
  });

  it("continues the same task when the user replies, without re-staffing", async () => {
    const ask = vi.fn(async () => '{"botId":"b1","why":"research"}');
    const h = harness({ ask });
    await h.agent.handle(message({ messageId: 100 }));
    // Reply to the acknowledgement MausCrew sent (id 901), not the request.
    await h.agent.handle(message({ messageId: 101, replyToMessageId: 901, text: "only EU competitors" }));
    expect(ask).toHaveBeenCalledTimes(1);
    expect(h.work[1]).toEqual({
      botId: "b1",
      text: "only EU competitors",
      deliveryId: "tg-12345-100",
      threadId: "thread-b1",
    });
  });

  it("remembers conversations across a restart", async () => {
    const h = harness();
    await h.agent.handle(message({ messageId: 100 }));
    const revived = new TelegramAgent(h.options);
    expect(revived.conversationFor(100)).toMatchObject({ botId: "b1", threadId: "thread-b1" });
  });

  it("treats a reply to something it does not know as a new request", async () => {
    const h = harness();
    await h.agent.handle(message({ messageId: 200, replyToMessageId: 12 }));
    expect(h.work[0]).toMatchObject({ botId: "b1" });
  });

  it("tells the user when the Chief could not be reached", async () => {
    const h = harness({ ask: async () => { throw new Error("no engine available"); } });
    await h.agent.handle(message());
    expect(h.work).toEqual([]);
    expect(h.sent[0]!.text).toContain("no engine available");
  });

  it("answers a card from a button press and acknowledges the tap", async () => {
    const acks: string[] = [];
    const h = harness({ ackCallback: async (_id, text) => { acks.push(text ?? ""); } });
    await h.agent.handle({ kind: "callback", updateId: 2, deliveryId: "tg-cb-1", callbackId: "cb1", data: "a:req-7:Allow" });
    expect(h.answered).toEqual([["req-7", "Allow"]]);
    expect(acks[0]).toContain("Allow");
  });

  it("refuses a button payload it did not mint", async () => {
    const h = harness();
    await h.agent.handle({ kind: "callback", updateId: 2, deliveryId: "d", callbackId: "cb1", data: "rm -rf /" });
    expect(h.answered).toEqual([]);
  });

  it("runs one staffing decision at a time", async () => {
    // Two fast messages must not both be told "nobody fits" and both create
    // the same MAUS.
    let inFlight = 0;
    let overlapped = false;
    const h = harness({
      canCreate: () => true,
      ask: async () => {
        inFlight += 1;
        if (inFlight > 1) overlapped = true;
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
        return '{"botId":"b1","why":"x"}';
      },
    });
    await Promise.all([h.agent.handle(message({ messageId: 1 })), h.agent.handle(message({ messageId: 2 }))]);
    expect(overlapped).toBe(false);
    expect(h.work).toHaveLength(2);
  });
});
