import type { CrewEventBus } from "../crew-core/event-bus.ts";
import type { CrewEvent, CrewEventType } from "../crew-core/events.ts";
import type { AgentInboxStore } from "../storage/agent-inbox-store.ts";
import type { InboxItemKind, InboxPriority } from "./agent-inbox.ts";

const ROUTED_TYPES = ["task.assigned", "handoff.created", "review.requested", "message.mentioned", "approval.approved", "dependency.completed"] as const satisfies readonly CrewEventType[];

type RoutedType = (typeof ROUTED_TYPES)[number];

const routing: Record<RoutedType, { field: string; kind: InboxItemKind; priority: InboxPriority }> = {
  "task.assigned": { field: "agentId", kind: "task", priority: "high" },
  "handoff.created": { field: "toAgentId", kind: "handoff", priority: "high" },
  "review.requested": { field: "reviewerAgentId", kind: "review", priority: "high" },
  "message.mentioned": { field: "mentionedAgentId", kind: "message", priority: "normal" },
  "approval.approved": { field: "agentId", kind: "system_event", priority: "critical" },
  "dependency.completed": { field: "agentId", kind: "system_event", priority: "normal" },
};

export class AgentWakeupRouter {
  #unsubscribe: (() => void) | null = null;

  constructor(
    readonly bus: CrewEventBus,
    readonly inbox: AgentInboxStore,
    readonly wake: (agentId: string, reason: RoutedType) => void | Promise<void>,
  ) {}

  start(): void {
    if (this.#unsubscribe) return;
    this.#unsubscribe = this.bus.subscribe("agent-wakeup-router", (event) => this.#route(event), ROUTED_TYPES);
  }

  stop(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
  }

  async #route(event: CrewEvent): Promise<void> {
    const route = routing[event.type as RoutedType];
    if (!route || !event.payload || typeof event.payload !== "object") return;
    const agentId = (event.payload as Record<string, unknown>)[route.field];
    if (typeof agentId !== "string" || !agentId.trim()) return;
    const result = this.inbox.enqueue({
      projectId: event.projectId,
      agentId,
      kind: route.kind,
      priority: route.priority,
      payload: event.payload,
      sourceEventId: event.id,
      createdAt: event.createdAt,
    });
    if (result.accepted) await this.wake(agentId, event.type as RoutedType);
  }
}
