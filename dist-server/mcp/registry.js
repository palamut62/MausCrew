export function mcpSecretEnv(serverId, name) {
    const normalizedServer = serverId.replace(/[^A-Za-z0-9]/g, "_").toUpperCase();
    const normalizedName = name.replace(/[^A-Za-z0-9]/g, "_").toUpperCase();
    return `MAUSCREW_MCP_${normalizedServer}_${normalizedName}`;
}
/** The servers a bot is allowed to mount — the grant check, once, so the
 * transport, the prompt, and the permission gate can never disagree about
 * which servers this bot actually has. */
export function mcpServersForBot(cfg, botId) {
    return (cfg.mcpServers ?? []).filter((server) => server.enabled !== false && !(server.allowedBots?.length && !server.allowedBots.includes(botId)));
}
export function mcpMountsForBot(cfg, botId) {
    const mounts = [];
    for (const server of mcpServersForBot(cfg, botId)) {
        const env = {};
        for (const name of server.envNames ?? []) {
            const value = process.env[mcpSecretEnv(server.id, name)];
            if (value)
                env[name] = value;
        }
        mounts.push({ name: `custom_${server.id}`, command: server.command, args: [...server.args], env });
    }
    return mounts;
}
/** The bare tool name inside a mounted server's namespace.
 *
 * The same call arrives spelled three ways depending on the engine —
 * `mcp__custom_<id>__read_file`, `custom_<id>__read_file`, or just
 * `read_file` from a driver that already stripped its own prefix — so the
 * gate normalizes instead of trusting one spelling. */
function bareToolName(tool, serverId) {
    const withoutMcp = tool.replace(/^mcp__/, "");
    const namespace = `custom_${serverId}__`;
    if (withoutMcp.startsWith(namespace))
        return withoutMcp.slice(namespace.length);
    // An unnamespaced name could belong to any mounted server; treated as a
    // candidate for each, which errs toward denying rather than letting a
    // disabled tool through under a shorter spelling.
    return withoutMcp.includes("__") ? null : withoutMcp;
}
/** The server that forbids this call, or null when nothing does. */
export function mcpDisabledTool(cfg, botId, tool) {
    for (const server of mcpServersForBot(cfg, botId)) {
        if (!server.disabledTools?.length)
            continue;
        const bare = bareToolName(tool, server.id);
        if (!bare)
            continue;
        const match = server.disabledTools.find((entry) => entry.toLowerCase() === bare.toLowerCase());
        if (match)
            return { server: server.name, tool: match };
    }
    return null;
}
/** Per-server guidance for the system prompt. Empty when the user wrote none,
 * so a bot with plain servers carries no extra tokens. */
export function mcpInstructionsPrompt(cfg, botId) {
    const blocks = [];
    for (const server of mcpServersForBot(cfg, botId)) {
        const parts = [];
        const instructions = server.instructions?.trim();
        if (instructions)
            parts.push(instructions);
        if (server.disabledTools?.length) {
            parts.push(`The user disabled these tools on this server: ${server.disabledTools.join(", ")}. They are blocked at the permission gate — do not call them, and say so instead of retrying.`);
        }
        if (parts.length)
            blocks.push(`MCP server "${server.name}" (custom_${server.id}): ${parts.join(" ")}`);
    }
    return blocks.length ? ` User instructions for specific MCP servers — ${blocks.join(" ")}` : "";
}
export function validateMcpServer(input) {
    if (!input || typeof input !== "object" || Array.isArray(input))
        throw new Error("MCP server must be an object");
    const value = input;
    const id = typeof value.id === "string" && /^[\w-]{1,60}$/.test(value.id) ? value.id : "";
    if (!id)
        throw new Error("MCP server id is invalid");
    const name = typeof value.name === "string" ? value.name.trim().slice(0, 80) : "";
    if (!name)
        throw new Error("MCP server needs a name");
    const command = typeof value.command === "string" ? value.command.trim().slice(0, 500) : "";
    if (!command || /[\r\n\0]/.test(command))
        throw new Error(`${name}: invalid command`);
    const args = Array.isArray(value.args) && value.args.every((arg) => typeof arg === "string" && !/[\0]/.test(arg))
        ? value.args.map((arg) => String(arg).slice(0, 2000)).slice(0, 100)
        : null;
    if (!args)
        throw new Error(`${name}: args must be a string array`);
    const envNames = Array.isArray(value.envNames) && value.envNames.every((entry) => typeof entry === "string" && /^[A-Za-z_][A-Za-z0-9_]{0,79}$/.test(entry))
        ? [...new Set(value.envNames)].slice(0, 50)
        : null;
    if (!envNames)
        throw new Error(`${name}: environment names are invalid`);
    const allowedBots = Array.isArray(value.allowedBots) && value.allowedBots.every((entry) => typeof entry === "string" && /^[\w-]{1,100}$/.test(entry))
        ? [...new Set(value.allowedBots)].slice(0, 100)
        : null;
    if (!allowedBots)
        throw new Error(`${name}: allowed bots are invalid`);
    const instructions = value.instructions === undefined || value.instructions === null
        ? ""
        : typeof value.instructions === "string"
            ? value.instructions.trim().slice(0, 2000)
            : null;
    if (instructions === null)
        throw new Error(`${name}: instructions must be text`);
    const disabledTools = value.disabledTools === undefined || value.disabledTools === null
        ? []
        : Array.isArray(value.disabledTools) && value.disabledTools.every((entry) => typeof entry === "string" && /^[\w.-]{1,80}$/.test(entry))
            ? [...new Set(value.disabledTools)].slice(0, 200)
            : null;
    if (disabledTools === null)
        throw new Error(`${name}: disabled tool names are invalid`);
    return {
        id,
        name,
        command,
        args,
        envNames,
        allowedBots,
        enabled: value.enabled !== false,
        ...(instructions ? { instructions } : {}),
        ...(disabledTools.length ? { disabledTools } : {}),
    };
}
