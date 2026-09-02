import { randomUUID } from "node:crypto";
import { looksDestructive, looksSensitive } from "../auto-approve.js";
export const actionCategories = [
    "shell",
    "filesystem",
    "browser",
    "computer",
    "mcp",
    "composio",
    "network",
    "agent",
    "other",
];
const SHELL_TOOLS = new Set(["bash", "shell", "execute", "run_command", "computer_exec", "terminal"]);
const READ_FILE_TOOLS = new Set(["read", "read_file", "list_files", "glob", "grep"]);
const WRITE_FILE_TOOLS = new Set(["write", "edit", "write_file", "apply_patch", "delete_file", "move_file"]);
function bareTool(tool) {
    return tool.replace(/^mcp__[^_]+__/, "").toLowerCase();
}
function categoryFor(tool) {
    const bare = bareTool(tool);
    if (SHELL_TOOLS.has(bare))
        return "shell";
    if (READ_FILE_TOOLS.has(bare) || WRITE_FILE_TOOLS.has(bare) || /file|directory|folder/.test(bare))
        return "filesystem";
    if (/computer|screenshot|click|type_text|press_key|scroll/.test(bare))
        return "computer";
    if (/webfetch|web[_-]?search|browser|navigate|open_url/.test(bare))
        return "browser";
    if (/fetch|http|network|download|upload/.test(bare))
        return "network";
    if (/ask_bot|delegate_bot|agent|handoff/.test(bare))
        return "agent";
    if (/composio/.test(tool.toLowerCase()))
        return "composio";
    if (tool.startsWith("mcp__"))
        return "mcp";
    return "other";
}
function intentFor(tool, category) {
    const bare = bareTool(tool);
    if (READ_FILE_TOOLS.has(bare) || /read|list|search|get|status|screenshot/.test(bare))
        return "read";
    if (WRITE_FILE_TOOLS.has(bare) || /write|edit|delete|remove|create|update|post|send|push|upload/.test(bare))
        return "write";
    if (category === "shell")
        return "execute";
    if (category === "browser" || /navigate|open_url/.test(bare))
        return "navigate";
    if (category === "agent")
        return "communicate";
    return "unknown";
}
function externalWriteFor(category, intent, summary) {
    if (/\bgit\s+push\b|\bgh\s+(pr\s+merge|release\s+create|release\s+upload)\b|\b(curl|wget)\b[^\n]*(--request|-X)\s*(POST|PUT|PATCH|DELETE)\b/i.test(summary))
        return true;
    return intent === "write" && ["browser", "network", "mcp", "composio", "agent"].includes(category);
}
export function normalizePermissionAction(input) {
    const category = categoryFor(input.tool);
    const intent = intentFor(input.tool, category);
    const externalWrite = externalWriteFor(category, intent, input.summary);
    const destructive = looksDestructive(input.summary) || looksDestructive(input.tool);
    const sensitive = looksSensitive(input.summary) || looksSensitive(input.tool);
    return {
        id: input.requestId || randomUUID(),
        timestamp: new Date().toISOString(),
        actor: { type: "agent", id: input.botId },
        agent: { id: input.botId, engine: input.engine },
        ...(input.threadId ? { threadId: input.threadId } : {}),
        tool: { name: input.tool, category },
        intent,
        target: {
            ...(category === "shell" ? { command: input.summary } : {}),
            ...(category === "filesystem" ? { path: input.summary } : {}),
            ...(["mcp", "composio"].includes(category) ? { tool: input.tool } : {}),
        },
        // Only destructive reaches "high". Credential access is medium and
        // carries `sensitive`, so a policy can hold it at an approval card
        // instead of refusing it.
        risk: destructive ? "high" : sensitive || externalWrite || intent === "write" || intent === "execute" ? "medium" : "low",
        sensitive,
        externalWrite,
        metadata: { summary: input.summary, ...(input.raw === undefined ? {} : { raw: input.raw }) },
    };
}
