// Notifications, driven by the harness's {kind:"notify"} frames. The server
// decides *whether* something is worth an interruption (it owns the per-bot
// toggle); this only decides how to show it here.
//
// Two delivery paths, because there is no single one that works everywhere.
// `new Notification(...)` is the desktop path and is what Electron uses. On
// a phone it is not merely unsupported — Chrome on Android THROWS from that
// constructor, so the frame that carried an approval request died inside the
// handler and the phone showed nothing at all. Where a service worker is
// controlling the page (the installed PWA, which is the whole point of the
// mobile build) the registration's own showNotification is the supported
// call, and the click comes back through sw.js as a postMessage.
import type { Notification as NotifyPayload } from "../../server/notify.ts";

export type NotifyFrame = NotifyPayload;

/** Ask while handling the settings click. Browsers may reject permission
 * requests that are triggered later by an incoming SSE frame. */
export function requestNotificationPermission(): Promise<NotificationPermission> | null {
  if (typeof Notification === "undefined" || Notification.permission !== "default") return null;
  return Notification.requestPermission();
}

/** The most recent handler, so a click routed back from the service worker —
 * which can arrive long after the frame that raised it — still opens the
 * right bot. One listener for the page's lifetime rather than one per
 * notification, which would leak a handler per frame. */
let openBot: ((botId: string) => void) | null = null;
let routerInstalled = false;

function installClickRouter() {
  if (routerInstalled || typeof navigator === "undefined" || !navigator.serviceWorker) return;
  routerInstalled = true;
  navigator.serviceWorker.addEventListener("message", (event: MessageEvent) => {
    const data = event.data as { type?: string; botId?: string } | undefined;
    if (data?.type !== "notification-click" || typeof data.botId !== "string") return;
    openBot?.(data.botId);
  });
}

/** Show one, unless the app is already in front of the user — a banner over
 * the window you are looking at is noise, and the chat itself already shows
 * the card. */
export function showNotification(frame: NotifyFrame, onOpen: (botId: string) => void) {
  if (typeof Notification === "undefined") return;
  if (document.hasFocus()) return;
  if (Notification.permission !== "granted") return;

  openBot = onOpen;
  installClickRouter();

  const options: NotificationOptions = {
    body: frame.body,
    tag: frame.threadId,
    data: { botId: frame.botId, threadId: frame.threadId },
  };

  // A CONTROLLING worker, not merely a registered one: `.ready` resolves for
  // a worker that has not taken this page over yet, and a notification it
  // showed would have no client to route its click back to.
  const controlled = typeof navigator !== "undefined" && Boolean(navigator.serviceWorker?.controller);
  if (controlled) {
    void navigator.serviceWorker.ready
      .then((registration) => registration.showNotification(frame.title, options))
      .catch(() => {
        /* the banner is lost; the card is still in the transcript */
      });
    return;
  }

  // Desktop. The constructor is the only path that gives a direct onclick,
  // and window.focus() is meaningful. Guarded because a browser that has no
  // controlling worker AND rejects the constructor must not take the frame
  // — and the frame it was raised for is an approval request.
  try {
    new Notification(frame.title, options).onclick = () => {
      window.focus();
      onOpen(frame.botId);
    };
  } catch {
    /* nothing can show this here */
  }
}
