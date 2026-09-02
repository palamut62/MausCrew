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
let lastSupervisionBody: any = null;
let checkResponse: unknown = { name: "Helper", busy: true, doing: "Bash", lastReply: "working on it" };
let stopResponse: unknown = { stopped: true };
let lastDelegateBody: any = null;
let delegateResponse: unknown = { queued: true, message: "Delegation queued." };
let lastCreateBody: any = null;
let createResponse: unknown = { botId: "bot-researcher", name: "Researcher" };
let lastWorkflowBody: any = null;
let lastWorkflowStepBody: any = null;
let lastReviewBody: any = null;

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
    if (req.method === "POST" && (req.url === "/api/internal/check-bot" || req.url === "/api/internal/stop-bot")) {
      let data = "";
      req.on("data", (c) => (data += c));
      req.on("end", () => {
        lastSupervisionBody = JSON.parse(data);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(req.url === "/api/internal/check-bot" ? checkResponse : stopResponse));
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
    if (req.method === "POST" && ["/api/internal/workflows", "/api/internal/workflows/step", "/api/internal/review-queue"].includes(req.url ?? "")) {
      let data = "";
      req.on("data", (c) => (data += c));
      req.on("end", () => {
        const body = JSON.parse(data);
        res.writeHead(req.url === "/api/internal/workflows" || req.url === "/api/internal/review-queue" ? 201 : 200, { "content-type": "application/json" });
        if (req.url === "/api/internal/workflows") {
          lastWorkflowBody = body;
          return res.end(JSON.stringify({ workflow: { id: "workflow-1", status: "active", steps: [{ id: "step-real-1" }] } }));
        }
        if (req.url === "/api/internal/workflows/step") {
          lastWorkflowStepBody = body;
          return res.end(JSON.stringify({ workflow: { id: "workflow-1", status: "completed" } }));
        }
        lastReviewBody = body;
        return res.end(JSON.stringify({ item: { id: "review-1", status: "pending" } }));
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
      "check_bot",
      "stop_bot",
      "create_bot",
      "create_workflow",
      "update_workflow_step",
      "queue_review",
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

  it("creates and advances a persistent workflow with the source identity", async () => {
    const created = await callTool("create_workflow", {
      title: "Ship onboarding",
      project_id: "project-1",
      steps: [
        { id: "design", title: "Design", bot_id: "bot-designer", depends_on: [] },
        { id: "build", title: "Build", bot_id: "bot-builder", depends_on: ["design"] },
      ],
    });
    expect(created.result.content[0].text).toContain("Workflow created");
    expect(lastWorkflowBody).toMatchObject({
      fromBotId: "bot-asker",
      fromThreadId: "thread-asker-routine",
      projectId: "project-1",
      steps: [{ id: "design", assigneeBotId: "bot-designer" }, { id: "build", dependsOn: ["design"] }],
    });

    const updated = await callTool("update_workflow_step", {
      workflow_id: "workflow-1",
      step_id: "step-real-1",
      status: "done",
      output: "Approved implementation",
    });
    expect(updated.result.content[0].text).toContain("completed");
    expect(lastWorkflowStepBody).toMatchObject({
      fromBotId: "bot-asker",
      fromThreadId: "thread-asker-routine",
      workflowId: "workflow-1",
      stepId: "step-real-1",
      status: "done",
      output: "Approved implementation",
    });
  });

  it("queues outbound content without claiming it was sent", async () => {
    const result = await callTool("queue_review", {
      title: "Release note",
      content: "Version is ready.",
      target: "Slack #releases",
      project_id: "project-1",
    });
    expect(result.result.content[0].text).toContain("It has not been sent");
    expect(lastReviewBody).toMatchObject({
      fromBotId: "bot-asker",
      fromThreadId: "thread-asker-routine",
      title: "Release note",
      content: "Version is ready.",
      target: "Slack #releases",
      projectId: "project-1",
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

  // A delegation used to be the end of the caller's involvement: it could hand
  // work over and never find out what happened.
  describe("supervising what it delegated", () => {
    it("reports what the peer is doing, including when it is stuck on the user", () => {
      checkResponse = { name: "Helper", busy: true, waitingOnUser: true, doing: "Bash", lastReply: "one sec" };
      return callTool("check_bot", { bot_id: "bot-a" }).then((res) => {
        const text = res.result.content[0].text as string;
        expect(text).toContain("running");
        expect(text).toMatch(/waiting for the user/i);
        expect(text).toContain("Bash");
        expect(text).toContain("one sec");
        expect(lastSupervisionBody.fromBotId).toBeTruthy();
      });
    });

    it("says plainly when a peer has said nothing yet", async () => {
      checkResponse = { name: "Helper", busy: false, lastReply: null };
      const res = await callTool("check_bot", { bot_id: "bot-a" });
      expect(res.result.content[0].text).toMatch(/idle/);
      expect(res.result.content[0].text).toMatch(/not said anything/i);
    });

    it("stops a running peer, and is honest when there was nothing to stop", async () => {
      stopResponse = { stopped: true };
      expect((await callTool("stop_bot", { bot_id: "bot-a" })).result.content[0].text).toMatch(/Stopped it/);
      stopResponse = { stopped: false, reason: "that bot is not running" };
      const idle = await callTool("stop_bot", { bot_id: "bot-a" });
      expect(idle.result.content[0].text).toMatch(/Nothing to stop/);
      expect(idle.result.isError).toBeFalsy();
    });

    it("needs a bot id for both", async () => {
      expect((await callTool("check_bot", { bot_id: "" })).result.isError).toBe(true);
      expect((await callTool("stop_bot", { bot_id: "" })).result.isError).toBe(true);
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

// A turn another bot started: the recursion cap must take away the tools that
// could start a third turn, and nothing else. Before this, it took away the
// whole server — so a delegated teammate could not mark the workflow step it
// had just been handed, or queue outbound text for the user to approve.
describe("at the recursion cap", () => {
  let capped: ChildProcess;
  const cappedPending = new Map<number, (msg: any) => void>();
  let cappedId = 500;

  const cappedRpc = (method: string, params?: unknown): Promise<any> =>
    new Promise((resolve, reject) => {
      const id = cappedId++;
      cappedPending.set(id, resolve);
      capped.stdin!.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
      setTimeout(() => {
        if (cappedPending.delete(id)) reject(new Error(`${method} timed out`));
      }, 10_000).unref?.();
    });

  beforeAll(async () => {
    capped = spawn(process.execPath, [PROXY], {
      env: {
        ...process.env,
        MAUSCREW_HARNESS_URL: `http://127.0.0.1:${stubPort}`,
        MAUSCREW_BOT_ID: "bot-asker",
        MAUSCREW_THREAD_ID: "thread-asker-routine",
        MAUSCREW_COMMS_TOKEN: TOKEN,
        MAUSCREW_TURN_DEPTH: "1",
        MAUSCREW_COMMS_MAX_DEPTH: "1",
      },
      stdio: ["pipe", "pipe", "inherit"],
    });
    let buf = "";
    capped.stdout!.on("data", (c) => {
      buf += c;
      let nl;
      while ((nl = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (!line.trim()) continue;
        const msg = JSON.parse(line);
        cappedPending.get(msg.id)?.(msg);
        cappedPending.delete(msg.id);
      }
    });
    await cappedRpc("initialize", { protocolVersion: "2024-11-05" });
  });

  afterAll(() => {
    capped?.kill();
  });

  it("advertises only the tools that report on work already assigned", async () => {
    const list = await cappedRpc("tools/list");
    expect(list.result.tools.map((t: { name: string }) => t.name)).toEqual(["update_workflow_step", "queue_review"]);
  });

  it("refuses every tool that would start another turn", async () => {
    for (const name of ["ask_bot", "ask_bots", "delegate_bot", "create_bot", "list_bots", "create_workflow"]) {
      const res = await cappedRpc("tools/call", { name, arguments: { bot_id: "bot-helper", message: "ping" } });
      expect(res.error?.code, `${name} should be refused at the cap`).toBe(-32602);
    }
    expect(lastAskBody, "no peer turn may be started from a capped turn").toBeTruthy();
  });

  it("still lets the assignee report its step and queue a review", async () => {
    lastWorkflowStepBody = null;
    lastReviewBody = null;
    const step = await cappedRpc("tools/call", {
      name: "update_workflow_step",
      arguments: { workflow_id: "wf-1", step_id: "step-1", status: "done", output: "collected" },
    });
    expect(step.result.isError).toBeFalsy();
    expect(lastWorkflowStepBody).toMatchObject({ workflowId: "wf-1", stepId: "step-1", status: "done" });

    const review = await cappedRpc("tools/call", {
      name: "queue_review",
      arguments: { title: "Note", content: "text", target: "Slack #releases" },
    });
    expect(review.result.isError).toBeFalsy();
    expect(lastReviewBody).toMatchObject({ title: "Note", target: "Slack #releases" });
  });
});
