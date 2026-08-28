import { afterEach, describe, expect, it, vi } from "vitest";

import { requestNotificationPermission, showNotification, type NotifyFrame } from "./notify";

const frame: NotifyFrame = {
  kind: "done",
  botId: "bot-1",
  botName: "Maus",
  threadId: "thread-1",
  title: "Maus finished",
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
  vi.stubGlobal("navigator", {});
  return { notices, requestPermission };
}

/** A service worker that has actually taken the page over — the installed
 * PWA. `new Notification(...)` throws on Chrome for Android, so this is the
 * only path that shows anything on a phone. */
function installServiceWorker() {
  const shown: Array<{ title: string; options?: NotificationOptions }> = [];
  const registration = {
    showNotification: vi.fn(async (title: string, options?: NotificationOptions) => {
      shown.push({ title, options });
    }),
  };
  vi.stubGlobal("navigator", {
    serviceWorker: {
      controller: {},
      ready: Promise.resolve(registration),
      addEventListener: vi.fn(),
    },
  });
  return { shown };
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
    expect(notices[0]).toMatchObject({ title: frame.title, options: { body: frame.body, tag: frame.threadId } });
  });

  it("goes through the service worker when one controls the page", async () => {
    const { notices } = installNotification("granted");
    const { shown } = installServiceWorker();
    showNotification(frame, vi.fn());
    await vi.waitFor(() => expect(shown).toHaveLength(1));
    // The constructor is what throws on Chrome for Android; it must not be
    // reached once a worker is available to do this properly.
    expect(notices).toHaveLength(0);
    // The click comes back through sw.js rather than an onclick, so the bot
    // has to travel with the notification.
    expect(shown[0].options).toMatchObject({ data: { botId: frame.botId, threadId: frame.threadId } });
  });

  it("does not lose the frame when the constructor is unavailable", () => {
    installNotification("granted");
    vi.stubGlobal("Notification", class {
      static permission: NotificationPermission = "granted";
      constructor() {
        throw new TypeError("Illegal constructor");
      }
    });
    expect(() => showNotification(frame, vi.fn())).not.toThrow();
  });
});
