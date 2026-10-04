import { afterEach, describe, expect, it } from "vitest";

import { SqliteAuditStore } from "../audit/sqlite-audit-store.ts";
import { CrewEventBus } from "../crew-core/event-bus.ts";
import { createAgentIdentity } from "../crew-core/identity.ts";
import { AgentInboxStore } from "../storage/agent-inbox-store.ts";
import { AgentIdentityStore } from "../storage/agent-identity-store.ts";
import { CrewDatabase } from "../storage/crew-database.ts";
import { CrewEventStore } from "../storage/event-store.ts";
import { TaskStore } from "../storage/task-store.ts";
import { SupervisorOrchestrator } from "../supervisor/orchestrator.ts";
import { AgentWakeupRouter } from "../runtime/wakeup-router.ts";
import { TaskScheduler } from "./task-scheduler.ts";
import { TaskService } from "./task-service.ts";

const open: CrewDatabase[] = [];
afterEach(() => { while (open.length) open.pop()!.close(); });

function harness(maxConcurrentAgents = 4) {
  const database = new CrewDatabase(":memory:"); open.push(database);
  const identities = new AgentIdentityStore(database);
  const events = new CrewEventStore(database);
  const audit = new SqliteAuditStore(database);
  const bus = new CrewEventBus();
  const tasks = new TaskStore(database);
  const service = new TaskService(database, tasks, events, audit, bus);
  const scheduler = new TaskScheduler(tasks, identities, service, { maxConcurrentAgents });
  return { database, identities, events, audit, bus, tasks, service, scheduler, supervisor: new SupervisorOrchestrator(service, scheduler) };
}

function agent(app: ReturnType<typeof harness>, id: string, role: string) {
  app.identities.create(createAgentIdentity({ id, name: id, role, createdAt: "2026-09-10T10:00:00.000Z" }));
}

describe("task orchestration", () => {
  it("builds a cycle-safe DAG and releases dependencies after completion", () => {
    const app = harness();
    app.service.createGraph([
      { id: "backend", projectId: "p", title: "Backend", role: "backend", createdBy: "user" },
      { id: "test", projectId: "p", title: "Test", role: "tester", createdBy: "user", dependsOn: ["backend"] },
    ], { type: "human", id: "user" });
    expect(app.tasks.get("backend")?.status).toBe("ready");
    expect(app.tasks.get("test")?.status).toBe("pending");
    expect(() => app.tasks.addDependency("p", "backend", "test")).toThrow("Circular");
    agent(app, "backend-agent", "backend");
    app.service.assign("backend", "backend-agent", { type: "system", id: "supervisor" });
    app.service.start("backend", { type: "agent", id: "backend-agent" });
    app.service.complete("backend", { type: "agent", id: "backend-agent" });
    expect(app.tasks.get("test")?.status).toBe("ready");
    expect(app.audit.verify("p")).toBe(true);
  });

  it("schedules independent work in parallel within the configured limit and wakes agents", async () => {
    const app = harness(2);
    agent(app, "a-back", "backend"); agent(app, "a-front", "frontend"); agent(app, "a-test", "tester");
    const inbox = new AgentInboxStore(app.database, 10);
    const woken: string[] = [];
    const router = new AgentWakeupRouter(app.bus, inbox, (id) => { woken.push(id); });
    router.start();
    app.supervisor.materialize("p", { intent: "feature", tasks: [
      { key: "back", title: "Backend", role: "backend" },
      { key: "front", title: "Frontend", role: "frontend" },
      { key: "test", title: "Test", role: "tester", dependsOn: ["back", "front"] },
    ] });
    expect(app.supervisor.dispatchReady("p")).toHaveLength(2);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(woken.sort()).toEqual(["a-back", "a-front"]);
    expect(inbox.claim("a-back")).toMatchObject({ kind: "task", priority: "high" });
    expect(app.tasks.get("p:test")?.status).toBe("pending");
    router.stop();
  });

  it("rolls back an invalid graph and supports cancellation and stalled recovery", () => {
    const app = harness();
    expect(() => app.service.createGraph([
      { id: "a", projectId: "p", title: "A", role: "dev", createdBy: "user", dependsOn: ["missing"] },
    ], { type: "human", id: "user" })).toThrow("Unknown task dependency");
    expect(app.tasks.list("p")).toEqual([]);
    agent(app, "dev", "dev");
    app.supervisor.materialize("p", { intent: "repair", tasks: [{ key: "a", title: "A", role: "dev" }] });
    app.supervisor.dispatchReady("p");
    expect(app.supervisor.recoverStalled("p", "9999-01-01T00:00:00.000Z")[0]?.status).toBe("blocked");
    expect(app.service.cancel("p:a", { type: "human", id: "user" }).status).toBe("cancelled");
  });
});
