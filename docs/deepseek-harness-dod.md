# DeepSeek Harness Definition of Done

Verified on Windows 11 + WSL2 on 2026-08-17 against the pinned
`deepseek-harness-sdk==0.1.0rc6`. “Live” below means the real pinned SDK/runtime
and a real DeepSeek API request; it does not mean a fake transport.

| # | User outcome (spec §105) | Result | Evidence |
|---:|---|:---:|---|
| 1 | Open MausCrew | Pass | Playwright opened the real Vite UI backed by the real harness server at a clean data directory; page title and app shell rendered. |
| 2 | Add a new bot | Pass | Playwright used **New or share → New Bot**; the second bot appeared in the sidebar and persisted through `/api/bots`. |
| 3 | Select DeepSeek Harness as engine | Pass | The live model picker showed **DeepSeek Harness — ready** and persisted instance `deepseek`. |
| 4 | Select a DeepSeek model/provider | Pass | Playwright selected `deepseek-v4-flash`; the picker also exposed `deepseek-v4-pro`. Dynamic/custom catalogs are covered by `deepseek-units.test.ts`. |
| 5 | Select a workspace | Pass | Bot Settings now provides an absolute **Workspace directory** field plus a native Electron directory picker. The selected Windows folder persisted and is passed to `SendTurnInput.cwd`; relative paths and the home root are rejected by the HTTP boundary. |
| 6 | Send a coding task | Pass | Opt-in live sandbox test asked the real model to create a nonce-bearing file in the chosen scratch workspace and verified its contents on disk. |
| 7 | Watch streamed reasoning/tool activity | Pass | A real Playwright-to-server-to-DeepSeek UI turn settled visibly as `MAUSCREW_UI_LIVE_OK` with no browser-console errors. Live coding turns emitted tool/assistant events; mapper tests cover reasoning deltas, and the UI renders activity plus expandable rich subagent cards. |
| 8 | Continue the same conversation later | Pass | A second real UI message asked for the prior token and the same bot returned `MAUSCREW_UI_LIVE_OK`. Same-process tests also prove only the new prompt is sent; restart coverage recalls a random phrase from replayed history. |
| 9 | Restart MausCrew and retain session state | Pass | A live native test destroys and recreates the provider process, then verifies transcript replay by exact random-phrase recall. Replay is bounded (40 messages, 16 KiB/message, 64 KiB total) because rc6's JSON-RPC server exposes create but no resume RPC. |
| 10 | Approve or deny risky tool actions | Pass | The live test approves workspace creation and verifies an approved adjacent-directory escape is still denied by the sandbox. Mailbox allow/deny/timeout/cross-thread behavior remains covered by the Phase 3 suites. |
| 11 | Run multiple DeepSeek bots independently | Pass | Playwright created two DeepSeek bots; driver tests verify independent instance/session/event routing and concurrent turns. |
| 12 | Use custom Cordis compositions | Pass | Decode, missing-path refusal, generated composition, absolute approval-plugin path and mount/restart behavior are covered by `composition.test.ts` and driver tests. |
| 13 | Use custom compatible model endpoints | Pass | Settings persists and warns about custom endpoints; URL validation and `/models` discovery/fallback are covered by config/catalog tests. |

Additional opt-in capability: the host-only Dynamic Cordis switch, generated
composition, client-half refusal, per-session source evidence, and mandatory
one-time `cordis_run` approval are covered by automated tests. This addition
does not change the 13 user outcomes in spec §105 and is not claimed as a live
real-model validation in this report.

Regression and packaging gates:

- `pnpm test`: 613 passed, 14 skipped across 66 Vitest files; updater suite 12/12 passed.
- Focused DeepSeek suite: 107 passed, 3 opt-in live tests skipped in the normal run.
- Opt-in live run: simple native model turn, provider-process restart with exact recall,
  and approved workspace write plus denied path escape all passed.
- `pnpm typecheck`, `pnpm check:electron`, `pnpm package:prepare`, and
  `git diff --check` passed.
- Existing providers remain registered and their regression suites are included in the
  full green test run.

The Python bridge remains as a compatibility transport. New configurations default to the
bundled/native strategy, which was promoted only after the live runtime, restart, approval,
and sandbox checks above passed.
