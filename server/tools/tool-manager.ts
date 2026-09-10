import { randomUUID } from "node:crypto";

import { looksDestructive } from "../auto-approve.ts";
import type { SqliteAuditStore } from "../audit/sqlite-audit-store.ts";
import type { CrewEventBus } from "../crew-core/event-bus.ts";
import { createCrewEvent } from "../crew-core/events.ts";
import type { CrewDatabase } from "../storage/crew-database.ts";
import type { CrewEventStore } from "../storage/event-store.ts";
import type { ToolCallStore } from "../storage/tool-call-store.ts";
import type { ApprovalService } from "./approval-service.ts";
import type { ToolContext, ToolExecutionResult, ToolHandler, ToolPermissionProfile } from "./tool-types.ts";

export class ToolManager {
  readonly #tools = new Map<string, ToolHandler>();
  constructor(readonly database: CrewDatabase, readonly calls: ToolCallStore, readonly events: CrewEventStore, readonly audit: SqliteAuditStore, readonly bus: CrewEventBus, readonly approvals: ApprovalService, handlers: ToolHandler[]) {
    for (const handler of handlers) { if (this.#tools.has(handler.name)) throw new Error(`Duplicate tool: ${handler.name}`); this.#tools.set(handler.name, handler); }
  }

  list(): string[] { return [...this.#tools.keys()].sort(); }

  async execute(input: { tool: string; arguments: Record<string, unknown>; context: ToolContext; permissions: ToolPermissionProfile; approvalId?: string }): Promise<ToolExecutionResult> {
    const handler = this.#tools.get(input.tool); if (!handler) throw new Error(`Unknown tool: ${input.tool}`);
    const category = input.tool.split(".", 1)[0];
    const permission = input.permissions.tools?.[input.tool] ?? input.permissions.categories?.[category] ?? input.permissions.default;
    if (permission === "deny") { this.#auditDenial(input, "permission_denied"); throw new Error(`Tool denied by permission profile: ${input.tool}`); }
    const destructive = input.tool === "shell.execute" && looksDestructive(String(input.arguments.command ?? ""));
    if (destructive) { this.#auditDenial(input, "destructive_command_denied"); throw new Error("Destructive shell command denied at tool boundary"); }
    if (permission === "ask" && !input.approvalId) {
      const approval = this.approvals.request({ projectId: input.context.projectId, agentId: input.context.agentId, sessionId: input.context.sessionId, taskId: input.context.taskId, action: input.tool, arguments: input.arguments, reason: "Permission profile requires human approval" });
      return { status: "needs_approval", approvalId: approval.id };
    }
    if (permission === "ask") this.approvals.consumeApproved(input.approvalId!, { projectId: input.context.projectId, agentId: input.context.agentId, action: input.tool, arguments: input.arguments });
    if (input.context.cancellation?.signal.aborted) throw new Error("Tool execution cancelled");

    const id = randomUUID(); const startedAt = new Date().toISOString();
    const started = createCrewEvent({ type: "tool.started", projectId: input.context.projectId, actor: { type: "agent", id: input.context.agentId }, payload: { toolCallId: id, tool: input.tool, taskId: input.context.taskId, sessionId: input.context.sessionId }, correlationId: input.context.taskId ?? id });
    this.database.transaction(() => { this.calls.start({ id, projectId: input.context.projectId, agentId: input.context.agentId, sessionId: input.context.sessionId, taskId: input.context.taskId, tool: input.tool, arguments: input.arguments, startedAt }); this.events.append(started); this.#appendAudit(input, "tool.started", id, { tool: input.tool }); }); this.bus.publish(started);
    try {
      const value = await handler.execute(structuredClone(input.arguments), input.context);
      this.#finish(input, id, "completed", value); return { status: "completed", value };
    } catch (error) {
      const cancelled = input.context.cancellation?.signal.aborted ?? false;
      this.#finish(input, id, cancelled ? "cancelled" : "failed", undefined, error instanceof Error ? error.message : String(error)); throw error;
    }
  }

  #finish(input: Parameters<ToolManager["execute"]>[0], id: string, status: "completed" | "failed" | "cancelled", result?: unknown, error?: string): void {
    const endedAt = new Date().toISOString(); const type = status === "completed" ? "tool.completed" : "tool.failed";
    const event = createCrewEvent({ type, projectId: input.context.projectId, actor: { type: "agent", id: input.context.agentId }, payload: { toolCallId: id, tool: input.tool, status, ...(error ? { error } : {}) }, correlationId: input.context.taskId ?? id, causationId: id });
    this.database.transaction(() => { this.calls.finish(id, status, { result, error, endedAt }); this.events.append(event); this.#appendAudit(input, type, id, { tool: input.tool, status, ...(error ? { error } : {}) }); }); this.bus.publish(event);
  }

  #auditDenial(input: Parameters<ToolManager["execute"]>[0], reason: string): void { this.#appendAudit(input, "permission.denied", input.tool, { tool: input.tool, reason }); }
  #appendAudit(input: Parameters<ToolManager["execute"]>[0], action: string, target: string, metadata: Record<string, unknown>): void { this.audit.append({ projectId: input.context.projectId, actorId: input.context.agentId, actorType: "agent", action, target, metadata: { ...metadata, taskId: input.context.taskId, sessionId: input.context.sessionId } }); }
}
