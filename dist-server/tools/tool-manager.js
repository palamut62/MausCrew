import { randomUUID } from "node:crypto";
import { looksDestructive } from "../auto-approve.js";
import { createCrewEvent } from "../crew-core/events.js";
export class ToolManager {
    database;
    calls;
    events;
    audit;
    bus;
    approvals;
    #tools = new Map();
    constructor(database, calls, events, audit, bus, approvals, handlers) {
        this.database = database;
        this.calls = calls;
        this.events = events;
        this.audit = audit;
        this.bus = bus;
        this.approvals = approvals;
        for (const handler of handlers) {
            if (this.#tools.has(handler.name))
                throw new Error(`Duplicate tool: ${handler.name}`);
            this.#tools.set(handler.name, handler);
        }
    }
    list() { return [...this.#tools.keys()].sort(); }
    async execute(input) {
        const handler = this.#tools.get(input.tool);
        if (!handler)
            throw new Error(`Unknown tool: ${input.tool}`);
        const category = input.tool.split(".", 1)[0];
        const permission = input.permissions.tools?.[input.tool] ?? input.permissions.categories?.[category] ?? input.permissions.default;
        if (permission === "deny") {
            this.#auditDenial(input, "permission_denied");
            throw new Error(`Tool denied by permission profile: ${input.tool}`);
        }
        const destructive = input.tool === "shell.execute" && looksDestructive(String(input.arguments.command ?? ""));
        if (destructive) {
            this.#auditDenial(input, "destructive_command_denied");
            throw new Error("Destructive shell command denied at tool boundary");
        }
        if (permission === "ask" && !input.approvalId) {
            const approval = this.approvals.request({ projectId: input.context.projectId, agentId: input.context.agentId, sessionId: input.context.sessionId, taskId: input.context.taskId, action: input.tool, arguments: input.arguments, reason: "Permission profile requires human approval" });
            return { status: "needs_approval", approvalId: approval.id };
        }
        if (permission === "ask")
            this.approvals.consumeApproved(input.approvalId, { projectId: input.context.projectId, agentId: input.context.agentId, action: input.tool, arguments: input.arguments });
        if (input.context.cancellation?.signal.aborted)
            throw new Error("Tool execution cancelled");
        const id = randomUUID();
        const startedAt = new Date().toISOString();
        const started = createCrewEvent({ type: "tool.started", projectId: input.context.projectId, actor: { type: "agent", id: input.context.agentId }, payload: { toolCallId: id, tool: input.tool, taskId: input.context.taskId, sessionId: input.context.sessionId }, correlationId: input.context.taskId ?? id });
        this.database.transaction(() => { this.calls.start({ id, projectId: input.context.projectId, agentId: input.context.agentId, sessionId: input.context.sessionId, taskId: input.context.taskId, tool: input.tool, arguments: input.arguments, startedAt }); this.events.append(started); this.#appendAudit(input, "tool.started", id, { tool: input.tool }); });
        this.bus.publish(started);
        try {
            const value = await handler.execute(structuredClone(input.arguments), input.context);
            this.#finish(input, id, "completed", value);
            return { status: "completed", value };
        }
        catch (error) {
            const cancelled = input.context.cancellation?.signal.aborted ?? false;
            this.#finish(input, id, cancelled ? "cancelled" : "failed", undefined, error instanceof Error ? error.message : String(error));
            throw error;
        }
    }
    #finish(input, id, status, result, error) {
        const endedAt = new Date().toISOString();
        const type = status === "completed" ? "tool.completed" : "tool.failed";
        const event = createCrewEvent({ type, projectId: input.context.projectId, actor: { type: "agent", id: input.context.agentId }, payload: { toolCallId: id, tool: input.tool, status, ...(error ? { error } : {}) }, correlationId: input.context.taskId ?? id, causationId: id });
        this.database.transaction(() => { this.calls.finish(id, status, { result, error, endedAt }); this.events.append(event); this.#appendAudit(input, type, id, { tool: input.tool, status, ...(error ? { error } : {}) }); });
        this.bus.publish(event);
    }
    #auditDenial(input, reason) { this.#appendAudit(input, "permission.denied", input.tool, { tool: input.tool, reason }); }
    #appendAudit(input, action, target, metadata) { this.audit.append({ projectId: input.context.projectId, actorId: input.context.agentId, actorType: "agent", action, target, metadata: { ...metadata, taskId: input.context.taskId, sessionId: input.context.sessionId } }); }
}
