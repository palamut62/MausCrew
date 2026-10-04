import type { EffortLevel, RuntimeEvent, RuntimeEventListener } from "../contracts.ts";

export type AgentProviderSessionStatus = "idle" | "working" | "cancelled" | "closed" | "error";
export interface AgentProviderSession {
  id: string;
  agentId: string;
  provider: string;
  model: string;
  cwd: string;
  status: AgentProviderSessionStatus;
  currentTurnId?: string;
  resumeCursor?: unknown;
  createdAt: string;
}
export interface StartAgentSessionInput { id: string; agentId: string; model: string; cwd: string; system?: string; effort?: EffortLevel }
export interface AgentMessage { text: string; transcript?: Array<{ role: "user" | "assistant"; text: string }> }
export interface AgentProvider {
  readonly kind: string;
  startSession(input: StartAgentSessionInput): Promise<AgentProviderSession>;
  send(sessionId: string, message: AgentMessage): Promise<{ turnId: string }>;
  cancel(sessionId: string): Promise<void>;
  closeSession(sessionId: string): Promise<void>;
  getSession(sessionId: string): AgentProviderSession | undefined;
  onEvent(listener: RuntimeEventListener): () => void;
  dispose(): Promise<void>;
}

export type AgentProviderEvent = RuntimeEvent;
