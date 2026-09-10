import { randomUUID } from "node:crypto";
import { parseDocument } from "yaml";
function object(value, label) { if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label} must be an object`); return value; }
function required(value, label) { if (typeof value !== "string" || !value.trim())
    throw new Error(`${label} is required`); return value.trim(); }
function keyFor(prefix, index, row) { const raw = typeof row.id === "string" ? row.id.trim() : ""; return raw || `${prefix}-${index + 1}`; }
export function parseWorkflowDefinition(input) {
    const document = parseDocument(input.yaml, { strict: true });
    if (document.errors.length)
        throw new Error(`Invalid workflow YAML: ${document.errors[0].message}`);
    const root = object(document.toJS({ maxAliasCount: 0 }), "Workflow");
    const name = required(root.name, "Workflow name");
    const trigger = object(root.trigger, "Workflow trigger");
    if (trigger.type !== "manual")
        throw new Error("Only manual workflow triggers are supported");
    if (!Array.isArray(root.steps) || root.steps.length < 1 || root.steps.length > 50)
        throw new Error("Workflow needs 1 to 50 steps");
    const steps = [];
    let previous = [];
    const keys = new Set();
    const append = (rowValue, prefix, index, dependencies) => {
        const row = object(rowValue, "Workflow step");
        const key = keyFor(prefix, index, row);
        if (keys.has(key))
            throw new Error(`Duplicate workflow step id: ${key}`);
        keys.add(key);
        if (typeof row.agent === "string")
            steps.push({ key, kind: "agent", agent: required(row.agent, "Step agent"), task: required(row.task, "Step task"), dependsOn: [...dependencies] });
        else if (row.approval !== undefined) {
            const approval = object(row.approval, "Approval step");
            if (approval.type !== "human")
                throw new Error("Only human approval steps are supported");
            steps.push({ key, kind: "approval", approvalType: "human", dependsOn: [...dependencies] });
        }
        else
            throw new Error("Workflow step must contain agent or approval");
        return key;
    };
    root.steps.forEach((value, index) => {
        const row = object(value, "Workflow step");
        if (Array.isArray(row.parallel)) {
            if (!row.parallel.length)
                throw new Error("Parallel workflow group cannot be empty");
            previous = row.parallel.map((child, childIndex) => append(child, `parallel-${index + 1}`, childIndex, previous));
        }
        else
            previous = [append(row, "step", index, previous)];
    });
    const now = input.createdAt ?? new Date().toISOString();
    return { id: input.id ?? randomUUID(), projectId: required(input.projectId, "Project id"), name, triggerType: "manual", yaml: input.yaml, steps, createdAt: now, updatedAt: now };
}
