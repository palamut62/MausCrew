const CACHE = "mauscrew-shell-v2";
const SHELL_ASSETS = ["/", "/favicon.ico", "/app-icon-192.png", "/app-icon-512.png"];
// Paths this worker must never touch. `/api/` is the live command surface.
// `/frames/` is a parked screenshot of the user's own desktop — the server
// marks those `no-store` for exactly that reason, and CacheStorage does NOT
// honour Cache-Control, so without this prefix the worker writes desktop
// captures to the paired phone's disk with no TTL and no way to clear them
// when the device is revoked.
const NEVER_CACHE = ["/api/", "/frames/"];
/** Same-origin, successful, and not explicitly marked no-store. An error page
 * or a SPA-fallback 404 that got cached is served back the next time the phone
 * is offline, which is worse than showing nothing. */
const mayCache = (response) =>
  response.ok
  && response.type === "basic"
  && !(response.headers.get("cache-control") || "").toLowerCase().includes("no-store");

self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL_ASSETS))));

// Deliberately no skipWaiting(). A page that is already open keeps whatever JS
// it loaded, and shiki arrives through a dynamic import — so a shell that took
// over mid-session would ask for a chunk hash the updated server no longer has.
// Waiting for every client to close means the old cache is still there to serve
// that chunk, and by the time this runs nothing depends on it, which is what
// makes deleting the previous versions safe here rather than merely tidy.
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name.startsWith("mauscrew-") && name !== CACHE).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  ),
);

// A notification shown through this worker (the installed PWA path — see
// src/lib/notify.ts) has no page-side onclick, so the click comes back here.
// Focus an existing window rather than opening a second one, and tell it
// which bot to select; opening a bare "/" would land the user on whatever
// chat they had last and hide the request they just tapped.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const botId = event.notification.data && event.notification.data.botId;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => client.url.startsWith(self.registration.scope));
      if (open) {
        if (botId) open.postMessage({ type: "notification-click", botId });
        return open.focus();
      }
      // Nothing running: the fresh page cannot receive a postMessage, so the
      // bot travels in the URL and the app reads it on load.
      return self.clients.openWindow(botId ? `/?bot=${encodeURIComponent(botId)}` : "/");
    }),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const { pathname } = new URL(event.request.url);
  if (NEVER_CACHE.some((prefix) => pathname.startsWith(prefix))) return;
  event.respondWith(fetch(event.request).then((response) => {
    if (mayCache(response)) {
      const copy = response.clone();
      void caches.open(CACHE).then((cache) => cache.put(event.request, copy));
    }
    return response;
  }).catch(() => caches.match(event.request)));
});
