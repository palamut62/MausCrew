import { randomUUID } from "node:crypto";
function requiredText(value, field, max) {
    const clean = value.trim();
    if (!clean)
        throw new Error(`${field} is required`);
    if (clean.length > max)
        throw new Error(`${field} must be at most ${max} characters`);
    return clean;
}
export function createAgentIdentity(input) {
    const identity = {
        id: requiredText(input.id ?? randomUUID(), "Agent id", 128),
        name: requiredText(input.name, "Agent name", 120),
        role: requiredText(input.role, "Agent role", 240),
        createdAt: input.createdAt ?? new Date().toISOString(),
    };
    if (input.avatar?.trim())
        identity.avatar = input.avatar.trim();
    if (!Number.isFinite(Date.parse(identity.createdAt)))
        throw new Error("Agent createdAt must be an ISO timestamp");
    return identity;
}
