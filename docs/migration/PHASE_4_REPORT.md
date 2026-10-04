# Phase 4 Report - Tools and Permissions

Date: 2026-09-10

## Implementation summary

- Added a provider-neutral Tool Manager as the MCP execution boundary.
- Added `filesystem.read`, `filesystem.write`, `filesystem.patch`, `shell.execute`, `git.status`, `git.diff`, `git.commit`, `search.files`, `search.code`, `test.run`, `todo.read` and `todo.write`.
- Enforced project-root containment, including traversal and symlink-parent checks.
- Added configurable shell cwd, timeout and stdout/stderr limits.
- Propagated runtime cancellation to the complete shell process tree, using `taskkill /t /f` on Windows.
- Added truncated-output artifact creation under the project-local `.mauscrew/artifacts` directory.
- Enforced tool, category and default `allow`, `ask`, `deny` policy precedence at execution time.
- Persisted human approval requests and decisions.
- Bound approval to project, agent, tool and argument hash; approved grants are single-use.
- Denied destructive shell commands at the runtime boundary independently of prompts.
- Persisted tool start/result/error state and emitted tool lifecycle Crew Events.
- Applied central secret redaction before tool arguments or results enter SQLite/audit records.

## Files changed

- `server/storage/crew-database.ts`
- `server/storage/crew-database.test.ts`
- `server/storage/tool-call-store.ts`
- `server/tools/tool-types.ts`
- `server/tools/approval-service.ts`
- `server/tools/workspace-boundary.ts`
- `server/tools/builtin-tools.ts`
- `server/tools/tool-manager.ts`
- `server/tools/tool-manager.test.ts`
- `docs/BUZZ_GAP_ANALYSIS.md`
- `docs/migration/PHASE_4_REPORT.md`

## Architecture changes

SQLite migrations 4 and 5 introduce `approvals` and `tool_calls`, plus one-time approval consumption. Tool execution now has a single enforceable sequence:

1. Resolve tool and permission policy.
2. Deny or persist an exact approval request before any side effect.
3. Consume an approved grant atomically when required.
4. Persist `tool.started` and audit metadata.
5. Execute only through the registered tool handler.
6. Persist completion, failure or cancellation and emit the corresponding event.

Agent code can depend on Tool Manager without importing filesystem or child-process APIs. Existing provider-specific MCP registration remains intact as the compatibility layer.

## Tests added

8 Phase 4 tests cover:

- Required built-in registry.
- Filesystem write/read and traversal rejection.
- Approval suspension, exact-call matching and replay prevention.
- Tool/category/default permission precedence.
- Permission denial and destructive-command blocking before execution.
- Secret redaction in persisted arguments.
- Real shell timeout and cancellation with process-tree termination.
- Output truncation and artifact creation.

Validation evidence:

- `pnpm test`: 144 files passed, 3 skipped; 1221 tests passed, 16 skipped.
- Electron updater tests: 23 passed.
- Post-hardening focused tests: 10 passed.
- `pnpm typecheck`: passed after the final approval replay guard.
- `pnpm lint`: passed with 0 errors and 101 pre-existing warnings.
- `pnpm build`: passed.
- `git diff --check`: passed.

## Known limitations

- Existing providers are not yet mounted through this Tool Manager; their production paths remain unchanged until adapter wiring.
- Existing in-app provider approval cards are not yet projected from the new SQLite approvals table.
- Destructive shell patterns are denied rather than escalated. A later policy migration can selectively make recoverable operations ask-only.
- `filesystem.patch` is an exact single-match replacement primitive, not a complete unified-diff parser.
- Git tools intentionally operate only in the allowed project root and do not include push or force-push.
- Output artifacts contain the bounded captured stdout/stderr; streaming full oversized output to disk is deferred.
- Central retry policy is not part of this phase.

## Remaining work

Phase 5 will introduce the ACP `AgentProvider` facade and adapt Codex, Claude Code and Goose without leaking protocol-specific details into Crew Core. Application bootstrap wiring will then be able to connect canonical runtime sessions, task inbox work and Tool Manager execution to provider adapters.
