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

## Phone interface

On browser screens below 768px, Remote opens the cream and brown
**06 Hızlı Komut** dashboard. The Electron app keeps its existing interface.

- **Başlat** puts the task input and agent selector directly on the home screen,
  followed by compact running-task and pending-answer rows.
- **Araştır / Özetle** insert editable prompts without sending them automatically.
- **Görevi başlat** sends the request to the selected idle agent.
  It creates a separate conversation before sending the request. Failed sends
  retain the text and reuse that context on retry. Drafts also survive tab changes.
- **Geçmiş** opens current and previous conversations. In a conversation,
  send follow-up instructions, answer questions or permissions, and stop work.
- **Ayarlar → Agent'ları yönet** lists the team and provides a task entry point.
- **Ayarlar** also links to automations, workflows, outbound review and app settings.

The connected computer must stay on with MausCrew running. New task submission
is disabled while disconnected. If another device changes the active task
between creation and submission, the server rejects the stale submission so it
cannot land in a different conversation.

## Choosing a layout

The phone ships three interfaces for the same data. Open **Ayarlar → Görünüm**
on the phone and pick one; the choice is stored on that device and changes
nothing on the desktop or on any other paired phone.

- **Karar rayı** (default) — opens on the single decision waiting for you, with
  the crew behind it as a rail of strips: filled while a bot works, capped dark
  while it waits on you. No tab bar.
- **Monospace zen** — a dark console. `ACTIVE` / `AWAITING` / `LATENCY` counters
  (the latency is a measured round trip to the local harness), a process roster
  sorted blocked-first with idle bots folded behind `[+N IDLE]`, a timestamped
  stream of what actually happened, and one command line that accepts
  `@bot komut`. Approvals carry inline `ALLOW` / `DENY`, and the line above the
  prompt reports the targeted bot's state and current step while it works.
- **Sade kumanda** — the original view with a bottom navigation bar.

Every layout answers approvals and questions itself, so a decision can be
settled without opening the chat.

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
- A paired phone may take control of a bot's **cloud** computer and drive it
  (click, scroll, type) — that is how a sign-in or a CAPTCHA gets finished when
  you are away from the desk, and the bot is paused while you hold control.
  Taking over **this computer** or the Local VM stays desktop-only: those act
  on the machine the harness runs on, which is a different risk class from a
  disposable cloud box.

The initial release uses a 30-day browser session. Re-pair the phone after that
period or revoke it sooner from the desktop.
