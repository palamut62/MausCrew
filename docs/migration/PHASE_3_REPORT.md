# Phase 3 Report - Collaboration

Date: 2026-09-10

## Implementation summary

Phase 3 adds persistent task collaboration without replacing MausCrew's existing workflow and delegation behavior:

- Canonical SQLite tasks and dependency edges.
- Transactional graph creation with same-project validation and cycle rejection.
- A single task status source with guarded assign, start, complete, fail, block and cancel transitions.
- Automatic ready-set release only after every upstream task completes.
- Priority-aware parallel scheduling with configurable `maxConcurrentAgents` (default 4).
- Role-based agent selection behind an injectable selector.
- Event-driven task assignment through the existing wakeup router and bounded inbox.
- Supervisor plan materialization, ready-work dispatch and stalled-task recovery.
- Structured handoffs with pending, accepted, completed and rejected states.
- File, commit, test, URL, message and artifact evidence persistence.
- Evidence required before an accepted handoff can complete.
- A compatibility adapter that converts legacy delegation records into structured handoff drafts.

## Files changed

Core and storage:

- `server/crew-core/events.ts`
- `server/storage/crew-database.ts`
- `server/storage/task-store.ts`
- `server/storage/handoff-store.ts`

Task orchestration:

- `server/tasks/task.ts`
- `server/tasks/task-service.ts`
- `server/tasks/task-scheduler.ts`
- `server/supervisor/orchestrator.ts`

Collaboration:

- `server/collaboration/handoff.ts`
- `server/collaboration/handoff-service.ts`
- `server/collaboration/legacy-delegation-adapter.ts`

Tests and documentation:

- `server/tasks/task-orchestration.test.ts`
- `server/collaboration/handoff-service.test.ts`
- `server/crew-core/events.test.ts`
- `server/storage/crew-database.test.ts`
- `docs/BUZZ_GAP_ANALYSIS.md`
- `docs/migration/PHASE_3_REPORT.md`

## Architecture changes

SQLite migration 3 introduces `tasks`, `task_dependencies`, `handoffs` and `handoff_evidence`. Domain mutations, Crew Events and audit rows are committed in one transaction; Event Bus publication happens only after commit.

The Supervisor materializes provider-neutral plans into the canonical task graph. The scheduler selects ready work up to its concurrency limit and emits `task.assigned`; the existing central wakeup router then places that work in the target agent's persistent inbox. Neither the Supervisor nor a task directly invokes another agent process.

Existing `WorkflowManager` and `delegations.ts` remain available. The legacy adapter provides the incremental migration seam instead of creating a fork or destructive rewrite.

## Tests added

6 new Phase 3 tests cover:

- DAG creation and dependency release.
- Circular dependency rejection.
- Invalid graph transaction rollback.
- Parallel scheduling and concurrency limiting.
- Assignment-to-inbox wakeup routing.
- Task cancellation and stalled-task recovery.
- Structured handoff transitions, evidence enforcement, rejection and restart persistence.

Full regression evidence:

- `pnpm test`: 143 files passed, 3 skipped; 1213 tests passed, 16 skipped.
- Electron updater tests: 23 passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed with 0 errors and 101 pre-existing warnings.
- `pnpm build`: passed.
- `git diff --check`: passed.

## Known limitations

- Canonical task and handoff services are not yet wired into the HTTP/application bootstrap; existing production workflow/delegation routes continue unchanged.
- The legacy delegation adapter is one-way. Automatic historical import is intentionally deferred until record ownership and duplicate-dispatch rules can be preserved.
- Scheduler agent selection currently uses role equality by default; capability/load scoring can be supplied through the selector boundary.
- Stalled recovery blocks work for Supervisor review. Central retry and reroute policy belongs to a later recovery phase.
- Task cancellation changes canonical state; provider and tool process cancellation will be connected through the Phase 4 execution boundary.
- Review and human approval pipeline binding is deferred to Phases 6 and 7.

## Remaining work

Phase 4 will place filesystem, shell, git and test operations behind the MCP Tool Manager, enforce allow/ask/deny policies at that boundary, add project-root isolation and propagate cancellation to child process trees. The canonical task assignment and handoff events can then drive real agent/tool execution through application adapters.
