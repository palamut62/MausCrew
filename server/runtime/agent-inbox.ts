import { randomUUID } from "node:crypto";

export const INBOX_PRIORITIES = ["critical", "high", "normal", "low"] as const;
export type InboxPriority = (typeof INBOX_PRIORITIES)[number];
export type InboxItemKind = "task" | "handoff" | "message" | "review" | "system_event";
export type InboxItemState = "queued" | "claimed" | "completed" | "dead_letter";

export interface AgentInboxItem<T = unknown> {
  id: string;
  sequence?: number;
  projectId: string;
  agentId: string;
  kind: InboxItemKind;
  priority: InboxPriority;
  payload: T;
  sourceEventId?: string;
  state: InboxItemState;
  attempts: number;
  availableAt: string;
  createdAt: string;
  claimedAt?: string;
  completedAt?: string;
  error?: string;
}

export type AgentInboxDraft<T = unknown> = Pick<AgentInboxItem<T>, "projectId" | "agentId" | "kind" | "priority" | "payload"> & {
  id?: string;
  sourceEventId?: string;
  availableAt?: string;
  createdAt?: string;
};

export function createInboxItem<T>(draft: AgentInboxDraft<T>): AgentInboxItem<T> {
  if (!draft.projectId.trim() || !draft.agentId.trim()) throw new Error("Inbox projectId and agentId are required");
  const createdAt = draft.createdAt ?? new Date().toISOString();
  return {
    id: draft.id ?? randomUUID(),
    projectId: draft.projectId.trim(),
    agentId: draft.agentId.trim(),
    kind: draft.kind,
    priority: draft.priority,
    payload: structuredClone(draft.payload),
    ...(draft.sourceEventId ? { sourceEventId: draft.sourceEventId } : {}),
    state: "queued",
    attempts: 0,
    availableAt: draft.availableAt ?? createdAt,
    createdAt,
  };
}
