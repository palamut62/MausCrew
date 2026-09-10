import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";

import { SqliteAuditStore } from "../audit/sqlite-audit-store.ts";
import { CrewEventBus } from "../crew-core/event-bus.ts";
import { createAgentIdentity } from "../crew-core/identity.ts";
import { AgentIdentityStore } from "../storage/agent-identity-store.ts";
import { CrewDatabase } from "../storage/crew-database.ts";
import { CrewEventStore } from "../storage/event-store.ts";
import { WorkflowStore } from "../storage/workflow-store.ts";
import { ApprovalService } from "../tools/approval-service.ts";
import { parseWorkflowDefinition } from "./definition.ts";
import { WorkflowEngine, type WorkflowAgentExecutor } from "./workflow-engine.ts";
import { legacyWorkflowToDefinition } from "./legacy-workflow-adapter.ts";

const databases: CrewDatabase[] = []; const directories: string[] = [];
afterEach(() => { while (databases.length) databases.pop()!.close(); while (directories.length) rmSync(directories.pop()!, { recursive: true, force: true }); });

function harness(executor: WorkflowAgentExecutor, path = ":memory:", maxConcurrency = 4) {
  const database = new CrewDatabase(path); databases.push(database);
  const identities = new AgentIdentityStore(database);
  if (!identities.get("chief")) identities.create(createAgentIdentity({ id: "chief", name: "Chief", role: "supervisor" }));
  const events = new CrewEventStore(database); const audit = new SqliteAuditStore(database); const bus = new CrewEventBus();
  const approvals = new ApprovalService(database, events, audit, bus); const store = new WorkflowStore(database);
  return { database, events, audit, approvals, store, engine: new WorkflowEngine(database, store, approvals, events, audit, bus, executor, { maxConcurrency }) };
}

const YAML = `
name: Feature Implementation
trigger:
  type: manual
steps:
  - id: plan
    agent: architect
    task: plan
  - parallel:
      - id: backend
        agent: backend
        task: implement-backend
      - id: frontend
        agent: frontend
        task: implement-frontend
  - id: test
    agent: tester
    task: test
  - id: approve
    approval:
      type: human
`;

describe("persistent YAML workflow engine", () => {
  it("parses parallel groups into an acyclic dependency graph", () => {
    const definition = parseWorkflowDefinition({ id: "d", projectId: "p", yaml: YAML });
    expect(definition.steps).toMatchObject([
      { key: "plan", dependsOn: [] }, { key: "backend", dependsOn: ["plan"] }, { key: "frontend", dependsOn: ["plan"] },
      { key: "test", dependsOn: ["backend", "frontend"] }, { key: "approve", dependsOn: ["test"] },
    ]);
    expect(() => parseWorkflowDefinition({ projectId: "p", yaml: "name: Bad\ntrigger: { type: schedule }\nsteps: []" })).toThrow("manual");
    expect(() => parseWorkflowDefinition({ projectId: "p", yaml: "name: Bad\ntrigger: { type: manual }\nsteps:\n - &x {agent: dev, task: x}\n - *x" })).toThrow();
  });

  it("adapts an existing JSON workflow without losing dependency edges", () => {
    const definition = legacyWorkflowToDefinition({ id: "old", title: "Legacy", ownerBotId: "chief", threadId: "thread", projectId: "p", status: "active", createdAt: 1_788_880_000_000, updatedAt: 1_788_880_001_000, steps: [
      { id: "a", title: "Plan", dependsOn: [], status: "done", updatedAt: 1 },
      { id: "b", title: "Build", assigneeBotId: "dev", dependsOn: ["a"], status: "pending", updatedAt: 2 },
    ] });
    expect(definition.steps).toMatchObject([{ key: "a", dependsOn: [] }, { key: "b", agent: "dev", dependsOn: ["a"] }]);
    expect(definition.yaml).toContain("legacyWorkflowId: old");
  });

  it("executes independent steps in parallel and waits for human approval", async () => {
    let active = 0; let peak = 0; const order: string[] = [];
    const app = harness(async (step) => { active++; peak = Math.max(peak, active); order.push(step.key); await new Promise((resolve) => setTimeout(resolve, step.key === "plan" ? 1 : 20)); active--; return { key: step.key }; }, ":memory:", 2);
    const definition = app.engine.define({ id: "d", projectId: "p", yaml: YAML }); const run = app.engine.start(definition.id, "chief");
    expect((await app.engine.execute(run.id)).status).toBe("waiting_approval");
    expect(peak).toBe(2); expect(order.indexOf("test")).toBeGreaterThan(order.indexOf("frontend"));
    const approvalStep = app.store.steps(run.id).find((step) => step.kind === "approval")!;
    app.approvals.decide(approvalStep.approvalId!, "approved", "user");
    expect((await app.engine.resume(run.id)).status).toBe("completed");
    expect(app.events.list({ projectId: "p" }).map(({ event }) => event.type)).toEqual(expect.arrayContaining(["workflow.started", "workflow.completed"]));
    expect(app.audit.verify("p")).toBe(true);
  });

  it("persists approval state and resumes after a database restart", async () => {
    const directory = mkdtempSync(join(tmpdir(), "mauscrew-workflow-")); directories.push(directory); const path = join(directory, "crew.sqlite");
    const first = harness(async (step) => step.key, path); const definition = first.engine.define({ id: "d", projectId: "p", yaml: YAML }); const run = first.engine.start(definition.id, "chief");
    expect((await first.engine.execute(run.id)).status).toBe("waiting_approval"); const approvalId = first.store.steps(run.id).find((step) => step.approvalId)!.approvalId!;
    first.database.close(); databases.splice(databases.indexOf(first.database), 1);
    const second = harness(async (step) => step.key, path); second.approvals.decide(approvalId, "approved", "user");
    expect((await second.engine.resume(run.id)).status).toBe("completed"); expect(second.store.steps(run.id).every((step) => step.status === "completed")).toBe(true);
  });

  it("persists failures and propagates cancellation to an active executor", async () => {
    const failed = harness(async () => { throw new Error("agent crashed"); }); const failedDef = failed.engine.define({ id: "failed", projectId: "p", yaml: "name: Fail\ntrigger: { type: manual }\nsteps:\n - agent: dev\n   task: fail" }); const failedRun = failed.engine.start(failedDef.id, "chief");
    expect(await failed.engine.execute(failedRun.id)).toMatchObject({ status: "failed", error: "agent crashed" });

    let release!: () => void; let signal!: AbortSignal;
    const cancelled = harness(async (_step, context) => { signal = context.signal; await new Promise<void>((resolve) => { release = resolve; }); });
    const cancelDef = cancelled.engine.define({ id: "cancel", projectId: "p2", yaml: "name: Cancel\ntrigger: { type: manual }\nsteps:\n - agent: dev\n   task: wait" }); const cancelRun = cancelled.engine.start(cancelDef.id, "chief");
    const executing = cancelled.engine.execute(cancelRun.id); await new Promise((resolve) => setTimeout(resolve, 0));
    expect(cancelled.engine.cancel(cancelRun.id).status).toBe("cancelled"); expect(signal.aborted).toBe(true); release();
    expect((await executing).status).toBe("cancelled"); expect(cancelled.store.steps(cancelRun.id)[0]?.status).toBe("cancelled");
  });
});
