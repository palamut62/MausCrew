import type { ProviderInstance, RuntimeEvent, RuntimeEventListener } from "../contracts.ts";
import type { AgentMessage, AgentProvider, AgentProviderSession, StartAgentSessionInput } from "./agent-provider.ts";

export class ProviderInstanceAgentAdapter implements AgentProvider {
  readonly kind: string;
  readonly #sessions = new Map<string, AgentProviderSession & { system?: string; effort?: StartAgentSessionInput["effort"] }>();
  readonly #listeners = new Set<RuntimeEventListener>();
  readonly #unsubscribe: () => void;

  constructor(readonly instance: ProviderInstance, expectedKinds?: readonly string[]) {
    if (expectedKinds?.length && !expectedKinds.includes(instance.driverKind)) throw new Error(`Provider ${instance.driverKind} is incompatible with this adapter`);
    this.kind = instance.driverKind;
    this.#unsubscribe = instance.adapter.onEvent((event) => this.#handle(event));
  }

  async startSession(input: StartAgentSessionInput): Promise<AgentProviderSession> {
    if (this.#sessions.has(input.id)) throw new Error(`Agent provider session already exists: ${input.id}`);
    const snapshot = await this.instance.snapshot();
    if (snapshot.state !== "available") throw new Error(snapshot.reason ?? `Provider ${this.kind} is unavailable`);
    if (snapshot.authenticated === false) throw new Error(snapshot.reason ?? `Provider ${this.kind} is not authenticated`);
    const session = { id: input.id, agentId: input.agentId, provider: this.kind, model: input.model, cwd: input.cwd, status: "idle" as const, ...(input.system ? { system: input.system } : {}), ...(input.effort ? { effort: input.effort } : {}), createdAt: new Date().toISOString() };
    this.#sessions.set(input.id, session);
    return this.#public(session);
  }

  async send(sessionId: string, message: AgentMessage): Promise<{ turnId: string }> {
    const session = this.#required(sessionId);
    if (session.status === "working") throw new Error(`Agent provider session is busy: ${sessionId}`);
    if (session.status === "closed") throw new Error(`Agent provider session is closed: ${sessionId}`);
    session.status = "working";
    try {
      const result = await this.instance.adapter.sendTurn({ threadId: session.id, text: message.text, model: session.model, cwd: session.cwd, ...(session.effort ? { effort: session.effort } : {}), ...(session.system ? { system: session.system } : {}), ...(session.resumeCursor !== undefined ? { resumeCursor: session.resumeCursor } : {}), ...(message.transcript ? { transcript: message.transcript } : {}) });
      if (session.status === "working") session.currentTurnId = result.turnId;
      return result;
    } catch (error) { session.status = "error"; throw error; }
  }

  async cancel(sessionId: string): Promise<void> {
    const session = this.#required(sessionId);
    if (session.status !== "working") return;
    await this.instance.adapter.interruptTurn(session.id, session.currentTurnId);
    session.status = "cancelled";
    delete session.currentTurnId;
  }

  async closeSession(sessionId: string): Promise<void> {
    const session = this.#required(sessionId);
    if (session.status === "working") await this.cancel(sessionId);
    session.status = "closed";
  }

  getSession(sessionId: string): AgentProviderSession | undefined { const session = this.#sessions.get(sessionId); return session ? this.#public(session) : undefined; }
  onEvent(listener: RuntimeEventListener): () => void { this.#listeners.add(listener); return () => this.#listeners.delete(listener); }
  async dispose(): Promise<void> { this.#unsubscribe(); await this.instance.dispose(); this.#sessions.clear(); this.#listeners.clear(); }

  #handle(event: RuntimeEvent): void {
    const session = this.#sessions.get(event.threadId);
    if (!session) return;
    if (event.type === "session.started" && event.sessionId) session.resumeCursor = event.sessionId;
    if (event.type === "turn.completed") { if (session.status !== "cancelled") session.status = event.ok ? "idle" : "error"; delete session.currentTurnId; }
    if (event.type === "session.exited" && session.status !== "cancelled") session.status = "closed";
    if (event.type === "runtime.error") session.status = "error";
    for (const listener of [...this.#listeners]) listener(event);
  }

  #required(id: string) { const session = this.#sessions.get(id); if (!session) throw new Error(`Unknown agent provider session: ${id}`); return session; }
  #public(session: AgentProviderSession): AgentProviderSession { return structuredClone(session); }
}
