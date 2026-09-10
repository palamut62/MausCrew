function kindFor(type) {
    if (type === "git.review_requested" || type === "git.review_completed")
        return "review";
    const prefix = type.split(".", 1)[0];
    if (prefix === "message" || prefix === "task" || prefix === "agent" || prefix === "handoff" || prefix === "tool" || prefix === "git" || prefix === "approval" || prefix === "workflow")
        return prefix;
    if (prefix === "review")
        return "review";
    return "system";
}
export class ActivityTimeline {
    events;
    legacySources;
    constructor(events, legacySources = []) {
        this.events = events;
        this.legacySources = legacySources;
    }
    list(projectId, limit = 200) {
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
