import type { AppConfig } from "../config.ts";

export type McpMount = {
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
};

export function mcpSecretEnv(serverId: string, name: string) {
  const normalizedServer = serverId.replace(/[^A-Za-z0-9]/g, "_").toUpperCase();
  const normalizedName = name.replace(/[^A-Za-z0-9]/g, "_").toUpperCase();
  return `MAUSCREW_MCP_${normalizedServer}_${normalizedName}`;
}

export function mcpMountsForBot(cfg: AppConfig, botId: string): McpMount[] {
  const mounts: McpMount[] = [];
  for (const server of cfg.mcpServers ?? []) {
    if (server.enabled === false || (server.allowedBots?.length && !server.allowedBots.includes(botId))) continue;
    const env: Record<string, string> = {};
    for (const name of server.envNames ?? []) {
      const value = process.env[mcpSecretEnv(server.id, name)];
      if (value) env[name] = value;
    }
    mounts.push({ name: `custom_${server.id}`, command: server.command, args: [...server.args], env });
  }
  return mounts;
}

export function validateMcpServer(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("MCP server must be an object");
  const value = input as Record<string, unknown>;
  const id = typeof value.id === "string" && /^[\w-]{1,60}$/.test(value.id) ? value.id : "";
  if (!id) throw new Error("MCP server id is invalid");
  const name = typeof value.name === "string" ? value.name.trim().slice(0, 80) : "";
  if (!name) throw new Error("MCP server needs a name");
  const command = typeof value.command === "string" ? value.command.trim().slice(0, 500) : "";
  if (!command || /[\r\n\0]/.test(command)) throw new Error(`${name}: invalid command`);
  const args = Array.isArray(value.args) && value.args.every((arg) => typeof arg === "string" && !/[\0]/.test(arg))
    ? value.args.map((arg) => String(arg).slice(0, 2000)).slice(0, 100)
    : null;
  if (!args) throw new Error(`${name}: args must be a string array`);
  const envNames = Array.isArray(value.envNames) && value.envNames.every((entry) => typeof entry === "string" && /^[A-Za-z_][A-Za-z0-9_]{0,79}$/.test(entry))
    ? [...new Set(value.envNames as string[])].slice(0, 50)
    : null;
  if (!envNames) throw new Error(`${name}: environment names are invalid`);
  const allowedBots = Array.isArray(value.allowedBots) && value.allowedBots.every((entry) => typeof entry === "string" && /^[\w-]{1,100}$/.test(entry))
    ? [...new Set(value.allowedBots as string[])].slice(0, 100)
    : null;
  if (!allowedBots) throw new Error(`${name}: allowed bots are invalid`);
  return { id, name, command, args, envNames, allowedBots, enabled: value.enabled !== false };
}
