import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { canUpdateStep, WorkflowManager } from "./workflows.ts";

describe("WorkflowManager", () => {
  it("enforces dependencies and persists completed output", () => {
    const file = join(mkdtempSync(join(tmpdir(), "mauscrew-workflows-")), "workflows.json");
    const manager = new WorkflowManager(file);
    const workflow = manager.create({
      title: "Onboarding",
      ownerBotId: "chief",
      threadId: "thread",
      steps: [
        { id: "requirements", title: "Requirements", assigneeBotId: "pm" },
        { id: "build", title: "Build", assigneeBotId: "dev", dependsOn: ["requirements"] },
      ],
    });
    const [requirements, build] = workflow.steps;
    expect(() => manager.updateStep(workflow.id, build!.id, { status: "running" })).toThrow("dependencies");
    manager.updateStep(workflow.id, requirements!.id, { status: "done", output: "Approved scope" });
    manager.updateStep(workflow.id, build!.id, { status: "done", output: "Implemented" });
    expect(new WorkflowManager(file).get(workflow.id)).toMatchObject({ status: "completed" });
  });

  it("lets the assigned teammate report on its own step", () => {
    // The delegated bot runs in its own thread, never the Chief's — which is
    // why this rule may not look at threads at all.
    const file = join(mkdtempSync(join(tmpdir(), "mauscrew-workflows-")), "workflows.json");
    const workflow = new WorkflowManager(file).create({
      title: "Onboarding",
      ownerBotId: "chief",
      threadId: "chief-thread",
      steps: [{ id: "build", title: "Build", assigneeBotId: "dev" }],
    });
    const step = workflow.steps[0]!;
    expect(canUpdateStep(workflow, step, { id: "dev" })).toBe(true);
    expect(canUpdateStep(workflow, step, { id: "chief", chiefOfStaff: true })).toBe(true);
    // A chief that no longer holds the role, and a bot with no stake in it
    expect(canUpdateStep(workflow, step, { id: "chief" })).toBe(false);
    expect(canUpdateStep(workflow, step, { id: "stranger" })).toBe(false);
  });

  it("does not let an unassigned step be claimed by anyone", () => {
    const file = join(mkdtempSync(join(tmpdir(), "mauscrew-workflows-")), "workflows.json");
    const workflow = new WorkflowManager(file).create({
      title: "Onboarding",
      ownerBotId: "chief",
      threadId: "chief-thread",
      steps: [{ id: "build", title: "Build" }],
    });
    expect(canUpdateStep(workflow, workflow.steps[0]!, { id: "dev" })).toBe(false);
  });

  it("rejects cyclic dependency graphs", () => {
    const file = join(mkdtempSync(join(tmpdir(), "mauscrew-workflows-")), "workflows.json");
    const manager = new WorkflowManager(file);
    expect(() => manager.create({
      title: "Cycle",
      ownerBotId: "chief",
      threadId: "thread",
      steps: [
        { id: "a", title: "A", dependsOn: ["b"] },
        { id: "b", title: "B", dependsOn: ["a"] },
      ],
    })).toThrow("cycle");
  });
});
