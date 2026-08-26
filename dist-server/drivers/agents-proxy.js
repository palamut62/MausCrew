// Agent-to-agent comms MCP proxy — spawned as an MCP server inside a bot's
// agent process (via the "agents" integration). Exposes three tools that
// let one bot talk to another, routed back through the harness so the
// harness stays the single owner of turns, permissions, and recursion
// limits:
//
//   list_bots()                          → the other bots in this workspace + their status
//   ask_bot(bot_id, msg)                 → send msg to that bot, wait, return its reply
//   delegate_bot(bot_id, msg, reason?)   → hand the task to a peer ASYNC: returns
//                                          immediately, the peer runs after your
//                                          current turn finishes, the user sees
//                                          the peer's reply as its own turn
//   create_bot(name, title, description) → propose a durable specialist; the
//                                          harness creates it only after approval
//
// Speaks raw JSON-RPC 2.0 over stdio (no MCP SDK — house style, matches
// computer-proxy / permission-proxy). All state comes from env, injected by
// the harness when it builds the integration:
//   MAUSCREW_HARNESS_URL  base URL of the harness (http://127.0.0.1:8799)
//   MAUSCREW_BOT_ID       the calling bot's id (excluded from list_bots; sender)
//   MAUSCREW_COMMS_TOKEN  shared secret for the localhost-only internal endpoints
//   MAUSCREW_TURN_DEPTH   this turn's comms depth (the harness refuses recursion)
import readline from "node:readline";
const HARNESS = process.env.MAUSCREW_HARNESS_URL ?? "http://127.0.0.1:8799";
const BOT_ID = process.env.MAUSCREW_BOT_ID ?? "";
const THREAD_ID = process.env.MAUSCREW_THREAD_ID ?? "";
const TOKEN = process.env.MAUSCREW_COMMS_TOKEN ?? "";
const DEPTH = Number(process.env.MAUSCREW_TURN_DEPTH ?? "0") || 0;
const TOOLS = [
    {
        name: "list_bots",
        description: "List the other bots (agents) in this MausCrew workspace you can message, with their model and whether they're busy. Call this before ask_bot to discover who's available.",
        inputSchema: { type: "object", properties: {} },
    },
    {
        name: "ask_bot",
        description: "Send a message to another bot in this workspace and wait for its reply. Use it to delegate a subtask to a specialist bot or ask a peer a question. The other bot runs a full turn under its own model and permissions; the reply is returned to you as text. Returns promptly with a note if that bot is busy.",
        inputSchema: {
            type: "object",
            properties: {
                bot_id: { type: "string", description: "The target bot's id (from list_bots)." },
                message: { type: "string", description: "What to say / ask the bot." },
            },
            required: ["bot_id", "message"],
        },
    },
    {
        name: "ask_bots",
        description: "Ask several bots at once and wait for all of them. Use this instead of repeated ask_bot calls when the questions are independent: those run one after another, each blocking until its peer finishes, so three questions cost three turns of waiting. Each peer still runs under its own model and permissions. A peer that is busy or unreachable is reported alongside the others rather than failing the batch.",
        inputSchema: {
            type: "object",
            properties: {
                requests: {
                    type: "array",
                    description: "One entry per bot. At most 6, and one entry per bot - a bot can only run one turn at a time.",
                    items: {
                        type: "object",
                        properties: {
                            bot_id: { type: "string", description: "The target bot's id (from list_bots)." },
                            message: { type: "string", description: "What to ask that bot." },
                        },
                        required: ["bot_id", "message"],
                    },
                },
            },
            required: ["requests"],
        },
    },
    {
        name: "delegate_bot",
        description: "Hand a task to another bot ASYNCHRONOUSLY: returns immediately and the peer runs after your current turn finishes. Use this when you want to keep working or hand off a long-running subtask without waiting. The user sees the peer's reply as its own turn; you do NOT receive the reply inline.",
        inputSchema: {
            type: "object",
            properties: {
                bot_id: { type: "string", description: "The target bot's id (from list_bots)." },
                message: { type: "string", description: "What the peer should do / answer." },
                reason: { type: "string", description: "Optional one-line reason for the delegation (shown to the user as a chip)." },
            },
            required: ["bot_id", "message"],
        },
    },
    {
        name: "check_bot",
        description: "See what a bot you delegated to is doing now: whether it is still running, what tool it last used, whether it is stopped waiting for the user to answer something, and what it last said. Use this instead of guessing after delegate_bot.",
        inputSchema: {
            type: "object",
            properties: { bot_id: { type: "string", description: "The bot's id (from list_bots)." } },
            required: ["bot_id"],
        },
    },
    {
        name: "stop_bot",
        description: "Interrupt a bot that is running, when the work you handed it is no longer needed or has gone wrong. It stops mid-turn and keeps whatever it had already done. Does nothing if that bot is idle.",
        inputSchema: {
            type: "object",
            properties: { bot_id: { type: "string", description: "The bot's id (from list_bots)." } },
            required: ["bot_id"],
        },
    },
    {
        name: "create_bot",
        description: "Create a durable specialist bot when work has a genuinely distinct long-lived owner, tools, approval boundary, or recurring responsibility. Do not use this for one-off subtasks. The user must approve every creation.",
        inputSchema: {
            type: "object",
            properties: {
                name: { type: "string", description: "Short unique teammate name." },
                title: { type: "string", description: "Focused job title, such as Bug Reproduction." },
                description: { type: "string", description: "Operational responsibilities, expected output, and approval boundaries." },
            },
            required: ["name", "title", "description"],
        },
    },
];
const send = (msg) => process.stdout.write(JSON.stringify(msg) + "\n");
const ok = (id, result) => send({ jsonrpc: "2.0", id, result });
const rpcErr = (id, code, message) => send({ jsonrpc: "2.0", id, error: { code, message } });
const textResult = (id, text, isError = false) => ok(id, { content: [{ type: "text", text }], isError });
/** A bot can wait on a handful of peers; twenty is a stampede, not a plan. */
const MAX_PARALLEL_ASKS = 6;
async function api(path, init) {
    const res = await fetch(HARNESS + path, {
        ...init,
        headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}`, ...(init?.headers ?? {}) },
    });
    const body = (await res.json().catch(() => ({})));
    if (!res.ok)
        throw new Error(String(body.error ?? `HTTP ${res.status}`));
    return body;
}
async function callTool(name, args) {
    if (name === "list_bots") {
        const r = await api(`/api/internal/agents?self=${encodeURIComponent(BOT_ID)}`);
        const bots = r.bots ?? [];
        if (!bots.length)
            return { text: "No other bots in this workspace yet." };
        const lines = bots.map((b) => {
            const role = b.title ? ` — ${b.title}` : "";
            const about = b.description ? ` (${String(b.description).slice(0, 120)})` : "";
            return `- ${b.name}${role}${about} [id: ${b.id}, model: ${b.model}${b.busy ? ", busy" : ""}]`;
        });
        return { text: `Other bots you can message with ask_bot:\n${lines.join("\n")}` };
    }
    if (name === "ask_bot") {
        const toBotId = String(args.bot_id ?? "").trim();
        const message = String(args.message ?? "").trim();
        if (!toBotId || !message)
            return { text: "ask_bot needs bot_id and message.", isError: true };
        const r = await api(`/api/internal/ask-bot`, {
            method: "POST",
            body: JSON.stringify({ fromBotId: BOT_ID, fromThreadId: THREAD_ID, toBotId, message, depth: DEPTH }),
        });
        if (r.busy)
            return { text: `That bot is busy right now — try again after it finishes.` };
        if (r.error)
            return { text: `Couldn't reach that bot: ${r.error}`, isError: true };
        return { text: `${r.botName ?? "Bot"} replied:\n${r.text ?? "(no reply)"}` };
    }
    if (name === "ask_bots") {
        const raw = Array.isArray(args.requests) ? args.requests : [];
        // One turn per bot at a time, so a second question to the same peer would
        // only ever come back "busy". Collapsing them here turns a wasted round
        // trip into a clear instruction.
        const seen = new Set();
        const duplicates = [];
        const requests = [];
        for (const entry of raw) {
            const botId = String(entry?.bot_id ?? "").trim();
            const message = String(entry?.message ?? "").trim();
            if (!botId || !message)
                continue;
            if (seen.has(botId)) {
                duplicates.push(botId);
                continue;
            }
            seen.add(botId);
            requests.push({ botId, message });
        }
        if (!requests.length) {
            return { text: "ask_bots needs a requests array of { bot_id, message }.", isError: true };
        }
        if (requests.length > MAX_PARALLEL_ASKS) {
            return { text: `ask_bots takes at most ${MAX_PARALLEL_ASKS} bots at a time; you asked for ${requests.length}.`, isError: true };
        }
        const settled = await Promise.allSettled(requests.map((request) => api(`/api/internal/ask-bot`, {
            method: "POST",
            body: JSON.stringify({
                fromBotId: BOT_ID,
                fromThreadId: THREAD_ID,
                toBotId: request.botId,
                message: request.message,
                depth: DEPTH,
            }),
        })));
        const blocks = settled.map((outcome, index) => {
            const request = requests[index];
            if (outcome.status === "rejected") {
                const detail = outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
                return `### ${request.botId} - unreachable\n${detail}`;
            }
            const reply = outcome.value;
            if (reply.busy)
                return `### ${request.botId} - busy, did not run`;
            if (reply.error)
                return `### ${request.botId} - failed\n${String(reply.error)}`;
            return `### ${reply.botName ?? request.botId}\n${reply.text ?? "(no reply)"}`;
        });
        if (duplicates.length) {
            blocks.push(`### skipped\nAsked the same bot twice in one batch (${[...new Set(duplicates)].join(", ")}); only the first question was sent.`);
        }
        // Not an error even when every peer failed: the caller asked for a set of
        // answers and is owed the set, with each outcome named.
        return { text: `Replies from ${requests.length} bot(s):\n\n${blocks.join("\n\n")}` };
    }
    if (name === "delegate_bot") {
        const toBotId = String(args.bot_id ?? "").trim();
        const message = String(args.message ?? "").trim();
        const reason = typeof args.reason === "string" ? args.reason.trim() : "";
        if (!toBotId || !message)
            return { text: "delegate_bot needs bot_id and message.", isError: true };
        const body = {
            fromBotId: BOT_ID,
            fromThreadId: THREAD_ID,
            toBotId,
            message,
            depth: DEPTH,
        };
        if (reason)
            body.reason = reason;
        const r = await api(`/api/internal/delegate-bot`, { method: "POST", body: JSON.stringify(body) });
        if (r.error)
            return { text: `Couldn't queue the delegation: ${r.error}`, isError: true };
        // Fire-and-forget by contract: the harness returns immediately, the
        // peer turn runs after our current turn finishes.
        return { text: typeof r.message === "string" ? r.message : "Delegation queued." };
    }
    if (name === "check_bot") {
        const toBotId = String(args.bot_id ?? "").trim();
        if (!toBotId)
            return { text: "check_bot needs bot_id.", isError: true };
        const r = await api(`/api/internal/check-bot`, {
            method: "POST",
            body: JSON.stringify({ fromBotId: BOT_ID, toBotId }),
        });
        if (r.error)
            return { text: `Couldn't check that bot: ${r.error}`, isError: true };
        const lines = [
            `${r.name ?? toBotId} is ${r.busy ? "running" : "idle"}.`,
            r.waitingOnUser ? "It is stopped waiting for the user to answer something." : "",
            r.doing ? `Last tool: ${r.doing}` : "",
            r.lastReply ? `Last said:\n${r.lastReply}` : "It has not said anything yet.",
        ].filter(Boolean);
        return { text: lines.join("\n") };
    }
    if (name === "stop_bot") {
        const toBotId = String(args.bot_id ?? "").trim();
        if (!toBotId)
            return { text: "stop_bot needs bot_id.", isError: true };
        const r = await api(`/api/internal/stop-bot`, {
            method: "POST",
            body: JSON.stringify({ fromBotId: BOT_ID, toBotId }),
        });
        if (r.error)
            return { text: `Couldn't stop that bot: ${r.error}`, isError: true };
        return { text: r.stopped ? "Stopped it." : `Nothing to stop — ${String(r.reason ?? "it was idle")}.` };
    }
    if (name === "create_bot") {
        const botName = String(args.name ?? "").trim();
        const title = String(args.title ?? "").trim();
        const description = String(args.description ?? "").trim();
        if (!botName || !title || !description) {
            return { text: "create_bot needs name, title, and description.", isError: true };
        }
        const r = await api(`/api/internal/create-bot`, {
            method: "POST",
            body: JSON.stringify({ fromBotId: BOT_ID, fromThreadId: THREAD_ID, name: botName, title, description, depth: DEPTH }),
        });
        if (r.error)
            return { text: `Couldn't create the bot: ${r.error}`, isError: true };
        return { text: `Created @${r.name ?? botName} as a durable teammate [id: ${r.botId ?? "unknown"}].` };
    }
    return { text: `Unknown tool: ${name}`, isError: true };
}
async function handle(msg) {
    const id = msg.id;
    const method = msg.method;
    if (!method)
        return;
    const params = (msg.params ?? {});
    switch (method) {
        case "initialize":
            ok(id, {
                protocolVersion: params.protocolVersion ?? "2024-11-05",
                capabilities: { tools: {} },
                serverInfo: { name: "opengrokbot-agents", version: "0.1.0" },
            });
            return;
        case "notifications/initialized":
        case "notifications/cancelled":
            return;
        case "ping":
            ok(id, {});
            return;
        case "tools/list":
            ok(id, { tools: TOOLS });
            return;
        case "tools/call": {
            const name = params.name;
            if (!TOOLS.some((t) => t.name === name))
                return rpcErr(id, -32602, `Unknown tool: ${name}`);
            try {
                const { text, isError } = await callTool(name, (params.arguments ?? {}));
                textResult(id, text, isError);
            }
            catch (e) {
                textResult(id, e.message, true);
            }
            return;
        }
        default:
            if (id !== undefined)
                rpcErr(id, -32601, `Method not found: ${method}`);
    }
}
const rl = readline.createInterface({ input: process.stdin, terminal: false });
rl.on("line", (line) => {
    const t = line.trim();
    if (!t)
        return;
    let msg;
    try {
        msg = JSON.parse(t);
    }
    catch {
        return;
    }
    void handle(msg).catch((e) => {
        if (msg.id !== undefined)
            rpcErr(msg.id, -32603, e.message);
    });
});
rl.on("close", () => process.exit(0));
