import { stringify } from "yaml";

import type { WorkflowEngine } from "../workflow-engine/workflow-engine.ts";
import type { WorkflowRun } from "../workflow-engine/types.ts";

export class ReviewPipeline {
  constructor(readonly workflows: WorkflowEngine) {}
  create(input: { projectId: string; ownerAgentId: string; task: string; implementationRole?: string; testingRole?: string; reviewerRole?: string; requireHumanApproval: boolean }): WorkflowRun {
    const steps: unknown[] = [
      { id: "implementation", agent: input.implementationRole ?? "implementation", task: input.task },
      { id: "testing", agent: input.testingRole ?? "tester", task: `Test and verify: ${input.task}` },
      { id: "review", agent: input.reviewerRole ?? "reviewer", task: `Review evidence and changes: ${input.task}` },
    ];
    if (input.requireHumanApproval) steps.push({ id: "human-approval", approval: { type: "human" } });
    const definition = this.workflows.define({ projectId: input.projectId, yaml: stringify({ name: `Review: ${input.task}`, trigger: { type: "manual" }, steps }) });
    return this.workflows.start(definition.id, input.ownerAgentId);
  }
}
