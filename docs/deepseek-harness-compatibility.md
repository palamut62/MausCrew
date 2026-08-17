# DeepSeek Harness compatibility

What this build was validated against, and what it deliberately does not do.
Check this before bumping the SDK pin or reporting a capability as working.

Verified: 2026-08-17, against `deepseek-harness-sdk` **0.1.0rc6**.

## Versions

| Component | Pinned | Where |
| --- | --- | --- |
| `deepseek-harness-sdk` | `0.1.0rc6` | [`server/bridges/deepseek/requirements-deepseek.txt`](../server/bridges/deepseek/requirements-deepseek.txt) |
| `deepseek-harness-runtime-bin` | `0.1.0rc6` (hash-pinned, resolved by the SDK) | same file |
| Bridge protocol | `1` | `bridge.py` and `server/drivers/deepseek/bridge-protocol.ts` |
| Python | 3.10+ | required by the SDK |

License notices and a component inventory for everything the Python bridge
pulls in live in
[`server/bridges/deepseek/THIRD-PARTY-NOTICES.md`](../server/bridges/deepseek/THIRD-PARTY-NOTICES.md)
and [`server/bridges/deepseek/sbom.json`](../server/bridges/deepseek/sbom.json)
(CycloneDX 1.5) — spec §66. Both cover only the opt-in DeepSeek Harness
engine; they are not part of OpenMausBot's own dependency tree.

The SDK is pre-release (`rc`), so `pip install` needs `--pre`. Its version
number will move before it stabilizes; the handshake exists so a mismatched
pair fails with a sentence the user can act on rather than by misreading a
notification.

## Platforms

The runtime binary, not the Python code, is what constrains this.

| Platform | Runtime mode | Support |
| --- | --- | --- |
| Linux x64 | `external-python` | supported |
| Linux ARM64 | `external-python` | supported |
| macOS ARM64 | `external-python` | supported |
| macOS x64 (Intel) | — | **unsupported** — no runtime wheel is published |
| Windows | `wsl` | supported **only** through WSL2; there is no native wheel |

On Windows the driver defaults to `wsl` mode rather than to something that
would certainly fail. The SDK must be installed inside the distribution, and
workspace paths are translated to `/mnt/<drive>/...` on the way in.

## Capabilities

Reported in the `bridge.ready` handshake and in the adapter's `capabilities`.
Anything listed as no is reported as no, never approximated.

| Capability | This build | Why |
| --- | --- | --- |
| Streaming assistant text | yes | `assistant/chunk` notifications relayed as they arrive |
| Streaming reasoning | yes | same channel, `reasoning-delta` chunks |
| Tool call visibility | yes | `tool/call` and `tool/result` become item events |
| Token usage | yes | reported per turn |
| Session continuation | yes | deterministic `dsh:<instanceId>:<threadId>` session ids |
| Mid-turn cancellation | **no** | the SDK exposes no cancellation API; interrupting settles the turn while the underlying call finishes |
| Tool approvals | **no** | no approval broker yet, which is why the driver refuses any sandbox mode wider than `workspace` |
| In-session model switch | **no** | the model is fixed when the runtime composition is built |
| Per-turn system prompt | **no** | the SDK has no such parameter — persona reaches the model only through the composition's process-global prompt, which is why there is one bridge process per provider instance |
| MCP integrations (agents / computer / composio) | **no** | the driver does not mount them, so it does not claim them |

## Environment reaching the bridge

Deny-by-default. The child's environment is built from nothing rather than
filtered from the server's, so a variable added to the server later cannot
start leaking silently.

Passed: `PATH`, `PYTHONUNBUFFERED`, `PYTHONIOENCODING`, `SystemRoot`, `TEMP`,
`TMP`, `COMSPEC`, `HOME`, `USERPROFILE`, `LANG`, `TZ`, `DEEPSEEK_API_KEY`,
`DEEPSEEK_BASE_URL`, `DSH_BRIDGE_PROVIDER`, `DSH_BRIDGE_MODEL`,
`DSH_SESSION_ROOT`, `DSH_CORDIS_CONFIG`, `DSH_CWD`, plus explicit per-instance
overrides.

Never passed: `AWS_*`, `GITHUB_TOKEN`, `NPM_TOKEN`, `SSH_AUTH_SOCK`,
`DATABASE_URL`, or anything else in the server's own environment.

## Before bumping the pin

1. Re-read the SDK's notification shapes — `assistant/chunk`, `tool/call`,
   `tool/result`, `turn/end` — against `bridge.py`'s `forward_notification`.
2. Re-check whether a cancellation API or a per-call system prompt has
   appeared. Either would change the rows above and the one-process-per-
   instance design.
3. Run the driver contract tests, then the opt-in live test with a real key.
4. Update this file's "Verified" line and the version table.

---

Ürün sahibi: Umut Çelik ([X](https://x.com/palamut62) · [GitHub](https://github.com/palamut62))
