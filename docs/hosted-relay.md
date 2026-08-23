# Hosted relay — 24/7 readiness

**Status: preparation document, not a shipped feature.** Today MausCrew is a
desktop app: close the window (or the machine sleeps) and webhook deliveries
miss their receiver and routines stop firing. This doc records what already
runs headless, what never will, and the concrete steps to run the harness on an
always-on host. Nothing here requires code changes that do not exist yet —
each gap is listed explicitly in "Gaps" at the bottom.

## What already runs without Electron

The harness is a plain Node process; the desktop app merely forks it
(`utilityProcess.fork(resourcesPath/server/index.js)`) with a few env vars. The
same process boots standalone today:

| Capability | Headless? | Notes |
| --- | --- | --- |
| Chat, agents, streaming, approvals | yes | core API + SSE on `MAUSCREW_PORT` |
| Routine scheduler (`server/routines.ts`) | yes | lives in the server process |
| Webhook receiver | yes | separate loopback listener, `MAUSCREW_WEBHOOK_PORT`, default port+1 (8800) |
| Mobile PWA + pairing | yes | served from `MAUSCREW_STATIC_DIR` (the built client) |
| Event log, transcripts, audit | yes | files under `MAUSCREW_DATA_DIR` (default `~/.mauscrew`) |
| Calls & dictation | no | renderer mic capture + macOS speech helper live in Electron |
| Screen preview / computer control of the host | no | needs a real logged-in GUI session |
| Tray, auto-update, notifications | no | Electron-side by design |

## Reference deployment (Linux box or VPS)

```bash
# build once on a dev machine (or on the host)
pnpm install && pnpm package:prepare   # → dist/ (client), dist-server/ (server)

# on the always-on host
export MAUSCREW_PORT=8799
export MAUSCREW_WEBHOOK_PORT=8800
export MAUSCREW_DATA_DIR=/var/lib/mauscrew
export MAUSCREW_STATIC_DIR=/opt/mauscrew/dist     # serves the PWA at /
node dist-server/index.js                          # binds 127.0.0.1 only
```

The server keeps its loopback-only bind in every mode — a hosted deployment
must not change that. Reach it through an authenticated proxy instead:

- **Private use (your devices only):** Tailscale Serve, as documented in
  [`mobile-remote.md`](mobile-remote.md). Pairing and device admin stay
  desktop-only, which on a headless box means: pair once from a temporary
  desktop run against the same data dir, then revoke/re-pair from the phone.
- **Public webhook delivery:** expose **only** the dedicated webhook receiver
  (8800) through Tailscale Funnel, cloudflared, or an equivalent TLS proxy.
  It speaks only `/health` and secret-bearing `/hooks/...` endpoints and can be
  re-exposed safely without ever publishing the main API.

### Process supervision (systemd)

```ini
# /etc/systemd/system/mauscrew.service
[Unit]
Description=MausCrew harness
After=network-online.target

[Service]
User=mauscrew
Environment=MAUSCREW_PORT=8799
Environment=MAUSCREW_WEBHOOK_PORT=8800
Environment=MAUSCREW_DATA_DIR=/var/lib/mauscrew
Environment=MAUSCREW_STATIC_DIR=/opt/mauscrew/dist
ExecStart=/usr/bin/node /opt/mauscrew/dist-server/index.js
Restart=on-failure
RestartSec=3
# hardening
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ReadWritePaths=/var/lib/mauscrew

[Install]
WantedBy=multi-user.target
```

On Windows (a home PC acting as the host) the same env vars work under Task
Scheduler or NSSM; keep the "wake timers allowed / restart on failure"
equivalents.

## Security checklist

- [ ] Harness stays on `127.0.0.1`; no router port-forward of 8799, ever.
- [ ] Only the webhook receiver is publicly reachable, via TLS proxy, bearer
      secret configured.
- [ ] `MAUSCREW_DATA_DIR` backed up (bots, transcripts, config; provider keys
      inside `config.json` are write-only through the API but sit in the file —
      protect the directory like a secrets store, `chmod 700`).
- [ ] Remote sessions still cannot touch credentials or device admin (existing
      server-side rejection — verify after any proxy change).
- [ ] Monitor `GET /health` on both ports (main + webhook receiver); alert when
      either stops answering.
- [ ] Keep the host patched; the harness runs agent processes with your
      workspace permissions — treat the host as trusted.

## Gaps before this becomes a supported mode

1. **No headless smoke test in CI** — boot `dist-server/index.js` against a
   throwaway `MAUSCREW_DATA_DIR`, assert `/health`, routine tick, and a webhook
   round-trip. Without it, every refactor can silently break hosted use.
2. **Pairing/admin ergonomics headless** — device administration assumes the
   desktop Settings panel; a CLI (`mauscrew pair list/revoke`) would remove the
   one desktop dependency.
3. **Sleep/suspend awareness** — the desktop app lets the OS sleep; a hosted
   profile should document/inhibit suspend so routine schedules are honest.
4. **Update story** — auto-update belongs to Electron; a hosted deployment
   needs a documented upgrade procedure (stop, replace dist-server, start;
   data dir format migrations are forward-compatible).
5. **Multi-instance ports** — two hosts sharing one data dir is unsupported;
   document it loudly rather than discovering it via corrupted NDJSON logs.

## Product owner

Umut Çelik (palamut62) — [X](https://x.com/palamut62) ·
[GitHub](https://github.com/palamut62)
