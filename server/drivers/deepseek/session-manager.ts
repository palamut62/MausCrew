// OpenMaus threadId ↔ DeepSeek session_id mapping (spec §18, §19).
//
// The mapping is a pure function, not a lookup table, and that is the whole
// point: the same thread must land on the same DeepSeek session after a
// bridge restart, a server restart, or a reinstall, because the session's
// JSONL log on disk is what carries the model's context (spec §48, §49).
// Anything stateful here would lose continuation the first time the process
// died — the exact case §47 asks us to survive.
import { homedir } from "node:os";
import { join } from "node:path";

const PREFIX = "dsh";

/** DeepSeek session ids become path segments in the session root, so the
 * characters that could escape a directory or confuse a shell are folded
 * away rather than escaped. Collisions are not a concern: instance ids and
 * thread ids are already generated identifiers, not user text. */
function sanitize(part: string): string {
  return part.replace(/[^A-Za-z0-9._-]/g, "-").slice(0, 128) || "unknown";
}

export function sessionIdFor(providerInstanceId: string, threadId: string): string {
  return `${PREFIX}:${sanitize(providerInstanceId)}:${sanitize(threadId)}`;
}

/** Inverse of sessionIdFor, for reading a session id off disk or out of a
 * resumeCursor. Returns null for anything that is not ours — a cursor
 * written by a different driver must not be mistaken for a session. */
export function parseSessionId(sessionId: string): { instanceId: string; threadId: string } | null {
  const parts = sessionId.split(":");
  if (parts.length !== 3 || parts[0] !== PREFIX) return null;
  const [, instanceId, threadId] = parts;
  if (!instanceId || !threadId) return null;
  return { instanceId, threadId };
}

export function defaultSessionRoot(): string {
  return join(homedir(), ".openmausbot", "deepseek-harness", "sessions");
}

/** Per-instance session directory. Kept separate so two provider instances
 * pointed at different endpoints never share a session log. */
export function sessionRootFor(instanceId: string, configuredRoot: string): string {
  const root = configuredRoot || defaultSessionRoot();
  return join(root, `instance-${sanitize(instanceId)}`);
}

/** A workspace for a bot that has no project folder selected.
 *
 * Never the home directory: the agent gets filesystem and shell tools, and
 * an unscoped cwd is precisely the §35 failure the spec calls unacceptable. */
export function defaultWorkspaceFor(instanceId: string, threadId: string): string {
  return join(homedir(), ".openmausbot", "workspaces", sanitize(instanceId), sanitize(threadId));
}
