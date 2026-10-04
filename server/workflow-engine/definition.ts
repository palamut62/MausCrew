import { randomUUID } from "node:crypto";
import { parseDocument } from "yaml";

export type WorkflowStepDefinition =
  | { key: string; kind: "agent"; agent: string; task: string; dependsOn: string[] }
  | { key: string; kind: "approval"; approvalType: "human"; dependsOn: string[] };
export interface WorkflowDefinition { id: string; projectId: string; name: string; triggerType: "manual"; yaml: string; steps: WorkflowStepDefinition[]; createdAt: string; updatedAt: string }

function object(value: unknown, label: string): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`); return value as Record<string, unknown>; }
function required(value: unknown, label: string): string { if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required`); return value.trim(); }
function keyFor(prefix: string, index: number, row: Record<string, unknown>): string { const raw = typeof row.id === "string" ? row.id.trim() : ""; return raw || `${prefix}-${index + 1}`; }

export function parseWorkflowDefinition(input: { id?: string; projectId: string; yaml: string; createdAt?: string }): WorkflowDefinition {
  const document = parseDocument(input.yaml, { strict: true });
  if (document.errors.length) throw new Error(`Invalid workflow YAML: ${document.errors[0]!.message}`);
  const root = object(document.toJS({ maxAliasCount: 0 }), "Workflow");
  const name = required(root.name, "Workflow name");
  const trigger = object(root.trigger, "Workflow trigger");
  if (trigger.type !== "manual") throw new Error("Only manual workflow triggers are supported");
  if (!Array.isArray(root.steps) || root.steps.length < 1 || root.steps.length > 50) throw new Error("Workflow needs 1 to 50 steps");
  const steps: WorkflowStepDefinition[] = []; let previous: string[] = []; const keys = new Set<string>();
  const append = (rowValue: unknown, prefix: string, index: number, dependencies: string[]): string => {
    const row = object(rowValue, "Workflow step"); const key = keyFor(prefix, index, row);
    if (keys.has(key)) throw new Error(`Duplicate workflow step id: ${key}`); keys.add(key);
    if (typeof row.agent === "string") steps.push({ key, kind: "agent", agent: required(row.agent, "Step agent"), task: required(row.task, "Step task"), dependsOn: [...dependencies] });
    else if (row.approval !== undefined) { const approval = object(row.approval, "Approval step"); if (approval.type !== "human") throw new Error("Only human approval steps are supported"); steps.push({ key, kind: "approval", approvalType: "human", dependsOn: [...dependencies] }); }
    else throw new Error("Workflow step must contain agent or approval");
    return key;
  };
  root.steps.forEach((value, index) => {
    const row = object(value, "Workflow step");
    if (Array.isArray(row.parallel)) {
      if (!row.parallel.length) throw new Error("Parallel workflow group cannot be empty");
      previous = row.parallel.map((child, childIndex) => append(child, `parallel-${index + 1}`, childIndex, previous));
    } else previous = [append(row, "step", index, previous)];
  });
  const now = input.createdAt ?? new Date().toISOString();
  return { id: input.id ?? randomUUID(), projectId: required(input.projectId, "Project id"), name, triggerType: "manual", yaml: input.yaml, steps, createdAt: now, updatedAt: now };
}
