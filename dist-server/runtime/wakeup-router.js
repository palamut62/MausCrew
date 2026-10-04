const ROUTED_TYPES = ["task.assigned", "handoff.created", "review.requested", "message.mentioned", "approval.approved", "dependency.completed"];
const routing = {
    "task.assigned": { field: "agentId", kind: "task", priority: "high" },
    "handoff.created": { field: "toAgentId", kind: "handoff", priority: "high" },
    "review.requested": { field: "reviewerAgentId", kind: "review", priority: "high" },
    "message.mentioned": { field: "mentionedAgentId", kind: "message", priority: "normal" },
    "approval.approved": { field: "agentId", kind: "system_event", priority: "critical" },
    "dependency.completed": { field: "agentId", kind: "system_event", priority: "normal" },
};
export class AgentWakeupRouter {
    bus;
    inbox;
    wake;
    #unsubscribe = null;
    constructor(bus, inbox, wake) {
        this.bus = bus;
        this.inbox = inbox;
        this.wake = wake;
    }
    start() {
        if (this.#unsubscribe)
            return;
        this.#unsubscribe = this.bus.subscribe("agent-wakeup-router", (event) => this.#route(event), ROUTED_TYPES);
    }
    stop() {
        this.#unsubscribe?.();
        this.#unsubscribe = null;
    }
    async #route(event) {
        const route = routing[event.type];
        if (!route || !event.payload || typeof event.payload !== "object")
            return;
        const agentId = event.payload[route.field];
        if (typeof agentId !== "string" || !agentId.trim())
            return;
        const result = this.inbox.enqueue({
            projectId: event.projectId,
            agentId,
            kind: route.kind,
            priority: route.priority,
            payload: event.payload,
            sourceEventId: event.id,
            createdAt: event.createdAt,
        });
        if (result.accepted)
            await this.wake(agentId, event.type);
    }
}
