import type { CrewEvent, CrewEventDraft } from "./events.ts";
import { createCrewEvent } from "./events.ts";

export const AGENT_STATUSES = [
  "offline",
  "idle",
  "queued",
  "thinking",
  "working",
  "waiting",
  "blocked",
  "needs_approval",
  "completed",
  "error",
  "stale",
] as const;

export type AgentStatus = (typeof AGENT_STATUSES)[number];

const transitions: Record<AgentStatus, ReadonlySet<AgentStatus>> = {
  offline: new Set(["idle", "queued"]),
  idle: new Set(["offline", "queued", "thinking", "stale"]),
  queued: new Set(["idle", "thinking", "working", "blocked", "error", "stale"]),
  thinking: new Set(["working", "waiting", "blocked", "needs_approval", "completed", "error", "stale"]),
  working: new Set(["thinking", "waiting", "blocked", "needs_approval", "completed", "error", "stale"]),
  waiting: new Set(["queued", "thinking", "working", "blocked", "needs_approval", "error", "stale"]),
  blocked: new Set(["queued", "thinking", "working", "needs_approval", "error", "stale"]),
  needs_approval: new Set(["queued", "working", "blocked", "completed", "error", "stale"]),
  completed: new Set(["idle", "queued", "offline"]),
  error: new Set(["idle", "queued", "offline"]),
  stale: new Set(["idle", "queued", "offline", "error"]),
};

export interface AgentStatusChange {
  agentId: string;
  from: AgentStatus;
  to: AgentStatus;
  reason?: string;
  taskId?: string;
}

export class InvalidAgentStatusTransitionError extends Error {
  constructor(from: AgentStatus, to: AgentStatus) {
    super(`Invalid agent status transition: ${from} -> ${to}`);
    this.name = "InvalidAgentStatusTransitionError";
  }
}

export function canTransitionAgentStatus(from: AgentStatus, to: AgentStatus): boolean {
  return from === to || transitions[from].has(to);
}

export class AgentStatusMachine {
  readonly #status = new Map<string, AgentStatus>();
  readonly #emit: (event: CrewEvent<AgentStatusChange>) => void;

  constructor(emit: (event: CrewEvent<AgentStatusChange>) => void = () => undefined) {
    this.#emit = emit;
  }

  get(agentId: string): AgentStatus {
    return this.#status.get(agentId) ?? "offline";
  }

  restore(agentId: string, status: AgentStatus): void {
    this.#status.set(agentId, status);
  }

  transition(input: {
    agentId: string;
    projectId: string;
    to: AgentStatus;
    actor: CrewEventDraft<AgentStatusChange>["actor"];
    reason?: string;
    taskId?: string;
    correlationId?: string;
    causationId?: string;
  }): CrewEvent<AgentStatusChange> | null {
    const from = this.get(input.agentId);
    if (from === input.to) return null;
    if (!canTransitionAgentStatus(from, input.to)) throw new InvalidAgentStatusTransitionError(from, input.to);
    const payload: AgentStatusChange = { agentId: input.agentId, from, to: input.to };
    if (input.reason) payload.reason = input.reason;
    if (input.taskId) payload.taskId = input.taskId;
    const event = createCrewEvent({
      type: "agent.status_changed",
      projectId: input.projectId,
      actor: input.actor,
      payload,
      correlationId: input.correlationId,
      causationId: input.causationId,
    });
    this.#status.set(input.agentId, input.to);
    this.#emit(event);
    return event;
  }
}
