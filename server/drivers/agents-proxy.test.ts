// Contract test for the agent-to-agent comms MCP proxy (agents-proxy.ts):
// spawn it exactly the way a driver's mcpServers entry does (process.execPath
// + entry file + env) against a scripted stub of the harness's /api/internal
// endpoints, and drive the MCP stdio surface end to end. No shebang, no
// shell — plain node child, so this runs on every OS like index.test.ts.
import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const PROXY = join(dirname(fileURLToPath(import.meta.url)), "agents-proxy.ts");
const TOKEN = "test-comms-token";

// scripted harness stub
let stub: Server;
let stubPort = 0;
let lastAuth: string | undefined;
let lastAskBody: any = null;
let askResponse: unknown = { botName: "Helper", text: "hi from helper" };
/** Per-target answers plus a delay, so a fan-out can be observed overlapping. */
let askByBot: Map<string, { reply: unknown; delayMs?: number }> | null = null;
let askInFlight = 0;
let askPeakInFlight = 0;
let lastDelegateBody: any = null;
let delegateResponse: unknown = { queued: true, message: "Delegation queued." };
let lastCreateBody: any = null;
let createResponse: unknown = { botId: "bot-researcher", name: "Researcher" };

let child: ChildProcess;
const pending = new Map<number, (msg: any) => void>();
let nextId = 100;

function rpc(method: string, params?: unknown): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, resolve);
    child.stdin!.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    setTimeout(() => {
      if (pending.delete(id)) reject(new Error(`${method} timed out`));
    }, 10_000).unref?.();
  });
}
const callTool = (name: string, args: unknown) => rpc("tools/call", { name, arguments: args });

beforeAll(async () => {
  stub = createServer((req, res) => {
    lastAuth = req.headers.authorization;
    if (req.headers.authorization !== `Bearer ${TOKEN}`) {
      res.writeHead(401, { "content-type": "application/json" });
      return res.end(JSON.stringify({ error: "unauthorized" }));
    }
    if (req.method === "GET" && req.url?.startsWith("/api/internal/agents")) {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(
        JSON.stringify({
          bots: [{ id: "bot-helper", name: "Helper", model: "fake-model", busy: false }],
        }),
      );
    }
    if (req.method === "POST" && req.url === "/api/internal/ask-bot") {
      let data = "";
      req.on("data", (c) => (data += c));
      req.on("end", () => {
        lastAskBody = JSON.parse(data);
        const scripted = askByBot?.get(String(lastAskBody?.toBotId ?? ""));
        askInFlight += 1;
        askPeakInFlight = Math.max(askPeakInFlight, askInFlight);
        const finish = () => {
          askInFlight -= 1;
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify(scripted ? scripted.reply : askResponse));
        };
        if (scripted?.delayMs) setTimeout(finish, scripted.delayMs);
        else finish();
      });
      return;
    }
    if (req.method === "POST" && req.url === "/api/internal/delegate-bot") {
      let data = "";
      req.on("data", (c) => (data += c));
      req.on("end", () => {
        lastDelegateBody = JSON.parse(data);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(delegateResponse));
      });
      return;
    }
    if (req.method === "POST" && req.url === "/api/internal/create-bot") {
      let data = "";
      req.on("data", (c) => (data += c));
      req.on("end", () => {
        lastCreateBody = JSON.parse(data);
        res.writeHead(201, { "content-type": "application/json" });
        res.end(JSON.stringify(createResponse));
      });
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "unknown" }));
  });
  await new Promise<void>((r) => stub.listen(0, "127.0.0.1", r));
  stubPort = (stub.address() as { port: number }).port;

  child = spawn(process.execPath, [PROXY], {
    env: {
      ...process.env,
      MAUSCREW_HARNESS_URL: `http://127.0.0.1:${stubPort}`,
      MAUSCREW_BOT_ID: "bot-asker",
      MAUSCREW_THREAD_ID: "thread-asker-routine",
      MAUSCREW_COMMS_TOKEN: TOKEN,
      MAUSCREW_TURN_DEPTH: "0",
    },
    stdio: ["pipe", "pipe", "inherit"],
  });
  let buf = "";
  child.stdout!.on("data", (c) => {
    buf += c;
    let nl;
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (!line.trim()) continue;
      const msg = JSON.parse(line);
      pending.get(msg.id)?.(msg);
      pending.delete(msg.id);
    }
  });
});

afterAll(async () => {
  child?.kill();
  await new Promise<void>((r) => stub.close(() => r()));
});

