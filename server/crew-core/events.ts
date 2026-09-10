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
  "handoff.created",
  "handoff.accepted",
  "handoff.completed",
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
  "git.commit_created",
  "git.review_requested",
  "git.review_completed",
  "review.requested",
  "dependency.completed",
] as const;

export type CrewEventType = (typeof CREW_EVENT_TYPES)[number];
export type CrewActorType = "human" | "agent" | "system";

export interface CrewEvent<T = unknown> {
  id: string;
  type: CrewEventType;
  projectId: string;
  actor: { type: CrewActorType; id: string };
  payload: T;
  createdAt: string;
  correlationId?: string;
  causationId?: string;
}

export type CrewEventDraft<T = unknown> = Omit<CrewEvent<T>, "id" | "createdAt"> & {
  id?: string;
  createdAt?: string;
};

const eventTypes = new Set<string>(CREW_EVENT_TYPES);

export function createCrewEvent<T>(draft: CrewEventDraft<T>): CrewEvent<T> {
  if (!eventTypes.has(draft.type)) throw new Error(`Unsupported crew event type: ${draft.type}`);
  if (!draft.projectId.trim()) throw new Error("Crew event projectId is required");
  if (!draft.actor.id.trim()) throw new Error("Crew event actor id is required");
  const createdAt = draft.createdAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(createdAt))) throw new Error("Crew event createdAt must be an ISO timestamp");
  return {
    ...draft,
    id: draft.id ?? randomUUID(),
    projectId: draft.projectId.trim(),
    actor: { ...draft.actor, id: draft.actor.id.trim() },
    createdAt,
  };
}
