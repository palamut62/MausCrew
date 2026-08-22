// Contract test for the self-scheduling MCP proxy (routines-proxy.ts): spawn
// it exactly the way a driver's mcpServers entry does (process.execPath +
// entry file + env) against a scripted stub of the harness's
// /api/internal/routines endpoints, and drive the MCP stdio surface end to
// end. Mirrors agents-proxy.test.ts — plain node child, no shell, so this
// runs on every OS.
import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const PROXY = join(dirname(fileURLToPath(import.meta.url)), "routines-proxy.ts");
const TOKEN = "test-comms-token";
const BOT = "bot-scheduler";

let stub: Server;
let stubPort = 0;
let lastAuth: string | undefined;
let lastUrl = "";
let lastMethod = "";
let lastBody: any = null;
// What the stub hands back for the next non-GET call, so a test can script a
// harness refusal (the per-bot cap) as easily as a success.
let nextResponse: { status: number; body: unknown } = { status: 201, body: {} };

const WEEKLY = {
  id: "rt-1",
  name: "Weekly footprint scan",
  botId: BOT,
  enabled: true,
  schedule: { type: "daily", time: "09:00", weekdays: [1] },
  nextRunAt: new Date(2026, 7, 24, 9, 0).getTime(),
};

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
const textOf = (res: any) => res.result.content[0].text as string;

