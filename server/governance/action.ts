import { randomUUID } from "node:crypto";

import { looksDestructive, looksSensitive } from "../auto-approve.ts";

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
] as const;

export type ActionCategory = (typeof actionCategories)[number];
export type ActionRisk = "low" | "medium" | "high";

export type GovernedAction = {
  id: string;
  timestamp: string;
  actor: { type: "user" | "agent" | "system"; id: string };
  agent: { id: string; engine: string };
  threadId?: string;
  tool: { name: string; category: ActionCategory };
  intent?: "read" | "write" | "execute" | "navigate" | "communicate" | "unknown";
  target?: {
    path?: string;
    url?: string;
    host?: string;
    command?: string;
    app?: string;
    tool?: string;
  };
  risk: ActionRisk;
  externalWrite: boolean;
  metadata?: Record<string, unknown>;
};

const SHELL_TOOLS = new Set(["bash", "shell", "execute", "run_command", "computer_exec", "terminal"]);
const READ_FILE_TOOLS = new Set(["read", "read_file", "list_files", "glob", "grep"]);
const WRITE_FILE_TOOLS = new Set(["write", "edit", "write_file", "apply_patch", "delete_file", "move_file"]);

function bareTool(tool: string) {
  return tool.replace(/^mcp__[^_]+__/, "").toLowerCase();
}

function categoryFor(tool: string): ActionCategory {
  const bare = bareTool(tool);
  if (SHELL_TOOLS.has(bare)) return "shell";
  if (READ_FILE_TOOLS.has(bare) || WRITE_FILE_TOOLS.has(bare) || /file|directory|folder/.test(bare)) return "filesystem";
  if (/computer|screenshot|click|type_text|press_key|scroll/.test(bare)) return "computer";
  if (/webfetch|web_search|browser|navigate|open_url/.test(bare)) return "browser";
  if (/fetch|http|network|download|upload/.test(bare)) return "network";
  if (/ask_bot|delegate_bot|agent|handoff/.test(bare)) return "agent";
  if (/composio/.test(tool.toLowerCase())) return "composio";
  if (tool.startsWith("mcp__")) return "mcp";
  return "other";
}

function intentFor(tool: string, category: ActionCategory) {
  const bare = bareTool(tool);
  if (READ_FILE_TOOLS.has(bare) || /read|list|search|get|status|screenshot/.test(bare)) return "read" as const;
  if (WRITE_FILE_TOOLS.has(bare) || /write|edit|delete|remove|create|update|post|send|push|upload/.test(bare)) return "write" as const;
  if (category === "shell") return "execute" as const;
  if (category === "browser" || /navigate|open_url/.test(bare)) return "navigate" as const;
  if (category === "agent") return "communicate" as const;
  return "unknown" as const;
}

function externalWriteFor(category: ActionCategory, intent: GovernedAction["intent"], summary: string) {
  if (/\bgit\s+push\b|\bgh\s+(pr\s+merge|release\s+create|release\s+upload)\b|\b(curl|wget)\b[^\n]*(--request|-X)\s*(POST|PUT|PATCH|DELETE)\b/i.test(summary)) return true;
  return intent === "write" && ["browser", "network", "mcp", "composio", "agent"].includes(category);
}

export function normalizePermissionAction(input: {
  botId: string;
  engine: string;
  threadId?: string;
  tool: string;
  summary: string;
  requestId?: string;
  raw?: unknown;
}): GovernedAction {
  const category = categoryFor(input.tool);
  const intent = intentFor(input.tool, category);
  const externalWrite = externalWriteFor(category, intent, input.summary);
  const highRisk = looksDestructive(input.summary) || looksSensitive(input.summary) || looksDestructive(input.tool);
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
    risk: highRisk ? "high" : externalWrite || intent === "write" || intent === "execute" ? "medium" : "low",
    externalWrite,
    metadata: { summary: input.summary, ...(input.raw === undefined ? {} : { raw: input.raw }) },
  };
}
