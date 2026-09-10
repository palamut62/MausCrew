export type WorkflowRunStatus = "queued" | "running" | "waiting_approval" | "completed" | "failed" | "cancelled";
export type WorkflowRunStepStatus = "pending" | "ready" | "running" | "waiting_approval" | "completed" | "failed" | "cancelled";
export interface WorkflowRun { id: string; definitionId: string; projectId: string; ownerAgentId: string; status: WorkflowRunStatus; error?: string; createdAt: string; updatedAt: string; completedAt?: string }
export interface WorkflowRunStep { id: string; runId: string; key: string; kind: "agent" | "approval"; agentRole?: string; task?: string; status: WorkflowRunStepStatus; dependsOn: string[]; approvalId?: string; output?: unknown; error?: string; createdAt: string; updatedAt: string }
