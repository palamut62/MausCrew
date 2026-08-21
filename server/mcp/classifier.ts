export type McpToolClass = "read" | "write" | "execute" | "unknown";

const READ = /(^|[._-])(get|list|read|search|find|fetch|status|inspect|describe|view|query)([._-]|$)/i;
const WRITE = /(^|[._-])(create|update|edit|write|delete|remove|send|post|publish|merge|upload|invite|add|set)([._-]|$)/i;
const EXECUTE = /(^|[._-])(execute|exec|run|shell|terminal|command|deploy)([._-]|$)/i;

/** Conservative name-only classification. Unknown never becomes read: the
 * governance policy's MCP default is ASK. */
export function classifyMcpTool(name: string): McpToolClass {
  if (EXECUTE.test(name)) return "execute";
  if (WRITE.test(name)) return "write";
  if (READ.test(name)) return "read";
  return "unknown";
}
