export class AgentInspector {
    identities;
    sessions;
    inbox;
    events;
    tools;
    constructor(identities, sessions, inbox, events, tools) {
        this.identities = identities;
        this.sessions = sessions;
        this.inbox = inbox;
        this.events = events;
        this.tools = tools;
    }
    get(projectId, agentId, now = Date.now()) {
        const identity = this.identities.get(agentId);
        if (!identity)
            return null;
        const session = this.sessions.latestForAgent(agentId);
        if (session && session.projectId !== projectId)
            return null;
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
