import { createAgentSession } from "./agent-session.js";
import { CancellationScope } from "./cancellation.js";
import { createCrewEvent } from "../crew-core/events.js";
export class AgentRuntimeSession {
    sessions;
    lifecycle;
    heartbeats;
    heartbeatIntervalMs;
    session;
    cancellation = new CancellationScope();
    #timer = null;
    constructor(input, sessions, lifecycle, heartbeats, heartbeatIntervalMs = 10_000) {
        this.sessions = sessions;
        this.lifecycle = lifecycle;
        this.heartbeats = heartbeats;
        this.heartbeatIntervalMs = heartbeatIntervalMs;
        if (heartbeatIntervalMs < 10)
            throw new Error("heartbeatIntervalMs must be at least 10ms");
        this.session = createAgentSession(input);
    }
    start() {
        const event = createCrewEvent({
            type: "agent.started",
            projectId: this.session.projectId,
            actor: { type: "system", id: "agent-runtime" },
            payload: { agentId: this.session.agentId, sessionId: this.session.id, provider: this.session.provider, model: this.session.model },
            correlationId: this.session.id,
        });
        this.lifecycle.transition({
            projectId: this.session.projectId,
            agentId: this.session.agentId,
            to: "idle",
            actor: { type: "system", id: "agent-runtime" },
            correlationId: this.session.id,
            mutation: () => {
                this.sessions.start(this.session);
                this.lifecycle.events.append(event);
                this.lifecycle.audit.append({ projectId: this.session.projectId, actorId: "agent-runtime", actorType: "system", action: "agent.started", target: this.session.agentId, metadata: { sessionId: this.session.id, provider: this.session.provider, model: this.session.model }, createdAt: event.createdAt });
            },
        });
        this.lifecycle.bus.publish(event);
        this.heartbeats.record({ sessionId: this.session.id, agentId: this.session.agentId, status: "idle", taskId: this.session.currentTaskId });
        this.#timer = setInterval(() => {
            const status = this.lifecycle.identities.get(this.session.agentId)?.status ?? "error";
            this.heartbeats.record({ sessionId: this.session.id, agentId: this.session.agentId, status, taskId: this.session.currentTaskId });
        }, this.heartbeatIntervalMs);
        this.#timer.unref?.();
    }
    stop(reason = "stopped") {
        if (this.#timer)
            clearInterval(this.#timer);
        this.#timer = null;
        this.cancellation.cancel(new Error(reason));
        if (this.sessions.get(this.session.id)?.endedAt)
            return;
        const current = this.lifecycle.identities.get(this.session.agentId)?.status;
        if (current && current !== "offline") {
            const event = createCrewEvent({
                type: "agent.stopped",
                projectId: this.session.projectId,
                actor: { type: "system", id: "agent-runtime" },
                payload: { agentId: this.session.agentId, sessionId: this.session.id, reason },
                correlationId: this.session.id,
            });
            this.lifecycle.transition({
                projectId: this.session.projectId,
                agentId: this.session.agentId,
                to: "offline",
                actor: { type: "system", id: "agent-runtime" },
                reason,
                correlationId: this.session.id,
                mutation: () => {
                    if (!this.sessions.end(this.session.id, reason, event.createdAt))
                        throw new Error("Agent session is not active");
                    this.lifecycle.events.append(event);
                    this.lifecycle.audit.append({ projectId: this.session.projectId, actorId: "agent-runtime", actorType: "system", action: "agent.stopped", target: this.session.agentId, metadata: { sessionId: this.session.id, reason }, createdAt: event.createdAt });
                },
            });
            this.lifecycle.bus.publish(event);
        }
    }
}
