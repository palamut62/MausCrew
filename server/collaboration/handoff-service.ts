import type { SqliteAuditStore } from "../audit/sqlite-audit-store.ts";
import type { CrewEventBus } from "../crew-core/event-bus.ts";
import { createCrewEvent, type CrewActorType, type CrewEvent, type CrewEventType } from "../crew-core/events.ts";
import type { CrewDatabase } from "../storage/crew-database.ts";
import type { CrewEventStore } from "../storage/event-store.ts";
import type { HandoffStore } from "../storage/handoff-store.ts";
import { createAgentHandoff, type AgentHandoff, type AgentHandoffDraft, type HandoffEvidence, type HandoffStatus } from "./handoff.ts";

type Actor = { type: CrewActorType; id: string };

export class HandoffService {
  constructor(readonly database: CrewDatabase, readonly handoffs: HandoffStore, readonly events: CrewEventStore, readonly audit: SqliteAuditStore, readonly bus: CrewEventBus) {}

  create(draft: AgentHandoffDraft, actor: Actor): AgentHandoff {
    const handoff = createAgentHandoff(draft);
    let event!: CrewEvent;
    this.database.transaction(() => {
      this.handoffs.create(handoff);
      event = this.#record("handoff.created", handoff, actor);
    });
    this.bus.publish(event);
    return handoff;
  }

  accept(id: string, actor: Actor): AgentHandoff { return this.#transition(id, "pending", "accepted", "handoff.accepted", actor); }
  reject(id: string, actor: Actor): AgentHandoff { return this.#transition(id, "pending", "rejected", "handoff.rejected", actor); }
  complete(id: string, evidence: HandoffEvidence[], actor: Actor): AgentHandoff { return this.#transition(id, "accepted", "completed", "handoff.completed", actor, evidence); }

  #transition(id: string, from: HandoffStatus, to: HandoffStatus, type: CrewEventType, actor: Actor, evidence: HandoffEvidence[] = []): AgentHandoff {
    let handoff!: AgentHandoff;
    let event!: CrewEvent;
    this.database.transaction(() => {
      handoff = this.handoffs.transition(id, from, to, evidence);
      event = this.#record(type, handoff, actor);
    });
    this.bus.publish(event);
    return handoff;
  }

  #record(type: CrewEventType, handoff: AgentHandoff, actor: Actor): CrewEvent {
    const event = createCrewEvent({ type, projectId: handoff.projectId, actor, payload: handoff, correlationId: handoff.taskId, causationId: handoff.id });
    this.events.append(event);
    this.audit.append({ projectId: handoff.projectId, actorId: actor.id, actorType: actor.type, action: type, target: handoff.id, metadata: { taskId: handoff.taskId, fromAgentId: handoff.fromAgentId, toAgentId: handoff.toAgentId, status: handoff.status, evidenceCount: handoff.evidence.length }, createdAt: event.createdAt });
    return event;
  }
}
