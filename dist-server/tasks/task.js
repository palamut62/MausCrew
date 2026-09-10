import { randomUUID } from "node:crypto";
export const TASK_STATUSES = ["pending", "ready", "assigned", "running", "blocked", "completed", "failed", "cancelled"];
export function createTask(draft) {
    if (!draft.projectId.trim() || !draft.title.trim() || !draft.role.trim() || !draft.createdBy.trim()) {
        throw new Error("Task projectId, title, role and createdBy are required");
    }
    const createdAt = draft.createdAt ?? new Date().toISOString();
    return {
        id: draft.id ?? randomUUID(),
        projectId: draft.projectId.trim(),
        title: draft.title.trim(),
        description: draft.description?.trim() ?? "",
        role: draft.role.trim(),
        status: "pending",
        priority: draft.priority ?? "normal",
        createdBy: draft.createdBy.trim(),
        createdAt,
        updatedAt: createdAt,
    };
}
