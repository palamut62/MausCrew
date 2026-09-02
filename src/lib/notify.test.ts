import { afterEach, describe, expect, it, vi } from "vitest";

import { requestNotificationPermission, showNotification, type NotifyFrame } from "./notify";

const frame: NotifyFrame = {
  kind: "done",
  botId: "bot-1",
  botName: "Maus",
  threadId: "thread-1",
  title: "Maus finished",
  detail: "All done",
  body: "All done",
};

function installNotification(permission: NotificationPermission) {
  const notices: Array<{ title: string; options?: NotificationOptions; onclick: (() => void) | null }> = [];
  const requestPermission = vi.fn(async () => "granted" as NotificationPermission);
  class FakeNotification {
    static permission = permission;
    static requestPermission = requestPermission;
    onclick: (() => void) | null = null;
    constructor(public title: string, public options?: NotificationOptions) {
      notices.push(this);
    }
  }
  vi.stubGlobal("Notification", FakeNotification);
  vi.stubGlobal("document", { hasFocus: () => false });
  vi.stubGlobal("window", { focus: vi.fn() });
  return { notices, requestPermission };
}

afterEach(() => vi.unstubAllGlobals());

describe("desktop notifications", () => {
  it("does not request permission from a background notification frame", () => {
    const { notices, requestPermission } = installNotification("default");
    showNotification(frame, vi.fn());
    expect(requestPermission).not.toHaveBeenCalled();
    expect(notices).toHaveLength(0);
  });

  it("requests permission through the explicit settings action", async () => {
    const { requestPermission } = installNotification("default");
    await requestNotificationPermission();
    expect(requestPermission).toHaveBeenCalledOnce();
  });

  it("shows a notification after permission is granted", () => {
    const { notices } = installNotification("granted");
    showNotification(frame, vi.fn());
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ title: frame.title, options: { body: frame.body } });
  });

  it("groups per bot rather than per thread, and wears that bot's colour", () => {
    const { notices } = installNotification("granted");
    showNotification({ ...frame, threadId: "thread-1", botColor: "purple" }, vi.fn());
    showNotification({ ...frame, threadId: "thread-2", botColor: "purple" }, vi.fn());
    // Same bot, two threads, one tag: the second banner replaces the first
    // instead of stacking a second one over the other bots.
    expect(notices.map((notice) => notice.options?.tag)).toEqual(["mauscrew-bot:bot-1", "mauscrew-bot:bot-1"]);
    const icon = String(notices[0].options?.icon ?? "");
    expect(icon.startsWith("data:image/svg+xml,")).toBe(true);
    expect(decodeURIComponent(icon)).toContain("#8057C8");
    expect(decodeURIComponent(icon)).toContain(">MA<");
  });

  it("renotifies for an approval and stays silent for a status update", () => {
    const { notices } = installNotification("granted");
    showNotification({ ...frame, kind: "approval" }, vi.fn());
    showNotification({ ...frame, kind: "done" }, vi.fn());
    expect((notices[0].options as { renotify?: boolean }).renotify).toBe(true);
    expect((notices[1].options as { renotify?: boolean }).renotify).toBe(false);
  });
});
