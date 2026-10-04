import type { AgentLifecycleService } from "../crew-core/agent-lifecycle.ts";
import type { AgentSessionStore } from "../storage/agent-session-store.ts";
import { createAgentSession, type AgentSession, type StartAgentSessionInput } from "./agent-session.ts";
import { CancellationScope } from "./cancellation.ts";
import type { AgentHeartbeatService } from "./heartbeat.ts";
import { createCrewEvent } from "../crew-core/events.ts";

export class AgentRuntimeSession {
  readonly session: AgentSession;
  readonly cancellation = new CancellationScope();
  #timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    input: StartAgentSessionInput,
    readonly sessions: AgentSessionStore,
    readonly lifecycle: AgentLifecycleService,
    readonly heartbeats: AgentHeartbeatService,
    readonly heartbeatIntervalMs = 10_000,
  ) {
    if (heartbeatIntervalMs < 10) throw new Error("heartbeatIntervalMs must be at least 10ms");
    this.session = createAgentSession(input);
  }

  start(): void {
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

  stop(reason = "stopped"): void {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = null;
    this.cancellation.cancel(new Error(reason));
    if (this.sessions.get(this.session.id)?.endedAt) return;
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
          if (!this.sessions.end(this.session.id, reason, event.createdAt)) throw new Error("Agent session is not active");
          this.lifecycle.events.append(event);
          this.lifecycle.audit.append({ projectId: this.session.projectId, actorId: "agent-runtime", actorType: "system", action: "agent.stopped", target: this.session.agentId, metadata: { sessionId: this.session.id, reason }, createdAt: event.createdAt });
        },
      });
      this.lifecycle.bus.publish(event);
    }
  }
}
