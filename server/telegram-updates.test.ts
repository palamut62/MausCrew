import { describe, expect, it } from "vitest";

import { classifyUpdate, nextOffset, type TelegramUpdate } from "./telegram-updates.ts";

const rules = { chatId: "12345" };

const message = (over: Record<string, unknown> = {}): TelegramUpdate => ({
  update_id: 7,
  message: {
    message_id: 100,
    text: "research competitor pricing",
    date: 1_700_000_000,
    chat: { id: 12345 },
    from: { id: 42 },
    ...over,
  },
});

describe("telegram update rules", () => {
  it("accepts a text message from the paired chat", () => {
    expect(classifyUpdate(message(), rules)).toEqual({
      kind: "message",
      updateId: 7,
      deliveryId: "tg-12345-100",
      text: "research competitor pricing",
      messageId: 100,
      fromUserId: 42,
      at: 1_700_000_000_000,
    });
  });

  it("refuses every chat but the paired one", () => {
    // The bot token is a URL anyone holding it can post to. The paired chat
    // is the only thing standing between that and work on this machine.
    expect(classifyUpdate(message({ chat: { id: 99 } }), rules)).toMatchObject({
      kind: "ignored",
      reason: "message from another chat",
    });
    // Numeric and string forms of the same id are the same chat.
    expect(classifyUpdate(message({ chat: { id: "12345" } }), rules).kind).toBe("message");
  });

  it("refuses a user outside the allow-list when one is set", () => {
    const locked = { chatId: "12345", allowedUserIds: [42] };
    expect(classifyUpdate(message(), locked).kind).toBe("message");
    expect(classifyUpdate(message({ from: { id: 43 } }), locked)).toMatchObject({
      kind: "ignored",
      reason: "message from an unauthorized user",
    });
    // No list means "anyone in the paired chat", which is one person in a DM.
    expect(classifyUpdate(message({ from: { id: 43 } }), rules).kind).toBe("message");
  });

  it("refuses messages from bots", () => {
    // Two bots in one group will otherwise talk each other into a loop.
    expect(classifyUpdate(message({ from: { id: 7, is_bot: true } }), rules)).toMatchObject({
      kind: "ignored",
      reason: "message from a bot",
    });
  });

  it("keeps the id of the message being replied to", () => {
    const verdict = classifyUpdate(message({ reply_to_message: { message_id: 55 } }), rules);
    expect(verdict).toMatchObject({ kind: "message", replyToMessageId: 55 });
  });

  it("derives a delivery id that is stable per Telegram message", () => {
    // Redelivery after a dropped connection must not become a second task.
    const first = classifyUpdate(message(), rules);
    const again = classifyUpdate({ ...message(), update_id: 8 }, rules);
    expect(first.kind === "message" && again.kind === "message" && first.deliveryId === again.deliveryId).toBe(true);
  });

  it("ignores anything with nothing to act on, without throwing", () => {
    for (const update of [
      { update_id: 1 },
      { update_id: 2, message: { chat: { id: 12345 }, text: "   " } },
      { update_id: 3, message: { chat: { id: 12345 }, text: "hi" } },
      {} as TelegramUpdate,
    ]) {
      expect(classifyUpdate(update as TelegramUpdate, rules).kind).toBe("ignored");
    }
  });

  it("accepts a button press from the paired chat", () => {
    const verdict = classifyUpdate(
      {
        update_id: 9,
        callback_query: { id: "cb1", data: "answer:abc:Allow", from: { id: 42 }, message: { message_id: 7, chat: { id: 12345 } } },
      },
      rules,
    );
    expect(verdict).toEqual({
      kind: "callback",
      updateId: 9,
      deliveryId: "tg-cb-cb1",
      callbackId: "cb1",
      data: "answer:abc:Allow",
      messageId: 7,
      fromUserId: 42,
    });
  });

  it("refuses a button press from another chat or user", () => {
    const foreign = {
      update_id: 9,
      callback_query: { id: "cb1", data: "x", from: { id: 42 }, message: { message_id: 7, chat: { id: 999 } } },
    };
    expect(classifyUpdate(foreign, rules).kind).toBe("ignored");
  });

  it("acknowledges past everything it saw, including what it refused", () => {
    // Otherwise a single rejected update is redelivered forever and blocks
    // the ones behind it.
    expect(nextOffset([{ update_id: 4 }, { update_id: 9 }, { update_id: 6 }], 0)).toBe(10);
    expect(nextOffset([], 12)).toBe(12);
    expect(nextOffset([{} as TelegramUpdate], 3)).toBe(3);
  });
});
