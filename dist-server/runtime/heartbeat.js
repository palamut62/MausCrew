import { createCrewEvent } from "../crew-core/events.js";
export class AgentHeartbeatService {
    database;
    sessions;
    identities;
    events;
    audit;
    lifecycle;
    bus;
    staleAfterMs;
    now;
    constructor(database, sessions, identities, events, audit, lifecycle, bus, staleAfterMs = 30_000, now = Date.now) {
        this.database = database;
        this.sessions = sessions;
        this.identities = identities;
        this.events = events;
        this.audit = audit;
        this.lifecycle = lifecycle;
        this.bus = bus;
        this.staleAfterMs = staleAfterMs;
        this.now = now;
        if (staleAfterMs < 1)
            throw new Error("staleAfterMs must be positive");
    }
    record(input) {
        const session = this.sessions.get(input.sessionId);
        if (!session || session.endedAt || session.agentId !== input.agentId)
            throw new Error("Heartbeat session is not active for this agent");
        const identity = this.identities.get(input.agentId);
        if (!identity || identity.status !== input.status)
            throw new Error("Heartbeat status does not match canonical agent status");
        const heartbeat = {
            agentId: input.agentId,
            status: input.status,
            ...(input.taskId ? { taskId: input.taskId } : {}),
            ...(input.currentAction ? { currentAction: input.currentAction } : {}),
            timestamp: input.timestamp ?? new Date(this.now()).toISOString(),
        };
        const event = createCrewEvent({
            type: "agent.heartbeat",
            projectId: session.projectId,
            actor: { type: "agent", id: input.agentId },
            payload: heartbeat,
            correlationId: input.sessionId,
        });
        this.database.transaction(() => {
            if (!this.sessions.heartbeat(input.sessionId, heartbeat.timestamp))
                throw new Error("Heartbeat session ended before commit");
            this.events.append(event);
            this.audit.append({
                projectId: session.projectId,
                actorId: input.agentId,
                actorType: "agent",
                action: "agent.heartbeat",
                target: input.sessionId,
                metadata: { status: input.status, taskId: input.taskId, currentAction: input.currentAction },
                createdAt: heartbeat.timestamp,
            });
        });
        this.bus.publish(event);
        return heartbeat;
    }
    markStale() {
        const cutoff = this.now() - this.staleAfterMs;
        const stale = [];
        for (const session of this.sessions.active()) {
            if (Date.parse(session.lastHeartbeatAt) > cutoff)
                continue;
            const identity = this.identities.get(session.agentId);
            if (!identity || ["offline", "completed", "error", "stale"].includes(identity.status))
                continue;
            this.lifecycle.transition({
                projectId: session.projectId,
                agentId: session.agentId,
                to: "stale",
                actor: { type: "system", id: "heartbeat-monitor" },
                reason: "heartbeat_timeout",
                correlationId: session.id,
            });
            stale.push(session.agentId);
        }
        return stale;
    }
}
