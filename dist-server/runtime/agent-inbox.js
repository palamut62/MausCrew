import { randomUUID } from "node:crypto";
export const INBOX_PRIORITIES = ["critical", "high", "normal", "low"];
export function createInboxItem(draft) {
    if (!draft.projectId.trim() || !draft.agentId.trim())
        throw new Error("Inbox projectId and agentId are required");
    const createdAt = draft.createdAt ?? new Date().toISOString();
    return {
        id: draft.id ?? randomUUID(),
        projectId: draft.projectId.trim(),
        agentId: draft.agentId.trim(),
        kind: draft.kind,
        priority: draft.priority,
        payload: structuredClone(draft.payload),
        ...(draft.sourceEventId ? { sourceEventId: draft.sourceEventId } : {}),
        state: "queued",
        attempts: 0,
        availableAt: draft.availableAt ?? createdAt,
        createdAt,
    };
}
