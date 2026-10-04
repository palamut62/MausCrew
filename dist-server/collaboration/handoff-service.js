import { createCrewEvent } from "../crew-core/events.js";
import { createAgentHandoff } from "./handoff.js";
export class HandoffService {
    database;
    handoffs;
    events;
    audit;
    bus;
    constructor(database, handoffs, events, audit, bus) {
        this.database = database;
        this.handoffs = handoffs;
        this.events = events;
        this.audit = audit;
        this.bus = bus;
    }
    create(draft, actor) {
        const handoff = createAgentHandoff(draft);
        let event;
        this.database.transaction(() => {
            this.handoffs.create(handoff);
            event = this.#record("handoff.created", handoff, actor);
        });
        this.bus.publish(event);
        return handoff;
    }
    accept(id, actor) { return this.#transition(id, "pending", "accepted", "handoff.accepted", actor); }
    reject(id, actor) { return this.#transition(id, "pending", "rejected", "handoff.rejected", actor); }
    complete(id, evidence, actor) { return this.#transition(id, "accepted", "completed", "handoff.completed", actor, evidence); }
    #transition(id, from, to, type, actor, evidence = []) {
        let handoff;
        let event;
        this.database.transaction(() => {
            handoff = this.handoffs.transition(id, from, to, evidence);
            event = this.#record(type, handoff, actor);
        });
        this.bus.publish(event);
        return handoff;
    }
    #record(type, handoff, actor) {
        const event = createCrewEvent({ type, projectId: handoff.projectId, actor, payload: handoff, correlationId: handoff.taskId, causationId: handoff.id });
        this.events.append(event);
        this.audit.append({ projectId: handoff.projectId, actorId: actor.id, actorType: actor.type, action: type, target: handoff.id, metadata: { taskId: handoff.taskId, fromAgentId: handoff.fromAgentId, toAgentId: handoff.toAgentId, status: handoff.status, evidenceCount: handoff.evidence.length }, createdAt: event.createdAt });
        return event;
    }
}
