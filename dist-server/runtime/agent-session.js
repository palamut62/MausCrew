import { randomUUID } from "node:crypto";
export function createAgentSession(input) {
    if (!input.projectId.trim() || !input.agentId.trim())
        throw new Error("Session projectId and agentId are required");
    if (!input.provider.trim() || !input.model.trim())
        throw new Error("Session provider and model are required");
    const startedAt = input.startedAt ?? new Date().toISOString();
    if (!Number.isFinite(Date.parse(startedAt)))
        throw new Error("Session startedAt must be an ISO timestamp");
    return {
        ...input,
        id: input.id ?? randomUUID(),
        projectId: input.projectId.trim(),
        agentId: input.agentId.trim(),
        provider: input.provider.trim(),
        model: input.model.trim(),
        tools: [...input.tools],
        context: structuredClone(input.context),
        memory: structuredClone(input.memory),
        permissions: structuredClone(input.permissions),
        startedAt,
        lastHeartbeatAt: startedAt,
    };
}
