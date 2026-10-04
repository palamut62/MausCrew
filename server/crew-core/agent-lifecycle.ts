import type { SqliteAuditStore } from "../audit/sqlite-audit-store.ts";
import type { AgentIdentityStore } from "../storage/agent-identity-store.ts";
import type { CrewDatabase } from "../storage/crew-database.ts";
import type { CrewEventStore } from "../storage/event-store.ts";
import type { CrewEventBus } from "./event-bus.ts";
import type { AgentIdentity } from "./identity.ts";
import type { AgentStatus } from "./status-machine.ts";
import { InvalidAgentStatusTransitionError, canTransitionAgentStatus } from "./status-machine.ts";
import { createCrewEvent } from "./events.ts";

export class AgentLifecycleService {
  constructor(
    readonly database: CrewDatabase,
    readonly identities: AgentIdentityStore,
    readonly events: CrewEventStore,
    readonly audit: SqliteAuditStore,
    readonly bus: CrewEventBus,
  ) {}

  create(projectId: string, identity: AgentIdentity, actor: { type: "human" | "agent" | "system"; id: string }): void {
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

  transition(input: {
    projectId: string;
    agentId: string;
    to: AgentStatus;
    actor: { type: "human" | "agent" | "system"; id: string };
    reason?: string;
    taskId?: string;
    correlationId?: string;
    causationId?: string;
    mutation?: () => void;
  }): AgentStatus {
    const identity = this.identities.get(input.agentId);
    if (!identity) throw new Error(`Unknown agent: ${input.agentId}`);
    if (identity.status === input.to) return identity.status;
    if (!canTransitionAgentStatus(identity.status, input.to)) throw new InvalidAgentStatusTransitionError(identity.status, input.to);
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
      if (!this.identities.setStatus(input.agentId, input.to, event.createdAt)) throw new Error(`Unknown agent: ${input.agentId}`);
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
