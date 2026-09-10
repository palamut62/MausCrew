# Phase 2 Report - Runtime

Date: 2026-09-10

## Implementation summary

Phase 2 adds the persistent runtime primitives required to wake agents only when work exists and to observe their exact state:

- Isolated, persistent `AgentSession` records for provider, model, permissions, tools, current task, context and memory.
- A database constraint allowing only one active session per agent.
- Configurable runtime heartbeat emission with canonical status validation.
- Stale-agent detection routed through the central lifecycle state machine.
- A bounded persistent agent inbox with `critical`, `high`, `normal` and `low` priority.
- Priority-first, FIFO-within-priority claiming.
- Explicit overflow behavior: reject equal/weaker new work; stronger work moves the oldest weakest queued item to dead-letter.
- Event-driven wakeup routing for task assignment, handoff, review, mention, approval and dependency completion.
- Hierarchical cancellation from runtime to task/tool child scopes.
- Atomic session start/stop, status transition, lifecycle event and audit writes.

## Files changed

Runtime:

- `server/runtime/agent-session.ts`
- `server/runtime/agent-runtime-session.ts`
- `server/runtime/heartbeat.ts`
- `server/runtime/agent-inbox.ts`
- `server/runtime/wakeup-router.ts`
- `server/runtime/cancellation.ts`

Storage and foundation integration:

- `server/storage/crew-database.ts`
- `server/storage/agent-session-store.ts`
- `server/storage/agent-inbox-store.ts`
- `server/crew-core/events.ts`
- `server/crew-core/status-machine.ts`
- `server/crew-core/agent-lifecycle.ts`
- `server/audit/sqlite-audit-store.ts`

Tests:

- `server/runtime/runtime-foundations.test.ts`
- `server/runtime/agent-inbox.test.ts`
- `server/runtime/wakeup-router.test.ts`
- `server/runtime/cancellation.test.ts`
- Existing event/database tests updated for the new registry and migration.

## Architecture changes

SQLite migration 2 introduces `agent_sessions` and `agent_inbox`. Session context is serialized per session and never shared as a mutable object. Inbox state is persistent and claimable after restart. Wakeup is a subscriber to the bounded Crew Event Bus; agent runtimes do not call each other directly.

`AgentRuntimeSession.start` and `stop` bind session state, canonical status, `agent.started`/`agent.stopped` events and audit rows. Heartbeat payload status must equal the status in the agent identity repository, preventing a runtime from publishing a conflicting status source.

## Tests added

9 new runtime tests cover:

- Session persistence, isolation and completion.
- One-active-session enforcement.
- Heartbeat persistence and stale transition.
- Periodic heartbeat behavior.
- Parent-child cancellation propagation and detachment.
- Priority/FIFO inbox claiming.
- Bounded overflow rejection and high-priority eviction.
- Event-to-inbox wakeup routing.
- Lifecycle event and audit-chain integrity.

Full regression evidence:

- `pnpm test`: 141 files passed, 3 skipped; 1207 tests passed, 16 skipped.
- Electron updater tests: 23 passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed with 0 errors and 101 pre-existing warnings.
- `pnpm build`: passed.
- `git diff --check`: passed.

## Known limitations

- Existing provider instances are not yet launched through `AgentRuntimeSession`; adapters remain unchanged to avoid a rewrite.
- Wakeup routing is ready for persisted/replayed Crew Events, but application boot replay wiring is deferred until task/handoff services exist in Phase 3.
- Stale detection exposes `markStale`; the application-level monitor timer will be wired with runtime bootstrap.
- Cancellation scopes expose an `AbortSignal`; Phase 4 ToolManager will bind it to shell process-tree termination.
- Inbox dead-letter replay and retry policy are not yet implemented.
- `AgentRuntimeSession` is one runtime per agent; parallelism is across agents, not two mutable sessions for one identity.

## Remaining work

Phase 3 will add canonical tasks and dependency edges, DAG-ready scheduling, structured handoffs with evidence, Supervisor routing and concurrency control. Existing workflow/delegation managers will be adapted rather than deleted.
