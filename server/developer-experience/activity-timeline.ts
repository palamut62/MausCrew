import type { CrewEventType } from "../crew-core/events.ts";
import type { CrewEventStore } from "../storage/event-store.ts";

export type ActivityKind = "message" | "task" | "agent" | "handoff" | "tool" | "git" | "review" | "approval" | "workflow" | "system";
export interface ActivityTimelineItem {
  id: string; sequence: number; projectId: string; kind: ActivityKind; type: CrewEventType;
  actor: { type: "human" | "agent" | "system"; id: string }; payload: unknown; createdAt: string;
  correlationId?: string; causationId?: string;
}
export interface ActivityTimelineSource { list(projectId: string, limit: number): ActivityTimelineItem[] }

function kindFor(type: CrewEventType): ActivityKind {
  if (type === "git.review_requested" || type === "git.review_completed") return "review";
  const prefix = type.split(".", 1)[0];
  if (prefix === "message" || prefix === "task" || prefix === "agent" || prefix === "handoff" || prefix === "tool" || prefix === "git" || prefix === "approval" || prefix === "workflow") return prefix;
  if (prefix === "review") return "review";
  return "system";
}

export class ActivityTimeline {
  constructor(readonly events: CrewEventStore, readonly legacySources: readonly ActivityTimelineSource[] = []) {}
  list(projectId: string, limit = 200): ActivityTimelineItem[] {
    const boundedLimit = Math.min(Math.max(limit, 1), 1_000);
    const canonical = this.events.recent({ projectId, limit: boundedLimit }).map(({ sequence, event }) => ({
      id: event.id, sequence, projectId: event.projectId, kind: kindFor(event.type), type: event.type,
      actor: event.actor, payload: event.payload, createdAt: event.createdAt,
      ...(event.correlationId ? { correlationId: event.correlationId } : {}),
      ...(event.causationId ? { causationId: event.causationId } : {}),
    }));
    return [...canonical, ...this.legacySources.flatMap((source) => source.list(projectId, boundedLimit))]
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.sequence - right.sequence || left.id.localeCompare(right.id))
      .slice(-boundedLimit);
  }
}
