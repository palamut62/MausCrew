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
engine; they are not part of MausCrew's own dependency tree.

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
workspace, session, composition, and native JSON-RPC initialization paths are
translated to `/mnt/<drive>/...` on the way in.

## Runtime strategies and transport

| Strategy | Location | Transport | Notes |
| --- | --- | --- | --- |
| `system` | configured/system Python | Python bridge | smallest app package; the user owns Python and SDK updates |
| `managed` | `~/.mauscrew/runtimes/deepseek/venv` | Python bridge | isolates the pinned SDK from system packages |
| `bundled` | executable carried by `deepseek-harness-runtime-bin` | native JSON-RPC | Python only resolves the installed carrier path; it is not in the turn data path |

The strategy is selectable in Settings and is persisted independently from
the API key. New configurations default to `bundled`/native; an older config
that explicitly names Python remains on the compatibility transport. A
missing interpreter, managed venv, or runtime carrier reports
an unavailable engine with a setup reason; it never falls through to another
installation silently. The Python transport remains available for one release
as a compatibility path while native live coverage accumulates.

## Capabilities

Reported in the `bridge.ready` handshake and in the adapter's `capabilities`.
Anything listed as no is reported as no, never approximated.

| Capability | This build | Why |
| --- | --- | --- |
| Streaming assistant text | yes | `assistant/chunk` notifications relayed as they arrive |
| Streaming reasoning | yes | same channel, `reasoning-delta` chunks |
| Tool call visibility | yes | `tool/call` and `tool/result` become item events |
| Token usage | yes | reported per turn |
| Session continuation | yes | one live runtime session per thread; after a process/app restart the active MausCrew transcript is replayed once into a history-derived incarnation id |
| Mid-turn cancellation | **no** | the SDK exposes no cancellation API; interrupting settles the turn while the underlying call finishes |
| Tool approvals | yes | risky calls use the MausCrew file-mailbox broker and render Allow/Deny cards |
| In-session model switch | **no** | the model is fixed when the runtime composition is built |
| Per-turn system prompt | **no** | the SDK has no such parameter — persona reaches the model only through the composition's process-global prompt, which is why there is one bridge process per provider instance |
| DeepSeek subagents | yes | ancestry, status, provider, result, and handoff details map to expandable activity cards |
| Workspace skills | yes | Bot Settings manages portable `.agents/skills/<name>/SKILL.md` bundles; the upstream skill registry discovers them and enforces model/user invocation policy |
| Dynamic Cordis plugins | experimental, host-only | opt in per bot; inspect/define/lifecycle tools are exposed, but activating code always requires one-time approval and browser client/UI halves are rejected |
| MCP integrations (agents / computer / composio) | platform-dependent | generated Cordis mounts are enabled only where their transport is runnable; WSL withholds host-only stdio mounts |
| Sandbox modes | yes | `read-only`, `workspace-write`, and `danger-full-access` map to upstream policy values |

In restricted sandbox modes the current rc6 carrier's unconfined
`dsh-bash-local` tool is not exposed. Safe file editing remains available via
`dsh-fs-sandbox` plus `dsh-tool-str-replace-editor`. Full access explicitly
enables local shell/jobs, still behind the MausCrew approval gate. A live WSL
test verifies an approved write inside the selected workspace and denial of an
approved write to an adjacent path.

The replay on restart is deliberate for rc6: its JSON-RPC server calls
`agents.create()` for every first prompt and exposes no resume RPC, so reusing
an on-disk id fails instead of loading it. MausCrew avoids that upstream
collision, bounds replay to the active branch's latest 40 text messages / 64
KiB, and hashes (rather than embeds) the history in the new runtime id. Within
a running process only the new message is sent; the runtime remains the live
context source of truth.

### Workspace Skill Center

Every DeepSeek bot exposes a **Skills** card in Bot Settings. The manager lists,
searches, creates, edits, and removes workspace-local skill bundles at
`.agents/skills/<kebab-name>/SKILL.md`. Each skill has a description, optional
trigger guidance, Markdown instructions, and independent model/user invocation
controls. Unknown frontmatter such as upstream metadata is preserved when an
existing skill is edited.

The file service is intentionally narrow: names must be lowercase kebab-case,
payload and file sizes are bounded, writes are atomic, and traversal plus
symlink/junction escapes are rejected before any read, write, or recursive
delete. The UI is available only for DeepSeek bots, while the resulting files
remain portable to other agents that understand the shared SKILL.md layout.

### Dynamic Cordis extension

DeepSeek bots have an opt-in **Dynamic Cordis plugins** switch in Bot Settings.
When enabled, MausCrew adds `@deepseek-ai/dsh-cordis-host-runner` and
`@deepseek-ai/dsh-tool-cordis` to that process's generated composition. This
lets the agent inspect the runtime, define immutable host-side Packages, run or
update one version, stop it, and remove it.

This is intentionally narrower than DeepSeek Harness's web application:

- `code.client` definitions are denied because MausCrew does not embed the
  DeepSeek browser client runner or its UI event transport.
- `cordis_run` always produces an **Allow once / Deny** decision. Auto mode and
  remembered **Always allow** grants cannot activate dynamic code.
- The approval card includes the Package name, purpose, identity, and captured
  host source from the successful `cordis_define` result. Definitions are kept
  separate per runtime session.
- Plugins are process-local. They disappear when the DeepSeek runtime or app
  restarts; this switch is not an npm plugin installer or persistent registry.

The composition, classification, client-half refusal, session isolation, and
one-time approval rules are covered by automated tests. A real-model Dynamic
Cordis lifecycle is not part of the current live compatibility claim.

## Environment reaching the bridge

Deny-by-default. The child's environment is built from nothing rather than
filtered from the server's, so a variable added to the server later cannot
start leaking silently.

Passed: `PATH`, `PYTHONUNBUFFERED`, `PYTHONIOENCODING`, `SystemRoot`, `TEMP`,
`TMP`, `COMSPEC`, `HOME`, `USERPROFILE`, `LANG`, `TZ`, `DEEPSEEK_API_KEY`,
`DEEPSEEK_BASE_URL`, `DSH_BRIDGE_PROVIDER`, `DSH_BRIDGE_MODEL`,
`DSH_SESSION_ROOT`, `DSH_CORDIS_CONFIG`, `DSH_CWD`, `DSH_SANDBOX_MODE`, and
the MausCrew approval mailbox controls, plus explicit per-instance overrides.

On WSL, only this allowlisted set is added to `WSLENV`; secret values remain in
the child environment and are never copied into process arguments.

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
