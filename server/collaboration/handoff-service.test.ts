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
import { HandoffStore } from "../storage/handoff-store.ts";
import { TaskStore } from "../storage/task-store.ts";
import { createTask } from "../tasks/task.ts";
import { HandoffService } from "./handoff-service.ts";

const open: CrewDatabase[] = [];
afterEach(() => { while (open.length) open.pop()!.close(); });

function harness() {
  const database = new CrewDatabase(":memory:"); open.push(database);
  const identities = new AgentIdentityStore(database);
  identities.create(createAgentIdentity({ id: "from", name: "From", role: "tester" }));
  identities.create(createAgentIdentity({ id: "to", name: "To", role: "reviewer" }));
  const tasks = new TaskStore(database);
  tasks.create(createTask({ id: "task", projectId: "p", title: "Review", role: "reviewer", createdBy: "user" }));
  const events = new CrewEventStore(database); const audit = new SqliteAuditStore(database); const bus = new CrewEventBus();
  const store = new HandoffStore(database);
  return { database, store, events, audit, service: new HandoffService(database, store, events, audit, bus) };
}

describe("structured handoff", () => {
  it("persists evidence and enforces transitions", () => {
    const app = harness();
    const handoff = app.service.create({ id: "h", projectId: "p", fromAgentId: "from", toAgentId: "to", taskId: "task", summary: "Tests pass", evidence: [], nextActions: ["Review diff"] }, { type: "agent", id: "from" });
    expect(handoff.status).toBe("pending");
    app.service.accept("h", { type: "agent", id: "to" });
    expect(() => app.service.complete("h", [], { type: "agent", id: "to" })).toThrow("requires evidence");
    const completed = app.service.complete("h", [{ type: "test", value: "pnpm test: passed" }, { type: "commit", value: "abc123" }], { type: "agent", id: "to" });
    expect(completed).toMatchObject({ status: "completed", evidence: [{ type: "test" }, { type: "commit" }] });
    expect(app.events.list({ projectId: "p" }).map(({ event }) => event.type)).toEqual(["handoff.created", "handoff.accepted", "handoff.completed"]);
    expect(app.audit.verify("p")).toBe(true);
  });

  it("rejects self handoff and allows a pending handoff to be rejected", () => {
    const app = harness();
    expect(() => app.service.create({ projectId: "p", fromAgentId: "from", toAgentId: "from", taskId: "task", summary: "No", evidence: [], nextActions: ["No"] }, { type: "agent", id: "from" })).toThrow("another agent");
    app.service.create({ id: "h", projectId: "p", fromAgentId: "from", toAgentId: "to", taskId: "task", summary: "Review", evidence: [{ type: "file", value: "src/a.ts" }], nextActions: ["Review"] }, { type: "agent", id: "from" });
    expect(app.service.reject("h", { type: "agent", id: "to" }).status).toBe("rejected");
  });

  it("restores tasks and handoff evidence after a database restart", () => {
    const directory = mkdtempSync(join(tmpdir(), "mauscrew-phase3-"));
    const path = join(directory, "crew.sqlite");
    try {
      const first = new CrewDatabase(path);
      const identities = new AgentIdentityStore(first);
      identities.create(createAgentIdentity({ id: "from", name: "From", role: "tester" }));
      identities.create(createAgentIdentity({ id: "to", name: "To", role: "reviewer" }));
      const tasks = new TaskStore(first);
      tasks.create(createTask({ id: "task", projectId: "p", title: "Review", role: "reviewer", createdBy: "user" }));
      new HandoffStore(first).create({ id: "h", projectId: "p", fromAgentId: "from", toAgentId: "to", taskId: "task", status: "pending", summary: "Resume", evidence: [{ type: "artifact", value: "report.json" }], nextActions: ["Review"], createdAt: "2026-09-10T10:00:00.000Z", updatedAt: "2026-09-10T10:00:00.000Z" });
      first.close();
      const second = new CrewDatabase(path);
      expect(new TaskStore(second).get("task")?.title).toBe("Review");
      expect(new HandoffStore(second).get("h")?.evidence).toEqual([{ type: "artifact", value: "report.json" }]);
      second.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
