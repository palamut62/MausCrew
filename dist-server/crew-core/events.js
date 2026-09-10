import { randomUUID } from "node:crypto";
export const CREW_EVENT_TYPES = [
    "agent.created",
    "agent.started",
    "agent.stopped",
    "agent.status_changed",
    "agent.heartbeat",
    "agent.wakeup_requested",
    "task.created",
    "task.assigned",
    "task.started",
    "task.completed",
    "task.failed",
    "task.blocked",
    "task.cancelled",
    "task.dependency_added",
    "handoff.created",
    "handoff.accepted",
    "handoff.completed",
    "handoff.rejected",
    "message.created",
    "message.mentioned",
    "tool.started",
    "tool.completed",
    "tool.failed",
    "approval.requested",
    "approval.approved",
    "approval.rejected",
    "workflow.started",
    "workflow.completed",
    "workflow.failed",
    "workflow.cancelled",
    "git.commit_created",
    "git.review_requested",
    "git.review_completed",
    "review.requested",
    "dependency.completed",
];
const eventTypes = new Set(CREW_EVENT_TYPES);
export function createCrewEvent(draft) {
    if (!eventTypes.has(draft.type))
        throw new Error(`Unsupported crew event type: ${draft.type}`);
    if (!draft.projectId.trim())
        throw new Error("Crew event projectId is required");
    if (!draft.actor.id.trim())
        throw new Error("Crew event actor id is required");
    const createdAt = draft.createdAt ?? new Date().toISOString();
    if (!Number.isFinite(Date.parse(createdAt)))
        throw new Error("Crew event createdAt must be an ISO timestamp");
    return {
        ...draft,
        id: draft.id ?? randomUUID(),
        projectId: draft.projectId.trim(),
        actor: { ...draft.actor, id: draft.actor.id.trim() },
        createdAt,
    };
}
