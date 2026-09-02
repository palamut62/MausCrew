import { readFileSync } from "node:fs";
import { join } from "node:path";

import { writeFileAtomic } from "./atomic.ts";
import { DATA_DIR } from "./config.ts";
import { newId } from "./contracts.ts";

export type WorkflowStepStatus = "pending" | "running" | "blocked" | "done" | "failed";
export type WorkflowStatus = "active" | "blocked" | "completed" | "failed" | "cancelled";

export interface WorkflowStep {
  id: string;
  title: string;
  assigneeBotId?: string;
  dependsOn: string[];
  status: WorkflowStepStatus;
  output?: string;
  updatedAt: number;
}

export interface WorkflowRecord {
  id: string;
  title: string;
  ownerBotId: string;
  threadId: string;
  projectId?: string;
  status: WorkflowStatus;
  steps: WorkflowStep[];
  createdAt: number;
  updatedAt: number;
}

export interface WorkflowStepInput {
  id?: string;
  title: string;
  assigneeBotId?: string;
  dependsOn?: string[];
}

const WORKFLOWS_FILE = join(DATA_DIR, "workflows.json");

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function assertDag(steps: WorkflowStep[]): void {
  const byId = new Map(steps.map((step) => [step.id, step]));
  for (const step of steps) {
    if (step.dependsOn.includes(step.id)) throw Object.assign(new Error("A workflow step cannot depend on itself"), { status: 400 });
    for (const dependency of step.dependsOn) {
      if (!byId.has(dependency)) throw Object.assign(new Error(`Unknown workflow dependency: ${dependency}`), { status: 400 });
    }
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string) => {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw Object.assign(new Error("Workflow dependencies contain a cycle"), { status: 400 });
    visiting.add(id);
    for (const dependency of byId.get(id)?.dependsOn ?? []) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const step of steps) visit(step.id);
}

function statusFor(steps: WorkflowStep[], fallback: WorkflowStatus): WorkflowStatus {
  if (fallback === "cancelled") return fallback;
  if (steps.some((step) => step.status === "failed")) return "failed";
  if (steps.every((step) => step.status === "done")) return "completed";
  if (steps.some((step) => step.status === "blocked")) return "blocked";
  return "active";
}

function normalizeWorkflow(value: Partial<WorkflowRecord>): WorkflowRecord | null {
  const id = text(value.id, 100);
  const title = text(value.title, 160);
  const ownerBotId = text(value.ownerBotId, 100);
  const threadId = text(value.threadId, 100);
  if (!id || !title || !ownerBotId || !threadId || !Array.isArray(value.steps)) return null;
  const now = Date.now();
  const steps = value.steps
    .map((raw): WorkflowStep | null => {
      const step = raw as Partial<WorkflowStep>;
      const stepId = text(step.id, 100);
      const stepTitle = text(step.title, 200);
      if (!stepId || !stepTitle) return null;
      const status: WorkflowStepStatus = ["pending", "running", "blocked", "done", "failed"].includes(String(step.status))
        ? (step.status as WorkflowStepStatus)
        : "pending";
      return {
        id: stepId,
        title: stepTitle,
        assigneeBotId: text(step.assigneeBotId, 100) || undefined,
        dependsOn: Array.isArray(step.dependsOn) ? [...new Set(step.dependsOn.filter((item): item is string => typeof item === "string"))] : [],
        status,
        output: text(step.output, 8_000) || undefined,
        updatedAt: Number(step.updatedAt) || now,
      } satisfies WorkflowStep;
    })
    .filter((step): step is WorkflowStep => Boolean(step));
  try {
    assertDag(steps);
  } catch {
    return null;
  }
  const createdAt = Number(value.createdAt) || now;
  const fallback: WorkflowStatus = ["active", "blocked", "completed", "failed", "cancelled"].includes(String(value.status))
    ? (value.status as WorkflowStatus)
    : "active";
  return {
    id,
    title,
    ownerBotId,
    threadId,
    projectId: text(value.projectId, 100) || undefined,
    status: statusFor(steps, fallback),
    steps,
    createdAt,
    updatedAt: Number(value.updatedAt) || createdAt,
  };
}

/**
 * Who may report on a step: the Chief that owns the plan, or the teammate the
 * step was handed to.
 *
 * Deliberately says nothing about threads. A delegated teammate always runs in
 * its own thread, so a rule that also demanded the workflow's thread rejected
 * exactly the bots this admits — assignees could never report, and every step
 * had to be moved by the Chief or from a shared room.
 */
