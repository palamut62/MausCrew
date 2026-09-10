# Phase 1 Report - Foundations

Date: 2026-09-10

## Implementation summary

Phase 1 foundation modules were added without replacing existing MausCrew managers. The implementation includes:

- Independent `AgentIdentity` creation and validation without mandatory signing keys.
- A typed registry containing all 25 required initial `CrewEvent` types.
- A bounded in-process event bus with filtering, ordered asynchronous delivery, explicit overflow policy and listener-failure isolation.
- A centralized agent status state machine covering all 11 required statuses.
- A Node 24 built-in SQLite database with versioned migrations, foreign-key enforcement and WAL for file-backed databases.
- Persistent agent identities and statuses.
- An immutable event store with project replay cursors, correlation/causation and transactional batch append.
- An immutable, redacted, per-project SHA-256 hash-chain audit store.
- `AgentLifecycleService`, which commits identity/status, event and audit changes in one SQLite transaction and publishes only after commit.

## Files changed

Architecture decision:

- `docs/decisions/0001-crew-core-sqlite.md`

Crew Core:

- `server/crew-core/identity.ts`
- `server/crew-core/events.ts`
- `server/crew-core/event-bus.ts`
- `server/crew-core/status-machine.ts`
- `server/crew-core/agent-lifecycle.ts`

Storage and audit:

- `server/storage/crew-database.ts`
- `server/storage/agent-identity-store.ts`
- `server/storage/event-store.ts`
- `server/audit/sqlite-audit-store.ts`

Tests:

- `server/crew-core/identity.test.ts`
- `server/crew-core/events.test.ts`
- `server/crew-core/event-bus.test.ts`
- `server/crew-core/status-machine.test.ts`
- `server/crew-core/agent-lifecycle.test.ts`
- `server/storage/crew-database.test.ts`
- `server/storage/foundation-stores.test.ts`

## Architecture changes

`node:sqlite` was selected to avoid adding a native package ABI to the Electron build. Crew Core storage is behind repositories; UI and provider drivers do not query SQLite. Event and audit tables reject UPDATE and DELETE through database triggers. Status mutation, event append and audit append are atomic through `AgentLifecycleService`.

Existing `bots.json`, messages, workflows, delegations and NDJSON audit remain unchanged. They are not dual-written. Ownership migration will occur domain by domain through explicit import adapters in later phases.

## Tests added

19 focused tests cover:

- Identity validation and key-free identity.
- Event registry, validation and correlation.
- Event ordering, filters, bounded overflow and subscriber failure isolation.
- Valid, invalid and idempotent status transitions.
- SQLite migration idempotency and transaction rollback.
- Agent persistence.
- Immutable event replay and atomic batch rollback.
- Secret redaction, audit chaining and immutable audit rows.
- Atomic lifecycle writes and post-commit publication.

Full regression evidence:

- `pnpm test`: 137 files passed, 3 skipped; 1198 tests passed, 16 skipped.
- Electron updater tests: 23 passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed with 0 errors and 101 pre-existing warnings.
- `pnpm build`: passed.
- `git diff --check`: passed.

## Known limitations

- Foundation services are not yet boot-wired into existing bots/tasks. Phase 2 runtime will become their first production consumer.
- Existing bot identities are not imported yet; no dual-write was introduced.
- Event payload validation is envelope-level. Per-event payload schemas will be added with the producing subsystem.
- Hash-chain verification is local tamper detection, not cryptographic actor signing.
- Heartbeat, stale detection, inbox, wakeup and cancellation belong to Phase 2 and are not included here.
- SQLite operations are synchronous; transactions must remain short and no model/tool/network call may run inside them.

## Remaining work

Phase 2 will add persistent agent sessions, isolated runtime context, heartbeat and stale detection, bounded priority inbox, event-driven wakeup and hierarchical cancellation. It will consume `AgentLifecycleService` instead of creating another status source.
