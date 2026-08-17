# DeepSeek Harness bridge

`bridge.py` is the Python half of the DeepSeek Harness driver. It is a
long-lived process: OpenMausBot starts one per enabled provider instance on
the first turn and keeps it for the instance's lifetime.

It is not a library. Nothing imports it; it is spawned, spoken to over stdin,
and read from stdout.

## Why a separate process at all

The DeepSeek Harness SDK is Python. OpenMausBot's server is Node. The SDK also
has no per-call system-prompt parameter — a bot's persona reaches the model
only through the runtime composition's process-global `DSH_SYSTEM_PROMPT` — so
one persona means one process. That is what makes "one bridge per provider
instance" a requirement rather than a performance choice.

## Protocol

Newline-delimited JSON, one object per line, UTF-8.

- **stdout carries only protocol JSON.** Every log line goes to stderr. A
  stray `print()` corrupts the stream (spec §23).
- **stdin carries commands**: `turn.start`, `turn.cancel`, `approval.respond`,
  `shutdown`.
- **stdout carries messages**: `bridge.ready` (first, always), `turn.started`,
  `session.started`, `assistant.delta`, `reasoning.delta`,
  `assistant.message`, `tool.started`, `tool.completed`, `token.usage`,
  `approval.requested`, `turn.completed`, `error`.

`PROTOCOL_VERSION` is declared on both sides — here and in
`../../drivers/deepseek/bridge-protocol.ts` — and the Node side refuses to
drive a bridge outside the range it supports. Bump both together, and only for
breaking changes; adding a message type is not breaking, because the Node
parser ignores types it does not know.

Correlation is by `requestId`. One bridge multiplexes every thread, so a
message without its request id cannot be attributed to a turn and is dropped.

## Environment

The bridge receives an allowlisted environment, built from nothing rather than
filtered from the server's own (see `process-manager.ts`). It reads:

| Variable | Meaning |
| --- | --- |
| `DEEPSEEK_API_KEY` | credentials for the configured provider |
| `DEEPSEEK_BASE_URL` | custom endpoint; unset means the SDK default |
| `DSH_BRIDGE_PROVIDER` | provider id passed to the composition |
| `DSH_BRIDGE_MODEL` | default model when a turn does not name one |
| `DSH_SESSION_ROOT` | where session JSONL logs live |
| `DSH_CORDIS_CONFIG` | optional Cordis composition config path |
| `DSH_CWD` | workspace the agent may work in |

Nothing else is forwarded. Notably absent by design: `AWS_*`, `GITHUB_TOKEN`,
`NPM_TOKEN`, `SSH_AUTH_SOCK`, `DATABASE_URL`.

## Requirements

Python 3.10+ and `deepseek-harness-sdk`:

```bash
python3 -m pip install --pre deepseek-harness-sdk
```

The runtime ships wheels for linux-x64, linux-arm64 and macos-arm64 only.
**On Windows there is no native path** — install inside WSL2 and set the
driver's runtime mode to `wsl`.

If the SDK is missing, the bridge emits one `error` message with code
`sdk_missing` and exits `3`, so the driver can tell the user what to install
instead of showing a traceback.

## Current limits

- `cancel` is reported `false`: the SDK exposes no cancellation, so
  `turn.cancel` stops relaying and settles the turn while the underlying call
  runs to completion.
- `approvals` is reported `false`: there is no approval broker yet, which is
  why the driver refuses to run outside a scoped workspace.

Both are reported honestly in the `bridge.ready` capabilities rather than
claimed and faked.

---

Ürün sahibi: Umut Çelik ([X](https://x.com/palamut62) · [GitHub](https://github.com/palamut62))
