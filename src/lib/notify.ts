// Desktop notifications, driven by the harness's {kind:"notify"} frames.
// The server decides *whether* something is worth an interruption (it owns
// the per-bot toggle); this only decides how to show it here.
import { MAUS_COLORS, type MausColor } from "@/lib/colors";
import type { Notification } from "../../server/notify.ts";

export type NotifyFrame = Notification;

/** Ask while handling the settings click. Browsers may reject permission
 * requests that are triggered later by an incoming SSE frame. */
export function requestNotificationPermission(): Promise<NotificationPermission> | null {
  if (typeof Notification === "undefined" || Notification.permission !== "default") return null;
  return Notification.requestPermission();
}

/** One banner stack per bot rather than per thread.
 *
 * A thread tag means a bot working three threads stacks three banners and
 * pushes the other bots off the screen; a bot tag means the newest update
 * from that bot replaces its own previous one and every other bot keeps its
 * own slot. Which is what makes the icon below worth drawing. */
export function notificationTag(frame: NotifyFrame): string {
  return `mauscrew-bot:${frame.botId}`;
}

/** Monogram tile in the bot's accent colour, as a data URL.
 *
 * Drawn here instead of shipping ten PNGs: the palette already exists, the
 * avatar is two letters on a rounded square, and a data URL needs no server
 * round-trip on a phone that just woke up. */
export function notificationIcon(frame: NotifyFrame): string {
  const color = MAUS_COLORS[frame.botColor as MausColor] ?? frame.botColor ?? "#377FE6";
  const words = frame.botName.trim().split(/\s+/).filter(Boolean);
  const monogram = words.length === 0
    ? "?"
    : words.length === 1
      ? words[0].slice(0, 2).toUpperCase()
      : (words[0][0] + words[1][0]).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">`
    + `<rect width="128" height="128" rx="30" fill="${color}"/>`
    + `<text x="64" y="64" fill="#ffffff" font-family="system-ui,-apple-system,Segoe UI,sans-serif" `
    + `font-size="52" font-weight="600" text-anchor="middle" dominant-baseline="central">${monogram}</text>`
    + `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function notificationOptions(frame: NotifyFrame): NotificationOptions {
  return {
    body: frame.body,
    tag: notificationTag(frame),
    icon: notificationIcon(frame),
    badge: notificationIcon(frame),
    // Replacing a banner silently is right for a stream of progress; an
    // approval that arrives on top of an older one still has to buzz, or the
    // bot waits forever behind a notification nobody saw.
    renotify: frame.kind === "approval" || frame.kind === "question",
    data: { botId: frame.botId, threadId: frame.threadId, kind: frame.kind },
  } as NotificationOptions;
}

/** Show one, unless the app is already in front of the user — a banner over
 * the window you are looking at is noise, and the chat itself already shows
 * the card. */
export function showNotification(frame: NotifyFrame, onOpen: (botId: string) => void) {
  if (typeof Notification === "undefined") return;
  if (document.hasFocus()) return;

  const open = () => {
    window.focus();
    onOpen(frame.botId);
  };

  if (Notification.permission !== "granted") return;

  // A phone that backgrounded the tab has no `new Notification` — only the
  // service worker registration can post one there, and `renotify` requires
  // that path anyway.
  const registration = navigator.serviceWorker?.controller ? navigator.serviceWorker.ready : null;
  if (registration) {
    void registration
      .then((active) => active.showNotification(frame.title, notificationOptions(frame)))
      .catch(() => {
        new Notification(frame.title, notificationOptions(frame)).onclick = open;
      });
    return;
  }
  new Notification(frame.title, notificationOptions(frame)).onclick = open;
}
