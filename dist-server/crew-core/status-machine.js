import { createCrewEvent } from "./events.js";
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
];
const transitions = {
    offline: new Set(["idle", "queued"]),
    idle: new Set(["offline", "queued", "thinking", "stale"]),
    queued: new Set(["offline", "idle", "thinking", "working", "blocked", "error", "stale"]),
    thinking: new Set(["offline", "working", "waiting", "blocked", "needs_approval", "completed", "error", "stale"]),
    working: new Set(["offline", "thinking", "waiting", "blocked", "needs_approval", "completed", "error", "stale"]),
    waiting: new Set(["offline", "queued", "thinking", "working", "blocked", "needs_approval", "error", "stale"]),
    blocked: new Set(["offline", "queued", "thinking", "working", "needs_approval", "error", "stale"]),
    needs_approval: new Set(["offline", "queued", "working", "blocked", "completed", "error", "stale"]),
    completed: new Set(["idle", "queued", "offline"]),
    error: new Set(["idle", "queued", "offline"]),
    stale: new Set(["idle", "queued", "offline", "error"]),
};
export class InvalidAgentStatusTransitionError extends Error {
    constructor(from, to) {
        super(`Invalid agent status transition: ${from} -> ${to}`);
        this.name = "InvalidAgentStatusTransitionError";
    }
}
export function canTransitionAgentStatus(from, to) {
    return from === to || transitions[from].has(to);
}
export class AgentStatusMachine {
    #status = new Map();
    #emit;
    constructor(emit = () => undefined) {
        this.#emit = emit;
    }
    get(agentId) {
        return this.#status.get(agentId) ?? "offline";
    }
    restore(agentId, status) {
        this.#status.set(agentId, status);
    }
    transition(input) {
        const from = this.get(input.agentId);
        if (from === input.to)
            return null;
        if (!canTransitionAgentStatus(from, input.to))
            throw new InvalidAgentStatusTransitionError(from, input.to);
        const payload = { agentId: input.agentId, from, to: input.to };
        if (input.reason)
            payload.reason = input.reason;
        if (input.taskId)
            payload.taskId = input.taskId;
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
