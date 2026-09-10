import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";

import { SqliteAuditStore } from "../audit/sqlite-audit-store.ts";
import { CrewEventBus } from "../crew-core/event-bus.ts";
import { createAgentIdentity } from "../crew-core/identity.ts";
import { CancellationScope } from "../runtime/cancellation.ts";
import { AgentIdentityStore } from "../storage/agent-identity-store.ts";
import { CrewDatabase } from "../storage/crew-database.ts";
import { CrewEventStore } from "../storage/event-store.ts";
import { ToolCallStore } from "../storage/tool-call-store.ts";
import { ApprovalService } from "./approval-service.ts";
import { FilesystemReadTool, FilesystemWriteTool, ShellExecuteTool, builtinTools } from "./builtin-tools.ts";
import { ToolManager } from "./tool-manager.ts";
import { WorkspaceBoundary } from "./workspace-boundary.ts";

const databases: CrewDatabase[] = []; const directories: string[] = [];
afterEach(() => { while (databases.length) databases.pop()!.close(); while (directories.length) rmSync(directories.pop()!, { recursive: true, force: true }); });

function harness() {
  const database = new CrewDatabase(":memory:"); databases.push(database);
  new AgentIdentityStore(database).create(createAgentIdentity({ id: "agent", name: "Agent", role: "developer" }));
  const events = new CrewEventStore(database); const audit = new SqliteAuditStore(database); const bus = new CrewEventBus();
  const approvals = new ApprovalService(database, events, audit, bus);
  const manager = new ToolManager(database, new ToolCallStore(database), events, audit, bus, approvals, builtinTools());
  const root = mkdtempSync(join(tmpdir(), "mauscrew-tools-")); directories.push(root);
  return { database, events, audit, approvals, manager, context: { projectId: "p", projectRoot: root, agentId: "agent", taskId: "task", sessionId: "session" } };
}

describe("MCP tool boundary", () => {
  it("exposes the required built-ins and isolates filesystem access", async () => {
    const app = harness();
    expect(app.manager.list()).toEqual(["filesystem.patch", "filesystem.read", "filesystem.write", "git.commit", "git.diff", "git.status", "search.code", "search.files", "shell.execute", "test.run", "todo.read", "todo.write"]);
    await app.manager.execute({ tool: "filesystem.write", arguments: { path: "src/a.txt", content: "safe" }, context: app.context, permissions: { default: "allow" } });
    expect(readFileSync(join(app.context.projectRoot, "src/a.txt"), "utf8")).toBe("safe");
    await expect(app.manager.execute({ tool: "filesystem.read", arguments: { path: "../../outside.txt" }, context: app.context, permissions: { default: "allow" } })).rejects.toThrow("escapes");
    expect(app.audit.verify("p")).toBe(true);
  });

  it("suspends ask calls and binds approval to exact agent, tool and arguments", async () => {
    const app = harness(); const input = { tool: "filesystem.write", arguments: { path: "approved.txt", content: "ok" }, context: app.context, permissions: { default: "ask" as const } };
    const pending = await app.manager.execute(input); expect(pending.status).toBe("needs_approval");
    const approvalId = pending.status === "needs_approval" ? pending.approvalId : "";
    app.approvals.decide(approvalId, "approved", "user");
    await expect(app.manager.execute({ ...input, arguments: { path: "other.txt", content: "ok" }, approvalId })).rejects.toThrow("exact tool call");
    expect(await app.manager.execute({ ...input, approvalId })).toMatchObject({ status: "completed" });
    expect(app.events.list({ projectId: "p" }).map(({ event }) => event.type)).toContain("approval.approved");
  });

  it("denies configured and destructive calls before handler execution", async () => {
    const app = harness();
    await expect(app.manager.execute({ tool: "filesystem.write", arguments: { path: "x", content: "x" }, context: app.context, permissions: { default: "deny" } })).rejects.toThrow("denied");
    await expect(app.manager.execute({ tool: "shell.execute", arguments: { command: "git reset --hard" }, context: app.context, permissions: { default: "allow" } })).rejects.toThrow("Destructive");
    expect(app.database.db.prepare("SELECT COUNT(*) AS count FROM tool_calls").get()).toEqual({ count: 0 });
  });

  it("applies exact-tool policy before category and default policy", async () => {
    const app = harness();
    const permissions = { default: "deny" as const, categories: { filesystem: "ask" as const }, tools: { "filesystem.read": "allow" as const } };
    await app.manager.execute({ tool: "filesystem.write", arguments: { path: "x", content: "x" }, context: app.context, permissions }).then((result) => expect(result.status).toBe("needs_approval"));
    await expect(app.manager.execute({ tool: "git.status", arguments: {}, context: app.context, permissions })).rejects.toThrow("denied");
  });

  it("redacts secrets in persisted tool arguments", async () => {
    const app = harness();
    await app.manager.execute({ tool: "filesystem.write", arguments: { path: "x", content: "api_key=verysecretvalue123" }, context: app.context, permissions: { default: "allow" } });
    const row = app.database.db.prepare("SELECT arguments_json FROM tool_calls").get() as { arguments_json: string };
    expect(row.arguments_json).not.toContain("verysecretvalue123");
    expect(row.arguments_json).toContain("REDACTED");
  });
});

describe("built-in execution safety", () => {
  it("rejects traversal at the provider boundary", async () => {
    const root = mkdtempSync(join(tmpdir(), "mauscrew-boundary-")); directories.push(root);
    const context = { projectId: "p", projectRoot: root, agentId: "a" };
    await expect(new FilesystemReadTool().execute({ path: "../escape" }, context)).rejects.toThrow("escapes");
    expect(() => new WorkspaceBoundary(root).resolve("../escape", { write: true })).toThrow("escapes");
    await new FilesystemWriteTool().execute({ path: "nested/file.txt", content: "ok" }, context);
  });

  it("terminates shell process trees on timeout and cancellation", async () => {
    const root = mkdtempSync(join(tmpdir(), "mauscrew-shell-")); directories.push(root);
    const tool = new ShellExecuteTool({ timeoutMs: 100 });
    await expect(tool.execute({ command: "node -e \"setTimeout(()=>{},10000)\"" }, { projectId: "p", projectRoot: root, agentId: "a" })).rejects.toThrow("timed out");
    const cancellation = new CancellationScope();
    const running = new ShellExecuteTool({ timeoutMs: 10_000 }).execute({ command: "node -e \"setTimeout(()=>{},10000)\"" }, { projectId: "p", projectRoot: root, agentId: "a", cancellation });
    setTimeout(() => cancellation.cancel(), 100);
    await expect(running).rejects.toThrow("cancelled");
  }, 10_000);
});
