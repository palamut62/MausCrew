import type { AgentStatus } from "../crew-core/status-machine.ts";
import type { AgentIdentityStore } from "../storage/agent-identity-store.ts";
import type { AgentInboxStore } from "../storage/agent-inbox-store.ts";
import type { AgentSessionStore } from "../storage/agent-session-store.ts";
import type { CrewEventStore } from "../storage/event-store.ts";
import type { ToolCallStore } from "../storage/tool-call-store.ts";

export interface AgentInspection {
  identity: { id: string; name: string; role: string; avatar?: string; createdAt: string };
  status: AgentStatus; currentTaskId?: string; model?: { provider: string; name: string };
  tools: string[]; permissions: Record<string, unknown>; session?: { id: string; startedAt: string; endedAt?: string; durationMs: number };
  memory: Record<string, unknown>; lastHeartbeatAt?: string; currentTool?: string; lastEvent?: { id: string; type: string; createdAt: string };
  queueLength: number; tokenUsage: null; cost: null;
}

export class AgentInspector {
  constructor(readonly identities: AgentIdentityStore, readonly sessions: AgentSessionStore, readonly inbox: AgentInboxStore, readonly events: CrewEventStore, readonly tools: ToolCallStore) {}
  get(projectId: string, agentId: string, now = Date.now()): AgentInspection | null {
    const identity = this.identities.get(agentId); if (!identity) return null;
    const session = this.sessions.latestForAgent(agentId);
    if (session && session.projectId !== projectId) return null;
    const activeTool = this.tools.activeForAgent(agentId);
    const recent = this.events.recent({ projectId, limit: 100 }).filter(({ event }) => event.actor.id === agentId || (event.payload && typeof event.payload === "object" && "agentId" in event.payload && event.payload.agentId === agentId));
    const last = recent.at(-1)?.event;
    return {
      identity: { id: identity.id, name: identity.name, role: identity.role, ...(identity.avatar ? { avatar: identity.avatar } : {}), createdAt: identity.createdAt },
      status: identity.status, ...(session?.currentTaskId ? { currentTaskId: session.currentTaskId } : {}),
      ...(session ? { model: { provider: session.provider, name: session.model }, tools: session.tools, permissions: session.permissions, memory: session.memory, lastHeartbeatAt: session.lastHeartbeatAt, session: { id: session.id, startedAt: session.startedAt, ...(session.endedAt ? { endedAt: session.endedAt } : {}), durationMs: Math.max(0, (session.endedAt ? Date.parse(session.endedAt) : now) - Date.parse(session.startedAt)) } } : { tools: [], permissions: {}, memory: {} }),
      ...(activeTool ? { currentTool: activeTool.tool } : {}),
      ...(last ? { lastEvent: { id: last.id, type: last.type, createdAt: last.createdAt } } : {}),
      queueLength: this.inbox.queueLength(agentId), tokenUsage: null, cost: null,
    };
  }
}
