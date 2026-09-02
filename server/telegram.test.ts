import { describe, expect, it, vi } from "vitest";

import type { AppConfig } from "./config.ts";
import type { Notification } from "./notify.ts";
import { discoverTelegramChat, sendTelegramMessage, sendTelegramNotification, telegramAnswerButtons, telegramNotificationText, telegramNotificationTexts, validTelegramChatId, verifyTelegramBot } from "./telegram.ts";

const notification: Notification = {
  kind: "done",
  botId: "bot-1",
  botName: "Waffle",
  botTitle: "Research lead",
  botColor: "yellow",
  threadId: "thread-1",
  title: "Waffle finished",
  body: "The report is ready.",
  detail: "The report is ready.",
};

describe("Telegram notifications", () => {
  it("names the bot and marks the kind without asserting a language", () => {
    // The report underneath is written in whatever language the user writes
    // in, so a fixed Turkish or English label would be wrong half the time.
    expect(telegramNotificationText(notification)).toBe(
      "🟡 Waffle · Research lead ✅\n\nThe report is ready.",
    );
    expect(telegramNotificationText({ ...notification, kind: "approval" })).toContain("🔐");
    expect(telegramNotificationText({ ...notification, kind: "question" })).toContain("❓");
    expect(telegramNotificationText({ ...notification, kind: "routine-failed" })).toContain("⚠️");
  });

  it("delivers a long report in complete ordered Telegram messages", () => {
    const report = `${"x".repeat(4_050)}\n${"y".repeat(4_050)}`;
    const messages = telegramNotificationTexts({ ...notification, detail: report });
    // What matters is that every part fits and nothing is lost — not how many
    // parts it takes, which moves whenever the header changes length.
    expect(messages.length).toBeGreaterThan(1);
    expect(messages.every((message) => message.length <= 4096)).toBe(true);
    expect(messages.join("\n").match(/x/g)).toHaveLength(4_050);
    expect(messages.join("\n").match(/y/g)).toHaveLength(4_050);
    expect(messages[1]).toContain("· 2");
  });

  it("accepts numeric chats and channel usernames only", () => {
    expect(validTelegramChatId("123456")).toBe(true);
    expect(validTelegramChatId("-1001234567890")).toBe(true);
    expect(validTelegramChatId("@mauscrew_alerts")).toBe(true);
    expect(validTelegramChatId("https://t.me/example")).toBe(false);
  });

  it("verifies the BotFather token with getMe", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      result: { id: 42, username: "mauscrew_bot", first_name: "MausCrew" },
    }), { status: 200 })) as unknown as typeof fetch;
    await expect(verifyTelegramBot("42:secret", fetcher)).resolves.toEqual({
      id: 42,
      username: "mauscrew_bot",
      displayName: "MausCrew",
    });
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.telegram.org/bot42:secret/getMe",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("sends to the configured chat and stays quiet when disabled", async () => {
    const mockFetch = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) =>
      new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), { status: 200 }));
    const fetcher = mockFetch as unknown as typeof fetch;
    const cfg: AppConfig = { telegram: { botToken: "42:secret", chatId: "123", enabled: true } };
    await expect(sendTelegramNotification(cfg, notification, fetcher)).resolves.toBe(true);
    const request = mockFetch.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({ chat_id: "123", text: expect.stringContaining("Waffle") });

    cfg.telegram!.enabled = false;
    await expect(sendTelegramNotification(cfg, notification, fetcher)).resolves.toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("sends every part of a report instead of truncating it", async () => {
    const mockFetch = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) =>
      new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), { status: 200 }));
    const report = "x".repeat(5_000);
    await expect(sendTelegramNotification(
      { telegram: { botToken: "42:secret", chatId: "123", enabled: true } },
      { ...notification, detail: report },
      mockFetch as unknown as typeof fetch,
    )).resolves.toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const sent = mockFetch.mock.calls.map(([, init]) => JSON.parse(String((init as RequestInit).body)).text as string);
    expect(sent.every((text) => text.length <= 4096)).toBe(true);
    expect(sent.join("\n").match(/x/g)).toHaveLength(5_000);
  });

  it("discovers the latest chat after the user sends /start", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      result: [{ message: { chat: { id: 987, first_name: "Umut" } } }],
    }), { status: 200 })) as unknown as typeof fetch;
    await expect(discoverTelegramChat({ telegram: { botToken: "42:secret" } }, fetcher)).resolves.toEqual({
      id: "987",
      label: "Umut",
    });
  });
});

describe("telegram outbound", () => {
  const cfg = { telegram: { botToken: "t", chatId: "12345", enabled: true } };
  const reply = (result: unknown) =>
    new Response(JSON.stringify({ ok: true, result }), { status: 200, headers: { "content-type": "application/json" } });

  it("returns the sent message id so replies can be traced back", async () => {
    const fetcher = vi.fn(async () => reply({ message_id: 77 })) as unknown as typeof fetch;
    expect(await sendTelegramMessage(cfg, "hello", {}, fetcher)).toBe(77);
  });

  it("threads a reply but never fails the send when the parent is gone", async () => {
    let body: any;
    const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
      body = JSON.parse(String(init.body));
      return reply({ message_id: 78 });
    }) as unknown as typeof fetch;
    await sendTelegramMessage(cfg, "hi", { replyTo: 12 }, fetcher);
    expect(body.reply_to_message_id).toBe(12);
    expect(body.allow_sending_without_reply).toBe(true);
  });

  it("sends nothing when Telegram is not configured", async () => {
    const fetcher = vi.fn() as unknown as typeof fetch;
    expect(await sendTelegramMessage({ telegram: { botToken: "", chatId: "" } }, "x", {}, fetcher)).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("builds one button per answer, carrying the request id", () => {
    expect(telegramAnswerButtons("req-1", ["Allow", "Deny"])).toEqual([
      [{ label: "Allow", data: "a:req-1:Allow" }],
      [{ label: "Deny", data: "a:req-1:Deny" }],
    ]);
  });

  it("offers no buttons when the answers would not fit Telegram's 64-byte payload", () => {
    // The person types the answer instead; a truncated callback would answer
    // the wrong thing.
    expect(telegramAnswerButtons("req-1", ["x".repeat(80)])).toEqual([]);
    expect(telegramAnswerButtons("req-1", [])).toEqual([]);
  });
});