export function canUpdateStep(
  workflow: WorkflowRecord,
  step: WorkflowStep,
  actor: { id: string; chiefOfStaff?: boolean },
): boolean {
  if (workflow.ownerBotId === actor.id && actor.chiefOfStaff === true) return true;
  return Boolean(step.assigneeBotId) && step.assigneeBotId === actor.id;
}

export class WorkflowManager {
  private workflows: WorkflowRecord[] = [];
  private readonly file: string;

  constructor(file = WORKFLOWS_FILE) {
    this.file = file;
    try {
      const rows = JSON.parse(readFileSync(file, "utf8"));
      this.workflows = Array.isArray(rows)
        ? rows.map((row) => normalizeWorkflow(row)).filter((row): row is WorkflowRecord => Boolean(row))
        : [];
    } catch {
      this.workflows = [];
    }
  }

  list(filters: { projectId?: string; ownerBotId?: string } = {}): WorkflowRecord[] {
    return this.workflows
      .filter((workflow) => !filters.projectId || workflow.projectId === filters.projectId)
      .filter((workflow) => !filters.ownerBotId || workflow.ownerBotId === filters.ownerBotId)
      .map((workflow) => structuredClone(workflow));
  }

  get(id: string): WorkflowRecord | undefined {
    const workflow = this.workflows.find((candidate) => candidate.id === id);
    return workflow ? structuredClone(workflow) : undefined;
  }

  create(input: {
    title: string;
    ownerBotId: string;
    threadId: string;
    projectId?: string;
    steps: WorkflowStepInput[];
  }): WorkflowRecord {
    const title = text(input.title, 160);
    if (!title) throw Object.assign(new Error("Give the workflow a title"), { status: 400 });
    if (!Array.isArray(input.steps) || input.steps.length < 1 || input.steps.length > 30) {
      throw Object.assign(new Error("A workflow needs 1 to 30 steps"), { status: 400 });
    }
    const now = Date.now();
    const aliases = new Map<string, string>();
    const ids = input.steps.map((step) => {
      const id = newId();
      const alias = text(step.id, 100);
      if (alias) {
        if (aliases.has(alias)) throw Object.assign(new Error(`Duplicate workflow step id: ${alias}`), { status: 400 });
        aliases.set(alias, id);
      }
      return id;
    });
    const steps = input.steps.map((step, index) => {
      const stepTitle = text(step.title, 200);
      if (!stepTitle) throw Object.assign(new Error("Every workflow step needs a title"), { status: 400 });
      const dependsOn = (step.dependsOn ?? []).map((dependency) => aliases.get(dependency) ?? dependency);
      return {
        id: ids[index]!,
        title: stepTitle,
        assigneeBotId: text(step.assigneeBotId, 100) || undefined,
        dependsOn: [...new Set(dependsOn)],
        status: "pending" as const,
        updatedAt: now,
      };
    });
    assertDag(steps);
    const workflow: WorkflowRecord = {
      id: newId(),
      title,
      ownerBotId: input.ownerBotId,
      threadId: input.threadId,
      projectId: text(input.projectId, 100) || undefined,
      status: "active",
      steps,
      createdAt: now,
      updatedAt: now,
    };
    this.workflows.unshift(workflow);
    this.save();
    return structuredClone(workflow);
  }

  updateStep(
    workflowId: string,
    stepId: string,
    patch: { status: WorkflowStepStatus; output?: string },
  ): WorkflowRecord | null {
    const workflow = this.workflows.find((candidate) => candidate.id === workflowId);
    if (!workflow || workflow.status === "cancelled") return null;
    const step = workflow.steps.find((candidate) => candidate.id === stepId);
    if (!step) return null;
    if ((patch.status === "running" || patch.status === "done") && step.dependsOn.some((dependency) => workflow.steps.find((candidate) => candidate.id === dependency)?.status !== "done")) {
      throw Object.assign(new Error("Complete this step's dependencies first"), { status: 409 });
    }
    step.status = patch.status;
    step.output = text(patch.output, 8_000) || undefined;
    step.updatedAt = Date.now();
    workflow.updatedAt = step.updatedAt;
    workflow.status = statusFor(workflow.steps, workflow.status);
    this.save();
    return structuredClone(workflow);
  }

  cancel(id: string): WorkflowRecord | null {
    const workflow = this.workflows.find((candidate) => candidate.id === id);
    if (!workflow) return null;
    workflow.status = "cancelled";
    workflow.updatedAt = Date.now();
    this.save();
    return structuredClone(workflow);
  }

  private save(): void {
    writeFileAtomic(this.file, JSON.stringify(this.workflows, null, 2));
  }
}
