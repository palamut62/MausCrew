import { InvalidAgentStatusTransitionError, canTransitionAgentStatus } from "./status-machine.js";
import { createCrewEvent } from "./events.js";
export class AgentLifecycleService {
    database;
    identities;
    events;
    audit;
    bus;
    constructor(database, identities, events, audit, bus) {
        this.database = database;
        this.identities = identities;
        this.events = events;
        this.audit = audit;
        this.bus = bus;
    }
    create(projectId, identity, actor) {
        const event = createCrewEvent({
            type: "agent.created",
            projectId,
            actor,
            payload: identity,
            correlationId: identity.id,
        });
        this.database.transaction(() => {
            this.identities.create(identity);
            this.events.append(event);
            this.audit.append({
                projectId,
                actorId: actor.id,
                actorType: actor.type,
                action: "agent.created",
                target: identity.id,
                metadata: { name: identity.name, role: identity.role },
                createdAt: event.createdAt,
            });
        });
        this.bus.publish(event);
    }
    transition(input) {
        const identity = this.identities.get(input.agentId);
        if (!identity)
            throw new Error(`Unknown agent: ${input.agentId}`);
        if (identity.status === input.to)
            return identity.status;
        if (!canTransitionAgentStatus(identity.status, input.to))
            throw new InvalidAgentStatusTransitionError(identity.status, input.to);
        const payload = {
            agentId: input.agentId,
            from: identity.status,
            to: input.to,
            ...(input.reason ? { reason: input.reason } : {}),
            ...(input.taskId ? { taskId: input.taskId } : {}),
        };
        const event = createCrewEvent({
            type: "agent.status_changed",
            projectId: input.projectId,
            actor: input.actor,
            payload,
            correlationId: input.correlationId,
            causationId: input.causationId,
        });
        this.database.transaction(() => {
            input.mutation?.();
            if (!this.identities.setStatus(input.agentId, input.to, event.createdAt))
                throw new Error(`Unknown agent: ${input.agentId}`);
            this.events.append(event);
            this.audit.append({
                projectId: input.projectId,
                actorId: input.actor.id,
                actorType: input.actor.type,
                action: "agent.status_changed",
                target: input.agentId,
                metadata: payload,
                createdAt: event.createdAt,
            });
        });
        this.bus.publish(event);
        return input.to;
    }
}
