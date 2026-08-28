# Mobile remote access

MausCrew Remote is a PWA served by the same local harness as the desktop app.
The desktop owns agents, provider sessions, workspaces and credentials. A paired
phone is an authenticated client; it does not receive provider keys or native
session cursors.

## Set up with Tailscale Serve

1. Install Tailscale on the computer and phone, and sign both into the same
   tailnet.
2. Keep MausCrew running. Open **Settings → Mobile**.
3. Run the command shown in the panel. It uses the actual harness port selected
   by the desktop app, for example:

   ```powershell
   tailscale serve --bg localhost:8799
   ```

4. Copy the HTTPS address printed by Tailscale, including its full
   `https://...ts.net` host, into **HTTPS address** and select **Enable**.
5. Select **Create pairing link**, copy the link to the phone, and approve the
   connection there. The code is single-use and expires after ten minutes.
6. In the mobile browser, use **Add to Home Screen** to install the PWA.

Tailscale Serve terminates HTTPS and proxies to the loopback-only server. Its
current syntax and HTTPS behavior are documented in the official
[Tailscale Serve CLI reference](https://tailscale.com/docs/reference/tailscale-cli/serve).
Do not replace Serve with a public router port-forward.

## Security boundary

- The harness remains bound to `127.0.0.1`; remote access does not open a LAN
  listener.
- Only the exact configured HTTPS host and Origin are accepted.
- Pairing exchanges a short-lived, single-use code for a random 256-bit token.
- The token is stored in a `Secure`, `HttpOnly`, `SameSite=Strict` cookie and
  cannot be read by browser JavaScript.
- Stored device records contain only a SHA-256 token digest, not the token.
- Pairing claims are rate-limited. A device can be revoked immediately from
  **Settings → Mobile**.
- Provider credential changes, new pairings and device administration are
  rejected on remote sessions.

The initial release uses a 30-day browser session. Re-pair the phone after that
period or revoke it sooner from the desktop. When that session ends the event
stream is refused, and the app reloads onto this pairing screen rather than
sitting silently on a dead connection.

## What a paired phone can do

- Chat with bots and rooms, steer or queue a message into a running turn,
  attach files, answer approval requests and questions.
- Switch or start a **task** on a bot, and change its **model**, from that bot's
  own settings panel. The chat header only carries those controls on a wide
  screen.
- Follow routines, webhook deliveries and the bot's computer panel.

Everything under app **Settings** is desktop-only — provider keys, MCP servers,
AG-UI agents, security policy, device pairing — so the phone shows one notice
there instead of forms the harness would refuse. Voice calls are desktop-only
for a different reason: dictation runs through the native Electron bridge,
which does not exist in a browser.

## Connection behaviour

The phone holds one SSE stream and owns its own reconnection, because a browser
`EventSource` does not survive the things a phone does to it:

- Live desktop captures are requested **only while the computer panel is open**.
  They are hundreds of kilobytes every few seconds, and on a cellular link they
  were what filled the server's per-client buffer and got the connection
  dropped.
- The server's keepalive is a real `{"kind":"ping"}` frame rather than an SSE
  comment, so the client can time out a stream that died while the phone was
  asleep — a suspended socket can still read as `OPEN`.
- Waking the app, coming back online, or pressing **Try again** on the
  disconnection banner reconnects with an explicit cursor, so the server
  replays the gap instead of the app re-downloading every transcript.
- A stream refused with 401 means the pairing is gone; anything else is
  retried with backoff.

## Notifications

In the installed PWA, notifications are shown through the service worker
(`ServiceWorkerRegistration.showNotification`) — the `new Notification(...)`
constructor the desktop uses throws on Chrome for Android. Tapping one focuses
the app and selects the bot that raised it.

This covers the app being open or backgrounded, which is where its SSE stream
is still alive. It does **not** cover the app being fully closed: that needs
Web Push (VAPID keys, a subscription store and a server-side sender), which is
not implemented.
