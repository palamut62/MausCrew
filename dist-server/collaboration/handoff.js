import { randomUUID } from "node:crypto";
export const HANDOFF_EVIDENCE_TYPES = ["file", "commit", "test", "url", "message", "artifact"];
export function createAgentHandoff(draft) {
    if (![draft.projectId, draft.fromAgentId, draft.toAgentId, draft.taskId, draft.summary].every((value) => value.trim()))
        throw new Error("Handoff identity, task and summary are required");
    if (draft.fromAgentId === draft.toAgentId)
        throw new Error("Handoff target must be another agent");
    if (draft.nextActions.length === 0 || draft.nextActions.some((action) => !action.trim()))
        throw new Error("Handoff requires at least one next action");
    if (draft.evidence.some((item) => !item.value.trim()))
        throw new Error("Handoff evidence value is required");
    const createdAt = draft.createdAt ?? new Date().toISOString();
    return { ...structuredClone(draft), id: draft.id ?? randomUUID(), status: "pending", createdAt, updatedAt: createdAt };
}