describe("agents-proxy MCP surface", () => {
  it("answers the MCP handshake and lists every tool", async () => {
    const init = await rpc("initialize", { protocolVersion: "2024-11-05" });
    expect(init.result.serverInfo.name).toContain("agents");
    const list = await rpc("tools/list");
    expect(list.result.tools.map((t: { name: string }) => t.name)).toEqual([
      "list_bots",
      "ask_bot",
      "ask_bots",
      "delegate_bot",
      "create_bot",
    ]);
  });

  it("list_bots renders the roster and authenticates with the shared token", async () => {
    const res = await callTool("list_bots", {});
    const text = res.result.content[0].text;
    expect(text).toContain("Helper");
    expect(text).toContain("bot-helper");
    expect(lastAuth).toBe(`Bearer ${TOKEN}`);
  });

  it("ask_bot forwards sender + depth and returns the reply", async () => {
    askResponse = { botName: "Helper", text: "hi from helper" };
    const res = await callTool("ask_bot", { bot_id: "bot-helper", message: "ping" });
    expect(res.result.content[0].text).toContain("Helper replied:");
    expect(res.result.content[0].text).toContain("hi from helper");
    expect(lastAskBody).toMatchObject({
      fromBotId: "bot-asker",
      fromThreadId: "thread-asker-routine",
      toBotId: "bot-helper",
      message: "ping",
      depth: 0,
    });
  });

  it("renders a busy peer as a clean answer, not an error", async () => {
    askResponse = { busy: true };
    const res = await callTool("ask_bot", { bot_id: "bot-helper", message: "ping" });
    expect(res.result.content[0].text).toContain("busy");
    expect(res.result.isError).toBeFalsy();
  });

  it("surfaces the harness's depth refusal as a tool error", async () => {
    askResponse = { error: "message chains are limited to one hop" };
    const res = await callTool("ask_bot", { bot_id: "bot-helper", message: "ping" });
    expect(res.result.isError).toBe(true);
    expect(res.result.content[0].text).toContain("one hop");
  });

  it("forwards the source thread when queueing a delegation", async () => {
    delegateResponse = { queued: true, message: "Delegation queued." };
    const res = await callTool("delegate_bot", {
      bot_id: "bot-helper",
      message: "take this",
      reason: "follow-up",
    });
    expect(res.result.content[0].text).toContain("Delegation queued");
    expect(lastDelegateBody).toMatchObject({
      fromBotId: "bot-asker",
      fromThreadId: "thread-asker-routine",
      toBotId: "bot-helper",
      message: "take this",
      reason: "follow-up",
      depth: 0,
    });
  });

  it("returns queue refusal guidance to the agent as a tool error", async () => {
    delegateResponse = { error: "delegation chains are limited to one hop — do this one yourself" };
    const res = await callTool("delegate_bot", { bot_id: "bot-helper", message: "take this" });
    expect(res.result.isError).toBe(true);
    expect(res.result.content[0].text).toContain("do this one yourself");
  });

  it("proposes a durable bot with its complete role profile", async () => {
    createResponse = { botId: "bot-researcher", name: "Researcher" };
    const res = await callTool("create_bot", {
      name: "Researcher",
      title: "Evidence researcher",
      description: "Find primary sources and preserve links.",
    });
    expect(res.result.content[0].text).toContain("Created @Researcher");
    expect(lastCreateBody).toMatchObject({
      fromBotId: "bot-asker",
      fromThreadId: "thread-asker-routine",
      name: "Researcher",
      title: "Evidence researcher",
      depth: 0,
    });
  });

  describe("ask_bots", () => {
    // The point of the tool: three independent questions should cost one wait,
    // not three. Serial ask_bot calls are what this replaces.
    it("really asks in parallel, and names every reply", async () => {
      askByBot = new Map([
        ["bot-a", { reply: { botName: "Ada", text: "answer a" }, delayMs: 120 }],
        ["bot-b", { reply: { botName: "Bo", text: "answer b" }, delayMs: 120 }],
        ["bot-c", { reply: { botName: "Cy", text: "answer c" }, delayMs: 120 }],
      ]);
      askPeakInFlight = 0;
      const started = Date.now();
      const res = await callTool("ask_bots", {
        requests: [
          { bot_id: "bot-a", message: "q a" },
          { bot_id: "bot-b", message: "q b" },
          { bot_id: "bot-c", message: "q c" },
        ],
      });
      const text = res.result.content[0].text as string;
      expect(text).toContain("answer a");
      expect(text).toContain("answer b");
      expect(text).toContain("answer c");
      expect(askPeakInFlight).toBeGreaterThan(1);
      expect(Date.now() - started).toBeLessThan(3 * 120);
      askByBot = null;
    });

    it("reports a busy or failed peer beside the others instead of failing the batch", async () => {
      askByBot = new Map([
        ["bot-a", { reply: { botName: "Ada", text: "answer a" } }],
        ["bot-b", { reply: { busy: true } }],
        ["bot-c", { reply: { error: "message chains are limited to one hop" } }],
      ]);
      const res = await callTool("ask_bots", {
        requests: [
          { bot_id: "bot-a", message: "q a" },
          { bot_id: "bot-b", message: "q b" },
          { bot_id: "bot-c", message: "q c" },
        ],
      });
      const text = res.result.content[0].text as string;
      expect(res.result.isError).toBeFalsy();
      expect(text).toContain("answer a");
      expect(text).toMatch(/bot-b - busy/);
      expect(text).toMatch(/bot-c - failed/);
      askByBot = null;
    });

    it("collapses a repeated target rather than spending a turn on a guaranteed busy", async () => {
      askByBot = new Map([["bot-a", { reply: { botName: "Ada", text: "once" } }]]);
      const res = await callTool("ask_bots", {
        requests: [
          { bot_id: "bot-a", message: "first" },
          { bot_id: "bot-a", message: "second" },
        ],
      });
      const text = res.result.content[0].text as string;
      expect(text).toContain("Replies from 1 bot(s)");
      expect(text).toContain("skipped");
      askByBot = null;
    });

    it("refuses a stampede and an empty batch", async () => {
      const many = await callTool("ask_bots", {
        requests: Array.from({ length: 7 }, (_, i) => ({ bot_id: `bot-${i}`, message: "q" })),
      });
      expect(many.result.isError).toBe(true);
      const none = await callTool("ask_bots", { requests: [] });
      expect(none.result.isError).toBe(true);
    });
  });

  it("rejects unknown tools with -32602", async () => {
    const res = await rpc("tools/call", { name: "made_up", arguments: {} });
    expect(res.error.code).toBe(-32602);
  });

  it("requires bot_id and message", async () => {
    const res = await callTool("ask_bot", { bot_id: "", message: "" });
    expect(res.result.isError).toBe(true);
  });
});
