import type { CancellationScope } from "../runtime/cancellation.ts";

export type ToolPermission = "allow" | "ask" | "deny";
export type ToolPermissionProfile = { default: ToolPermission; categories?: Record<string, ToolPermission>; tools?: Record<string, ToolPermission> };
export interface ToolContext { projectId: string; projectRoot: string; agentId: string; sessionId?: string; taskId?: string; cancellation?: CancellationScope }
export interface ToolHandler { name: string; execute(argumentsValue: Record<string, unknown>, context: ToolContext): Promise<unknown> }
export type ToolExecutionResult = { status: "completed"; value: unknown } | { status: "needs_approval"; approvalId: string };
