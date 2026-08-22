// Unattended work a bot sets up for itself, and the skills it keeps.
//
// The unit tests in drivers/routines-proxy.test.ts pin the tool surface and
// the schedule parsing; this pins the WIRING, which is the part that silently
// rots — and the part whose absence is invisible in chat. Without it a model
// asked to "scan every Monday" reaches for its host CLI's own scheduler or a
// shell cron, reports "set up", and nothing ever fires. So this test is
// written to fail in exactly those cases:
//
//   1. the routines integration must actually reach the agent as MCP tools,
//      and a create_routine call must land on the real calendar with the
//      right owner and schedule
//   2. the calendar a bot can see must be scoped to itself — one bot must
//      never list, retime, or delete a peer's unattended work
//   3. skills and teach-from-task must work on an engine that is not
//      DeepSeek, which is the gate that hid both for everyone else
import { spawn, type ChildProcess } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SERVER_DIR = dirname(fileURLToPath(import.meta.url));
const FAKE_CLI = join(SERVER_DIR, "testing", "fake-acp-cli.ts");
const PORT = 18800 + Math.floor(Math.random() * 10_000);
const BASE = `http://127.0.0.1:${PORT}`;

describe("self-scheduling e2e (fake ACP agent)", () => {
  let child: ChildProcess;
  let home: string;
  let stderr = "";

  const api = async (method: string, path: string, body?: unknown): Promise<{ status: number; body: any }> => {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json() };
  };

  /** Wait for the bot's turn to settle — the routine is written during the
   * turn, so polling the calendar directly would race the tool call. */
  const waitIdle = async (botId: string, ms = 30_000) => {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      const { body } = await api("GET", "/api/bots");
      const bot = (body.bots ?? []).find((b: { id: string }) => b.id === botId);
      if (bot && !bot.busy) return true;
      await new Promise((r) => setTimeout(r, 200));
    }
    return false;
  };

  const lastText = async (threadId: string) => {
    const { body } = await api("GET", `/api/threads/${threadId}/messages`);
    const texts = (body.messages ?? []).filter((m: { role: string; kind: string }) => m.role === "bot" && m.kind === "text");
    return (texts.at(-1)?.text ?? "") as string;
  };

  beforeAll(async () => {
    chmodSync(FAKE_CLI, 0o755);
    home = mkdtempSync(join(tmpdir(), "mauscrew-schedule-test-"));
    mkdirSync(join(home, ".mauscrew"), { recursive: true });
    writeFileSync(
      join(home, ".mauscrew", "config.json"),
      JSON.stringify({
        instances: {
          scheduler: {
            driver: "grokAgent",
            environment: { FAKE_ACP_MODE: "schedule-self" },
            config: { cli: FAKE_CLI, fullAuto: true },
          },
          // A bot that just answers. The skills and teach cases need a
          // finished task without also filling the calendar the routine
          // cases assert on.
          plain: {
            driver: "grokAgent",
            environment: { FAKE_ACP_MODE: "happy" },
            config: { cli: FAKE_CLI, fullAuto: true },
          },
        },
      }),
    );

    child = spawn(process.execPath, [join(SERVER_DIR, "index.ts")], {
      cwd: join(SERVER_DIR, ".."),
      env: {
        ...(process.env.PATH ? { PATH: process.env.PATH } : {}),
        // without SystemRoot, winsock fails to initialize in the child
        ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
        HOME: home,
        USERPROFILE: home,
        MAUSCREW_PORT: String(PORT),
        MAUSCREW_DISABLE_LOCAL_VM: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stderr!.on("data", (c) => (stderr += c));

    const deadline = Date.now() + 20_000;
    for (;;) {
      try {
        const res = await fetch(`${BASE}/api/health`);
        if (res.ok) break;
      } catch {
        /* not up yet */
      }
      if (Date.now() > deadline) throw new Error(`server never came up. stderr:\n${stderr}`);
      if (child.exitCode !== null) throw new Error(`server exited ${child.exitCode}. stderr:\n${stderr}`);
      await new Promise((r) => setTimeout(r, 150));
    }
  }, 30_000);

  afterAll(async () => {
    child?.kill();
  });

  /** A bot on the plain engine — never touches the routines calendar. */
  const plainBot = async (name: string) => {
    const bot = (await api("POST", "/api/bots")).body.bot;
    await api("PATCH", `/api/bots/${bot.id}`, {
      name,
      hidden: true,
      modelSelection: { instanceId: "plain", model: "grok-4.6" },
    });
    return bot;
  };

  // Skills and Teach used to 409 for every engine but DeepSeek, which is what
  // made "teach a task" look like a missing feature rather than a gated one.
  // A grokAgent bot is the check that the gate is gone.
  it("gives a non-DeepSeek bot a skills home instead of demanding a workspace", async () => {
    const bot = await plainBot("Skiller");
    const list = await api("GET", `/api/bots/${bot.id}/skills`);
    expect(list.status).toBe(200);
    expect(list.body.workspacePath).toBeTruthy();
    expect(list.body.skills).toEqual([]);

    const created = await api("POST", `/api/bots/${bot.id}/skills`, {
      name: "weekly-report",
      description: "Assemble the Monday status report.",
      whenToUse: "The user asks for the weekly status.",
      instructions: "1. Gather the week's commits.",
    });
    expect(created.status).toBe(201);
    expect((await api("GET", `/api/bots/${bot.id}/skills`)).body.skills).toHaveLength(1);
  });

  it("drafts a skill from the task a non-DeepSeek bot just ran", async () => {
    const bot = await plainBot("Teacher");
    await api("POST", `/api/bots/${bot.id}/messages`, { text: "file the quarterly numbers" });
    expect(await waitIdle(bot.id)).toBe(true);

    const draft = await api("POST", `/api/bots/${bot.id}/teach-draft`);
    expect(draft.status).toBe(200);
    expect(draft.body.draft.name).toMatch(/^[a-z0-9-]+$/);
    expect(draft.body.draft.instructions).toContain("Demonstrated workflow");
    // The draft is reviewable input to the same store, not a separate format.
    const saved = await api("POST", `/api/bots/${bot.id}/skills`, draft.body.draft);
    expect(saved.status).toBe(201);
  });

  it("seals the internal routine endpoints behind the boot token", async () => {
    const list = await api("GET", "/api/internal/routines?botId=x");
    expect(list.status).toBe(401);
    const create = await api("POST", "/api/internal/routines?botId=x", { name: "x", prompt: "y" });
    expect(create.status).toBe(401);
  });

  it(
    "puts a bot's own routine on the Automations calendar, owned and scheduled correctly",
    async () => {
      const seeded = (await api("GET", "/api/bots")).body.bots[0];
      await api("PATCH", `/api/bots/${seeded.id}`, { hidden: true });
      const selection = { instanceId: "scheduler", model: "grok-4.6" };
      const bot = (await api("POST", "/api/bots")).body.bot;
      await api("PATCH", `/api/bots/${bot.id}`, { name: "Scheduler", modelSelection: selection });

      const before = (await api("GET", "/api/routines")).body.routines;
      expect(before).toEqual([]);

      await api("POST", `/api/bots/${bot.id}/messages`, { text: "scan me every Monday morning" });
      expect(await waitIdle(bot.id)).toBe(true);

      const { routines } = (await api("GET", "/api/routines")).body;
      expect(routines).toHaveLength(1);
      expect(routines[0]).toMatchObject({
        name: "Weekly footprint scan",
        botId: bot.id,
        enabled: true,
        schedule: { type: "daily", time: "09:00", weekdays: [1] },
      });
      // A schedule with no next occurrence is a schedule that never fires.
      expect(new Date(routines[0].nextRunAt).getDay()).toBe(1);
      expect(routines[0].nextRunAt).toBeGreaterThan(Date.now());

      // and the agent could read its own calendar back
      expect(await lastText(bot.threadId)).toContain("Monday at 09:00");
    },
    60_000,
  );

  it(
    "scopes the calendar to the calling bot, so peers cannot see each other's work",
    async () => {
      const selection = { instanceId: "scheduler", model: "grok-4.6" };
      const peer = (await api("POST", "/api/bots")).body.bot;
      await api("PATCH", `/api/bots/${peer.id}`, { name: "Peer", modelSelection: selection });

      await api("POST", `/api/bots/${peer.id}/messages`, { text: "you too" });
      expect(await waitIdle(peer.id)).toBe(true);

      // Two routines exist globally...
      const { routines } = (await api("GET", "/api/routines")).body;
      expect(routines).toHaveLength(2);
      expect(new Set(routines.map((r: { botId: string }) => r.botId)).size).toBe(2);

      // ...but list_routines showed the peer only its own one. Both routines
      // carry the same name, so a leak would show the line twice.
      const text = await lastText(peer.threadId);
      expect(text.match(/Weekly footprint scan/g) ?? []).toHaveLength(1);
    },
    60_000,
  );
});