beforeAll(async () => {
  stub = createServer((req, res) => {
    lastAuth = req.headers.authorization;
    lastUrl = req.url ?? "";
    lastMethod = req.method ?? "";
    if (req.headers.authorization !== `Bearer ${TOKEN}`) {
      res.writeHead(401, { "content-type": "application/json" });
      return res.end(JSON.stringify({ error: "unauthorized" }));
    }
    if (req.method === "GET" && lastUrl.startsWith("/api/internal/routines")) {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ routines: [WEEKLY] }));
    }
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      lastBody = data ? JSON.parse(data) : null;
      res.writeHead(nextResponse.status, { "content-type": "application/json" });
      res.end(JSON.stringify(nextResponse.body));
    });
  });
  await new Promise<void>((r) => stub.listen(0, "127.0.0.1", r));
  stubPort = (stub.address() as { port: number }).port;

  child = spawn(process.execPath, [PROXY], {
    env: {
      ...process.env,
      MAUSCREW_HARNESS_URL: `http://127.0.0.1:${stubPort}`,
      MAUSCREW_BOT_ID: BOT,
      MAUSCREW_COMMS_TOKEN: TOKEN,
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

describe("routines-proxy MCP surface", () => {
  it("answers the MCP handshake and lists the five scheduling tools", async () => {
    const init = await rpc("initialize", { protocolVersion: "2024-11-05" });
    expect(init.result.serverInfo.name).toContain("routines");
    const list = await rpc("tools/list");
    expect(list.result.tools.map((t: { name: string }) => t.name)).toEqual([
      "list_routines",
      "create_routine",
      "create_watch",
      "update_routine",
      "delete_routine",
      "run_routine_now",
    ]);
  });

  it("list_routines renders the schedule in words the model can read back", async () => {
    const res = await callTool("list_routines", {});
    const text = textOf(res);
    expect(text).toContain("Weekly footprint scan");
    expect(text).toContain("Monday at 09:00");
    expect(text).toContain("rt-1");
    expect(lastAuth).toBe(`Bearer ${TOKEN}`);
  });

  it("scopes every call to the calling bot, so the harness can enforce ownership", async () => {
    await callTool("list_routines", {});
    expect(lastUrl).toContain(`botId=${BOT}`);
  });

  it("create_routine posts the canonical daily schedule the manager expects", async () => {
    nextResponse = { status: 201, body: { routine: WEEKLY } };
    const res = await callTool("create_routine", {
      name: "Weekly footprint scan",
      prompt: "Re-scan and report the diff.",
      schedule: { type: "daily", time: "09:00", weekdays: [1] },
      duration_minutes: 45,
    });
    expect(lastMethod).toBe("POST");
    expect(lastBody).toMatchObject({
      name: "Weekly footprint scan",
      prompt: "Re-scan and report the diff.",
      schedule: { type: "daily", time: "09:00", weekdays: [1] },
      durationMinutes: 45,
    });
    // The bot must be able to state the schedule it just created.
    expect(textOf(res)).toContain("Monday at 09:00");
  });

  it("omitting weekdays means every day, not an empty schedule", async () => {
    nextResponse = { status: 201, body: { routine: WEEKLY } };
    await callTool("create_routine", {
      name: "Daily check",
      prompt: "Check.",
      schedule: { type: "daily", time: "07:30" },
    });
    expect(lastBody.schedule).toEqual({ type: "daily", time: "07:30", weekdays: [0, 1, 2, 3, 4, 5, 6] });
  });

  it("reads a one-off date-time as local wall clock, matching the scheduler", async () => {
    nextResponse = { status: 201, body: { routine: WEEKLY } };
    await callTool("create_routine", {
      name: "One-off",
      prompt: "Do it once.",
      schedule: { type: "once", at: "2026-08-25T09:00" },
    });
    expect(lastBody.schedule).toEqual({ type: "once", at: new Date(2026, 7, 25, 9, 0).getTime() });
  });

  it("rejects a 12-hour time instead of silently scheduling the wrong moment", async () => {
    const res = await callTool("create_routine", {
      name: "Bad",
      prompt: "x",
      schedule: { type: "daily", time: "9:00 AM" },
    });
    expect(res.result.isError).toBe(true);
    expect(textOf(res)).toContain("HH:MM");
  });

  it("rejects an out-of-range weekday with the numbering spelled out", async () => {
    const res = await callTool("create_routine", {
      name: "Bad",
      prompt: "x",
      schedule: { type: "daily", time: "09:00", weekdays: [7] },
    });
    expect(res.result.isError).toBe(true);
    expect(textOf(res)).toContain("0=Sunday");
  });

  it("rejects an unparseable one-off date", async () => {
    const res = await callTool("create_routine", {
      name: "Bad",
      prompt: "x",
      schedule: { type: "once", at: "next Tuesday" },
    });
    expect(res.result.isError).toBe(true);
    expect(textOf(res)).toContain("schedule.at");
  });

  it("surfaces the harness's per-bot cap as a tool error the model can act on", async () => {
    nextResponse = { status: 409, body: { error: "you already have 25 routines and the cap is 25 — delete or pause one" } };
    const res = await callTool("create_routine", {
      name: "One too many",
      prompt: "x",
      schedule: { type: "daily", time: "09:00" },
    });
    expect(res.result.isError).toBe(true);
    expect(textOf(res)).toContain("cap is 25");
  });

  it("update_routine sends only the fields that changed", async () => {
    nextResponse = { status: 200, body: { routine: { ...WEEKLY, enabled: false } } };
    const res = await callTool("update_routine", { routine_id: "rt-1", enabled: false });
    expect(lastMethod).toBe("PATCH");
    expect(lastUrl.startsWith("/api/internal/routines/rt-1?")).toBe(true);
    expect(lastBody).toEqual({ enabled: false });
    expect(textOf(res)).toContain("[PAUSED]");
  });

  it("update_routine needs at least one change", async () => {
    const res = await callTool("update_routine", { routine_id: "rt-1" });
    expect(res.result.isError).toBe(true);
  });

  it("delete_routine and run_routine_now hit the right verbs", async () => {
    nextResponse = { status: 200, body: { ok: true } };
    await callTool("delete_routine", { routine_id: "rt-1" });
    expect(lastMethod).toBe("DELETE");

    nextResponse = { status: 201, body: { run: { id: "run-1" } } };
    const res = await callTool("run_routine_now", { routine_id: "rt-1" });
    expect(lastMethod).toBe("POST");
    expect(lastUrl.startsWith("/api/internal/routines/rt-1/run?")).toBe(true);
    // The run is a detached task, and the model must not wait for output.
    expect(textOf(res)).toContain("not come back to you here");
  });

  it("create_watch posts an interval routine flagged as a watch", async () => {
    const WATCH = { ...WEEKLY, name: "New issues", watch: true, schedule: { type: "interval", everyMinutes: 30 } };
    nextResponse = { status: 201, body: { routine: WATCH } };
    const res = await callTool("create_watch", {
      name: "New issues",
      prompt: "Check the tracker.",
      every_minutes: 30,
    });
    expect(lastBody).toMatchObject({
      name: "New issues",
      prompt: "Check the tracker.",
      watch: true,
      schedule: { type: "interval", everyMinutes: 30 },
    });
    // The bot must say what it actually set up, including the quiet contract.
    expect(textOf(res)).toContain("only speak up when something changes");
    expect(textOf(res)).toContain("every 30 min");
  });

  it("rejects a cadence outside the server's floor and ceiling", async () => {
    for (const every_minutes of [1, 5000]) {
      const res = await callTool("create_watch", { name: "x", prompt: "y", every_minutes });
      expect(res.result.isError).toBe(true);
      expect(textOf(res)).toContain("between 5 and 1440");
    }
  });

  it("renders an hourly interval as hours, not minutes", async () => {
    nextResponse = {
      status: 201,
      body: { routine: { ...WEEKLY, schedule: { type: "interval", everyMinutes: 120 }, nextRunAt: null } },
    };
    const res = await callTool("create_routine", {
      name: "Two-hourly",
      prompt: "x",
      schedule: { type: "interval", every_minutes: 120 },
    });
    expect(lastBody.schedule).toEqual({ type: "interval", everyMinutes: 120 });
    expect(textOf(res)).toContain("every 2h");
  });

  it("rejects unknown tools with -32602", async () => {
    const res = await rpc("tools/call", { name: "made_up", arguments: {} });
    expect(res.error.code).toBe(-32602);
  });

  it("requires name and prompt", async () => {
    const res = await callTool("create_routine", { name: "", prompt: "", schedule: { type: "daily", time: "09:00" } });
    expect(res.result.isError).toBe(true);
  });
});
