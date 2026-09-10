# Phase 6 Report - Workflow Engine

Date: 2026-09-10

## Implementation summary

- Added strict YAML workflow parsing with manual triggers, agent steps, parallel groups and human approval steps.
- Flattened sequential and parallel YAML into a persisted dependency DAG.
- Added SQLite workflow definitions, runs and step state.
- Added configurable concurrency-limited agent-step execution.
- Added a provider-neutral agent-step executor boundary.
- Added persisted human approval suspension and continuation.
- Added approve, reject and request-changes outcomes.
- Added restart recovery: interrupted running steps return to ready; waiting approvals retain their exact state.
- Added workflow and step cancellation with `AbortSignal` propagation to active executors.
- Added workflow started, completed, failed and cancelled events plus hash-chain audit entries.
- Added duplicate execution protection for concurrent calls on one run.
- Added a compatibility adapter for existing JSON `WorkflowManager` records.
- Added the maintained `yaml` parser as a direct dependency.

## Files changed

- `package.json`
- `pnpm-lock.yaml`
- `server/crew-core/events.ts`
- `server/crew-core/events.test.ts`
- `server/storage/crew-database.ts`
- `server/storage/crew-database.test.ts`
- `server/storage/workflow-store.ts`
- `server/tools/approval-service.ts`
- `server/workflow-engine/definition.ts`
- `server/workflow-engine/types.ts`
- `server/workflow-engine/workflow-engine.ts`
- `server/workflow-engine/legacy-workflow-adapter.ts`
- `server/workflow-engine/workflow-engine.test.ts`
- `docs/BUZZ_GAP_ANALYSIS.md`
- `docs/migration/PHASE_6_REPORT.md`

## Architecture changes

SQLite migration 6 separates immutable workflow definitions from mutable workflow runs and step state. Dependencies are persisted with each step, while run status is the single canonical workflow status source. The UI and provider layers can consume projections without maintaining an independent workflow state.

The engine only calls an injected `WorkflowAgentExecutor`; it does not know Codex, Claude, Goose or tool protocol details. Approval steps use the Phase 4 approval store and suspend the run without executing downstream work. Cancellation reaches the executor through the same hierarchical signal model used by runtime and tools.

Existing `WorkflowManager` JSON files are not deleted or dual-written. The legacy adapter preserves their agent assignment and dependency edges for explicit incremental migration.

## Tests added

5 Phase 6 tests cover:

- YAML validation, alias rejection and parallel DAG construction.
- Legacy workflow dependency preservation.
- Real concurrency limiting and downstream ordering.
- Human approval suspension and continuation.
- SQLite restart persistence and resume.
- Agent failure persistence and workflow failure events.
- Active executor cancellation and signal propagation.

Full regression evidence:

- `pnpm test`: 147 files passed, 3 skipped; 1231 tests passed, 16 skipped.
- Electron updater tests: 23 passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed with 0 errors and 101 pre-existing warnings.
- `pnpm build`: passed.
- `git diff --check`: passed.

## Known limitations

- Only manual triggers are enabled. Scheduled/event triggers remain with existing MausCrew routines until an explicit migration.
- YAML expresses dependencies through sequence and parallel groups; arbitrary dependency lists are currently available through the domain/legacy adapter, not YAML syntax.
- Application HTTP routes and the current Workflows UI still use the legacy manager.
- The agent-step executor adapter is injected but not yet wired to Supervisor task creation and AgentProvider startup.
- Approval records persist correctly, but the new workflow approval projection is not yet connected to the existing in-app approval cards.
- Retry policy and compensating actions are not included in this phase.
- Workflow definition editing/versioning is append-oriented; updating an active definition is not supported.

## Remaining work

Phase 7 will add developer-facing branch workspaces, the implementation-test-review-human pipeline, unified activity projections and the Agent Inspector. Application adapters can then expose canonical tasks, workflow runs, approvals and runtime observations without direct SQLite access from UI components.
