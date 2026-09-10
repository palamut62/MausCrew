import { afterEach, describe, expect, it } from "vitest";

import { SqliteAuditStore } from "../audit/sqlite-audit-store.ts";
import { CrewEventBus } from "../crew-core/event-bus.ts";
import { createCrewEvent } from "../crew-core/events.ts";
import { createAgentIdentity } from "../crew-core/identity.ts";
import { createAgentSession } from "../runtime/agent-session.ts";
import { createInboxItem } from "../runtime/agent-inbox.ts";
import { AgentIdentityStore } from "../storage/agent-identity-store.ts";
import { AgentInboxStore } from "../storage/agent-inbox-store.ts";
import { AgentSessionStore } from "../storage/agent-session-store.ts";
import { CrewDatabase } from "../storage/crew-database.ts";
import { CrewEventStore } from "../storage/event-store.ts";
import { TaskStore } from "../storage/task-store.ts";
import { ToolCallStore } from "../storage/tool-call-store.ts";
import { WorkflowStore } from "../storage/workflow-store.ts";
import { ApprovalService } from "../tools/approval-service.ts";
import { WorkflowEngine } from "../workflow-engine/workflow-engine.ts";
import { ActivityTimeline } from "./activity-timeline.ts";
import { AgentInspector } from "./agent-inspector.ts";
import { BranchWorkspaceProjection, validateBranchWorkspace } from "./branch-workspace.ts";
import { ReviewPipeline } from "./review-pipeline.ts";

const databases: CrewDatabase[] = [];
afterEach(() => { while (databases.length) databases.pop()!.close(); });

function stores() {
  const database = new CrewDatabase(":memory:"); databases.push(database);
  const identities = new AgentIdentityStore(database); const sessions = new AgentSessionStore(database);
  const inbox = new AgentInboxStore(database); const events = new CrewEventStore(database); const tools = new ToolCallStore(database);
  return { database, identities, sessions, inbox, events, tools };
}

describe("developer experience projections", () => {
  it("projects bounded canonical events into a unified chronological timeline", () => {
    const app = stores();
    app.events.append(createCrewEvent({ id: "e1", type: "message.created", projectId: "p", actor: { type: "human", id: "u" }, payload: { text: "go" }, createdAt: "2026-09-10T10:00:00.000Z" }));
    app.events.append(createCrewEvent({ id: "e2", type: "tool.completed", projectId: "p", actor: { type: "agent", id: "a" }, payload: { tool: "test.run" }, createdAt: "2026-09-10T10:00:01.000Z" }));
    app.events.append(createCrewEvent({ id: "e3", type: "git.review_requested", projectId: "p", actor: { type: "agent", id: "a" }, payload: {}, createdAt: "2026-09-10T10:00:02.000Z" }));
    const legacy = { list: () => [{ id: "legacy", sequence: 0, projectId: "p", kind: "review" as const, type: "review.requested" as const, actor: { type: "human" as const, id: "u" }, payload: {}, createdAt: "2026-09-10T10:00:01.500Z" }] };
    expect(new ActivityTimeline(app.events, [legacy]).list("p", 3).map((item) => [item.id, item.kind])).toEqual([["e2", "tool"], ["legacy", "review"], ["e3", "review"]]);
  });

  it("builds a branch workspace through injected git and rejects unsafe branch names", async () => {
    const app = stores(); const reads: string[] = [];
    const projection = new BranchWorkspaceProjection(new TaskStore(app.database), new ActivityTimeline(app.events), { async read(root, branch) { reads.push(`${root}|${branch}`); return { status: "clean", diff: "", commits: [] }; } });
    const workspace = await projection.get({ projectId: "p", root: process.cwd(), branch: "feature/activity" });
    expect(workspace).toMatchObject({ projectId: "p", branch: "feature/activity", git: { status: "clean" } });
    expect(reads).toHaveLength(1);
    expect(() => validateBranchWorkspace(process.cwd(), "../escape")).toThrow("Invalid branch name");
    expect(() => validateBranchWorkspace("relative", "feature/ok")).toThrow("absolute");
  });

  it("reports exact runtime observability instead of an ambiguous working flag", () => {
    const app = stores(); const createdAt = "2026-09-10T10:00:00.000Z";
    app.identities.create(createAgentIdentity({ id: "a", name: "Ada", role: "tester", createdAt })); app.identities.setStatus("a", "working", createdAt);
    app.sessions.start(createAgentSession({ id: "s", projectId: "p", agentId: "a", provider: "codex", model: "gpt", tools: ["test.run"], permissions: { test: "allow" }, currentTaskId: "t", context: {}, memory: { checkpoint: "ready" }, startedAt: createdAt }));
    app.inbox.enqueue(createInboxItem({ id: "i", projectId: "p", agentId: "a", kind: "review", priority: "high", payload: {}, createdAt }));
    app.tools.start({ id: "call", projectId: "p", agentId: "a", sessionId: "s", taskId: "t", tool: "test.run", arguments: {}, startedAt: createdAt });
    app.events.append(createCrewEvent({ id: "event", type: "agent.heartbeat", projectId: "p", actor: { type: "agent", id: "a" }, payload: { agentId: "a" }, createdAt }));
    const result = new AgentInspector(app.identities, app.sessions, app.inbox, app.events, app.tools).get("p", "a", Date.parse(createdAt) + 5_000);
    expect(result).toMatchObject({ status: "working", currentTaskId: "t", currentTool: "test.run", queueLength: 1, lastHeartbeatAt: createdAt, session: { id: "s", durationMs: 5_000 }, memory: { checkpoint: "ready" }, model: { provider: "codex", name: "gpt" }, tokenUsage: null, cost: null });
  });

  it("materializes the review chain with an optional human approval gate", () => {
    const app = stores(); app.identities.create(createAgentIdentity({ id: "chief", name: "Chief", role: "supervisor" }));
    const bus = new CrewEventBus(); const audit = new SqliteAuditStore(app.database); const approvals = new ApprovalService(app.database, app.events, audit, bus); const store = new WorkflowStore(app.database);
    const pipeline = new ReviewPipeline(new WorkflowEngine(app.database, store, approvals, app.events, audit, bus, async () => undefined));
    const gated = pipeline.create({ projectId: "p", ownerAgentId: "chief", task: "Export", requireHumanApproval: true });
    expect(store.steps(gated.id).map((step) => [step.key, step.kind, step.dependsOn])).toEqual([
      ["implementation", "agent", []], ["testing", "agent", ["implementation"]], ["review", "agent", ["testing"]], ["human-approval", "approval", ["review"]],
    ]);
    const automatic = pipeline.create({ projectId: "p", ownerAgentId: "chief", task: "Docs", requireHumanApproval: false });
    expect(store.steps(automatic.id).map((step) => step.key)).toEqual(["implementation", "testing", "review"]);
  });
});
