# ADR 0001: Crew Core persistence uses node:sqlite

Date: 2026-09-10

## Status

Accepted for Phase 1.

## Context

MausCrew requires an immutable local event store and persistent domain state. The application already requires Node 24 and packages an Electron runtime. Adding a native SQLite package would introduce a second native ABI and packaging surface.

## Decision

Crew Core uses the built-in `node:sqlite` `DatabaseSync` API. The database lives under `DATA_DIR/crew-core.sqlite`. Foreign keys and WAL are enabled. Schema changes are versioned in `schema_migrations`.

Existing JSON and NDJSON stores remain readable during incremental migration. A domain gets exactly one writer: no permanent JSON plus SQLite dual-write is allowed. Phase 1 creates new foundation records without taking ownership of existing workflow, task, message or legacy audit writes.

## Consequences

- No new runtime dependency or native rebuild step.
- Server persistence code is synchronous and must keep transactions short.
- SQLite access remains behind repositories; UI and provider drivers never query it directly.
- Node 24 remains a hard runtime requirement.
- Before a legacy domain moves, import, backup, idempotency and rollback behavior must be tested.
