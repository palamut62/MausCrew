# Phase 5 Report - ACP and Agent Providers

Date: 2026-09-10

## Implementation summary

- Added the provider-neutral `AgentProvider` contract with `startSession`, `send`, `cancel`, `closeSession`, event subscription and disposal.
- Added isolated logical provider sessions with model, cwd, persona, effort, turn and native resume-cursor state.
- Added an adapter over MausCrew's existing `ProviderInstance` production contract.
- Added explicit Codex, Claude Code and Goose adapter entry points.
- Kept arbitrary/custom provider support through the generic adapter.
- Added availability and authentication fail-closed checks before session activation.
- Prevented concurrent sends on one session while retaining parallel sessions across agents.
- Propagated cancellation to the provider's canonical `interruptTurn` seam.
- Preserved native session ids as provider-opaque resume cursors.
- Registered Goose as a first-class built-in ACP driver using `goose acp`.
- Added Goose model selection through ACP `session/set_model`.

## Files changed

- `server/agent-providers/agent-provider.ts`
- `server/agent-providers/provider-instance-adapter.ts`
- `server/agent-providers/codex-provider.ts`
- `server/agent-providers/claude-provider.ts`
- `server/agent-providers/goose-provider.ts`
- `server/agent-providers/provider-instance-adapter.test.ts`
- `server/drivers/acp/goose.ts`
- `server/drivers/acp/goose.test.ts`
- `server/drivers/acp/core.ts`
- `server/drivers/builtIn.ts`
- `docs/BUZZ_GAP_ANALYSIS.md`
- `docs/migration/PHASE_5_REPORT.md`

## Architecture changes

Crew orchestration now depends on one provider-neutral lifecycle instead of Codex JSON-RPC, Claude stream-json or ACP details. `ProviderInstanceAgentAdapter` translates that lifecycle to the existing, already-tested `ProviderAdapter` seam. Provider-native session ids remain opaque and are only replayed as resume cursors.

Codex and Claude retain their current production drivers. Goose uses the shared ACP core, so JSON-RPC framing, permission requests, MCP injection, interruption and event normalization are not duplicated in a new implementation.

## Tests added

5 Phase 5 tests cover:

- Session creation, send and resume-cursor continuity.
- Concurrent-send rejection and cancellation routing.
- Unavailable, unauthenticated and provider-kind mismatch failures.
- Codex, Claude Code and Goose built-in registration.
- Real Goose ACP handshake, model configuration, prompt and completion against the production ACP core with an external fake CLI boundary.

Full regression evidence:

- `pnpm test`: 146 files passed, 3 skipped; 1226 tests passed, 16 skipped.
- Electron updater tests: 23 passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed with 0 errors and 101 pre-existing warnings.
- `pnpm build`: passed.
- `git diff --check`: passed.

## Known limitations

- Canonical runtime bootstrap does not yet construct these adapters automatically from task inbox assignments.
- The Goose CLI is not installed on this machine, so validation used the real ACP core against MausCrew's scripted external ACP process rather than a live Goose account.
- Goose exposes its locally configured provider catalog as extensible; live catalog discovery is not implemented.
- Codex and Claude use their proven native transports behind the facade rather than installing extra `codex-acp` or `claude-agent-acp` wrapper processes.
- Provider permission requests still use the existing request-card path; unification with SQLite approvals remains an application-layer migration step.
- Session persistence remains owned by Phase 2 `AgentSessionStore`; adapter bootstrap wiring must avoid creating a second session source of truth.

## Remaining work

Phase 6 will add persisted YAML workflow definitions/runs/steps, validation, DAG execution, parallel groups, human approval, resume and cancel. Its agent steps will target the canonical task/runtime boundaries rather than provider-specific drivers.
