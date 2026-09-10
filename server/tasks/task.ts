import { randomUUID } from "node:crypto";

import type { InboxPriority } from "../runtime/agent-inbox.ts";

export const TASK_STATUSES = ["pending", "ready", "assigned", "running", "blocked", "completed", "failed", "cancelled"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface CrewTask {
  id: string;
  projectId: string;
  title: string;
  description: string;
  role: string;
  status: TaskStatus;
  priority: InboxPriority;
  assigneeAgentId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface TaskDraft {
  id?: string;
  projectId: string;
  title: string;
  description?: string;
  role: string;
  priority?: InboxPriority;
  createdBy: string;
  createdAt?: string;
}

export function createTask(draft: TaskDraft): CrewTask {
  if (!draft.projectId.trim() || !draft.title.trim() || !draft.role.trim() || !draft.createdBy.trim()) {
    throw new Error("Task projectId, title, role and createdBy are required");
  }
  const createdAt = draft.createdAt ?? new Date().toISOString();
  return {
    id: draft.id ?? randomUUID(),
    projectId: draft.projectId.trim(),
    title: draft.title.trim(),
    description: draft.description?.trim() ?? "",
    role: draft.role.trim(),
    status: "pending",
    priority: draft.priority ?? "normal",
    createdBy: draft.createdBy.trim(),
    createdAt,
    updatedAt: createdAt,
  };
}
