# Security Policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Use GitHub's private vulnerability
reporting on this repository — **Security → Report a vulnerability**, or go straight to
<https://github.com/palamut62/MausCrew/security/advisories/new>. The report stays private to the
maintainer until a fix ships, and you'll get a response as soon as possible, normally within a few
days.

There is deliberately no security mailing address: the private advisory is the only channel, so a
report cannot sit unread in someone's personal inbox.

## Scope notes for researchers

- The harness server binds **127.0.0.1 only** and has no authentication for local callers by
  design — it trusts the local user. Anything that makes it reachable from off-machine, or lets one
  local *unprivileged other user* drive it, is a vulnerability.
- **Mobile remote access is the one second ingress.** When it is enabled, the server also accepts
  requests whose `Host` matches the configured HTTPS reverse-proxy origin, and every `/api/` and
  `/frames/` request through it needs a paired-device cookie. Reaching those paths without a valid
  pairing, reaching a desktop-only route (provider credentials, device administration) from a paired
  phone, or slipping past the host/origin checks is a vulnerability. See
  [`docs/mobile-remote.md`](docs/mobile-remote.md) for the intended boundary.
- API keys live in `~/.mauscrew/config.json` and are write-only through the API (`configured`
  booleans out, never values). Any path that echoes a stored secret back — API response, SSE event,
  log line, argv visible in `ps` — is a vulnerability.
- Agents run real CLIs (`claude`, `codex`, `grok`) with the user's own privileges, and the DeepSeek
  Harness engine drives DeepSeek's own JSON-RPC runtime. The permission broker is the consent layer
  for risky actions across all of them. Bypasses of the broker — approving without a user decision,
  spoofing the broker socket, or a driver emitting a tool call that never reaches a card — are
  vulnerabilities.
- The DeepSeek sandbox modes are a boundary worth testing: `workspace-write` must confine filesystem
  mutations to the selected workspace, and `read-only` must refuse mutation. A path escape out of
  the selected workspace is a vulnerability.
- Webhook triggers authenticate with a per-endpoint secret on a **separate** loopback receiver
  (default `127.0.0.1:8800`). That receiver must expose only `/health` and `/hooks/...` — any route
  on it that reaches the broader API is a vulnerability.
- Spawning must never route user-influenced strings through a shell. Report any `shell: true` /
  `cmd.exe` string-building you find.
