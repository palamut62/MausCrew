# Phase 7 Report - Developer Experience

Date: 2026-09-10

## Implementation summary

- Added a bounded, project-scoped Activity Timeline projection over immutable Crew events.
- Normalized message, task, agent, handoff, tool, git review, approval and workflow events into one chronological read model.
- Added legacy activity source adapters so current JSON message and review data can be merged without a second canonical state.
- Added a validated Branch Workspace projection with injected git boundary, tasks and unified activity.
- Added an Agent Inspector projection for identity, exact status, current task, model, tools, permissions, session duration, heartbeat, current tool, queue length, memory and latest event.
- Added the built-in implementation -> testing -> reviewer pipeline on the persistent Phase 6 workflow engine.
- Made the final human approval gate configurable per pipeline creation.
- Kept token usage and cost explicitly unavailable instead of fabricating values before Phase 8 usage persistence.

## Files changed

- `server/developer-experience/activity-timeline.ts`
- `server/developer-experience/branch-workspace.ts`
- `server/developer-experience/agent-inspector.ts`
- `server/developer-experience/review-pipeline.ts`
- `server/developer-experience/developer-experience.test.ts`
- `server/storage/event-store.ts`
- `server/storage/agent-session-store.ts`
- `server/storage/tool-call-store.ts`
- `docs/BUZZ_GAP_ANALYSIS.md`
- `docs/migration/PHASE_7_REPORT.md`

## Architecture changes

Developer-facing screens now have application read models instead of needing direct SQLite queries. Activity is derived from the immutable event sequence and accepts explicit legacy adapters during migration. Branch git data is behind an injected reader boundary; the projection does not execute shell commands or bypass the Phase 4 tool boundary.

The review pipeline reuses persisted workflow definitions, runs, dependency steps and approval records. It does not introduce another review state machine. Existing `ReviewQueue` delivery records remain intact and can be exposed as a legacy Activity source until the application bootstrap migrates them.

## Tests added

4 focused Phase 7 tests cover:

- Bounded canonical/legacy timeline merge, ordering and event classification.
- Branch workspace composition plus unsafe branch and relative-root rejection.
- Exact agent runtime observability from real SQLite stores.
- Review pipeline dependency order and optional human approval policy.

Full regression evidence:

- `pnpm test`: 148 files passed, 3 skipped; 1235 tests passed, 16 skipped.
- Electron updater tests: 23 passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed with 0 errors and 101 pre-existing warnings.
- `pnpm build`: passed.
- `git diff --check`: passed.

## Known limitations

- Current React pages and HTTP routes are not yet switched from legacy JSON managers to these projections.
- The injected branch git reader must be backed by the existing permission-controlled git tool in the application bootstrap.
- Legacy messages and review queue entries need small application adapters before they appear beside canonical Crew events.
- Token usage and cost remain `null` until Phase 8 adds the model usage store.
- Project and agent memory currently exposes the session record only; durable role/project memory is Phase 8.

## Remaining work

Phase 8 will add explicit project and agent memory, context compression checkpoints, provider-independent model interfaces, local Ollama/LM Studio support, audited fallback and usage tracking. That usage store will complete the Agent Inspector token and cost fields.
