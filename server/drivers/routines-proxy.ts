// Self-scheduling MCP proxy — spawned as an MCP server inside a bot's agent
// process (via the "routines" integration). It lets a bot put its own
// recurring work on the Automations calendar instead of describing a
// schedule in chat and leaving the user to type it into the UI:
//
//   list_routines()                   → this bot's schedules and their next run
//   create_routine(name, prompt, …)   → a new entry on the calendar
//   update_routine(routine_id, …)     → retime, rewrite, pause, or resume one
//   delete_routine(routine_id)        → retire one
//   run_routine_now(routine_id)       → fire a single run immediately
//
// Everything routes back through the harness, which stays the single owner of
// the scheduler, the run receipts, and the turns a routine spawns. Ownership
// is re-derived there from MAUSCREW_BOT_ID: a bot can only see and change its
// OWN routines, never a peer's unattended work.
//
// Speaks raw JSON-RPC 2.0 over stdio (no MCP SDK — house style, matches
// agents-proxy / computer-proxy). All state comes from env, injected by the
// harness when it builds the integration:
//   MAUSCREW_HARNESS_URL  base URL of the harness (http://127.0.0.1:8799)
//   MAUSCREW_BOT_ID       the calling bot's id — the owner of every routine here
//   MAUSCREW_COMMS_TOKEN  shared secret for the localhost-only internal endpoints
import readline from "node:readline";

const HARNESS = process.env.MAUSCREW_HARNESS_URL ?? "http://127.0.0.1:8799";
const BOT_ID = process.env.MAUSCREW_BOT_ID ?? "";
const TOKEN = process.env.MAUSCREW_COMMS_TOKEN ?? "";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Repeated verbatim in create_routine and update_routine: the model only sees
// the schema of the tool it is calling, so the weekday numbering and the
// local-time rule have to be present in both.
const SCHEDULE_SCHEMA = {
  type: "object",
  description:
    'When to run, in the user\'s local timezone. Recurring: {"type":"daily","time":"09:00","weekdays":[1]} runs every Monday at 09:00. Sub-daily: {"type":"interval","every_minutes":30} runs every half hour. One-off: {"type":"once","at":"2026-08-25T09:00"}.',
  properties: {
    type: {
      type: "string",
      enum: ["daily", "interval", "once"],
      description: '"daily" for a wall-clock schedule, "interval" for every N minutes, "once" for a single run.',
    },
    every_minutes: {
      type: "integer",
      minimum: 5,
      maximum: 1440,
      description: "Interval only. Minutes between runs, 5–1440.",
    },
    time: { type: "string", description: 'Recurring only. 24-hour local wall-clock time, "HH:MM" — for example "09:00".' },
    weekdays: {
      type: "array",
      items: { type: "integer", minimum: 0, maximum: 6 },
      description:
        "Recurring only. Which days to run on: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday. Omit for every day.",
    },
    at: { type: "string", description: 'One-off only. Local date-time, "YYYY-MM-DDTHH:MM" — for example "2026-08-25T09:00".' },
  },
  required: ["type"],
};

const PROMPT_FIELD = {
  type: "string",
  description:
    "The full instruction the bot will receive when this routine fires. It runs unattended in a fresh task with no memory of this conversation, so restate every fact it needs: what to do, what was found last time, what counts as a change, and what to report. Write it in the language the user speaks.",
};

const TOOLS = [
  {
    name: "list_routines",
    description:
      "List your own scheduled routines on the MausCrew Automations calendar, with their schedule, next run time, and whether they are paused. Call this before creating a routine so you don't add a duplicate, and before updating or deleting one so you have its id.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "create_routine",
    description:
      "Put recurring or future work on your own Automations calendar. Use this whenever the user asks for something to happen on a schedule — 'every Monday morning', 'check this daily', 'remind me next Tuesday'. The routine appears in the app's Automations page immediately and runs unattended as its own task; it does NOT expire. Do not ask the user to add it manually, and do not fall back to a shell cron or the host CLI's own scheduler — neither is wired to this app. Confirm the schedule you created in your reply.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Short label shown on the calendar, such as 'Weekly footprint scan'." },
        prompt: PROMPT_FIELD,
        schedule: SCHEDULE_SCHEMA,
        duration_minutes: {
          type: "integer",
          description: "How long the run may take, 15–240. Defaults to 30.",
        },
      },
      required: ["name", "prompt", "schedule"],
    },
  },
  {
    name: "create_watch",
    description:
      "Watch something and speak up only when it changes — 'tell me when a new issue is filed', 'let me know if that page updates', 'ping me on new mail from Ayşe'. A watch is a routine that runs on an interval, is handed its own previous report, and answers with the delta. Prefer this over create_routine whenever the user cares about CHANGE rather than a report on a fixed clock. Check what the user's connected apps can already see before promising to watch something you cannot reach.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Short label, such as 'New GitHub issues'." },
        prompt: {
          type: "string",
          description:
            "How to check, every time. Runs unattended with no memory of this conversation, so name the exact source: the account, repo, label, channel, URL, or search. Describe only the CHECK — the harness adds the compare-with-last-time instruction itself, so do not write one.",
        },
        every_minutes: {
          type: "integer",
          minimum: 5,
          maximum: 1440,
          description: "How often to check, 5–1440 minutes. Pick the loosest cadence that still catches it in time; every check costs a full turn.",
        },
      },
      required: ["name", "prompt", "every_minutes"],
    },
  },
  {
    name: "update_routine",
    description:
      "Change one of your own routines: retime it, rewrite its instruction, rename it, or pause and resume it. Pass only the fields you want to change. Use enabled=false to pause without losing the definition.",
    inputSchema: {
      type: "object",
      properties: {
        routine_id: { type: "string", description: "The routine's id (from list_routines)." },
        name: { type: "string", description: "New label." },
        prompt: PROMPT_FIELD,
        schedule: SCHEDULE_SCHEMA,
        enabled: { type: "boolean", description: "false pauses the routine, true resumes it." },
        duration_minutes: { type: "integer", description: "How long the run may take, 15–240." },
      },
      required: ["routine_id"],
    },
  },
  {
    name: "delete_routine",
    description:
      "Permanently remove one of your own routines from the calendar. Prefer update_routine with enabled=false if the user may want it back.",
    inputSchema: {
      type: "object",
      properties: { routine_id: { type: "string", description: "The routine's id (from list_routines)." } },
      required: ["routine_id"],
    },
  },
  {
    name: "run_routine_now",
    description:
      "Trigger one immediate run of an existing routine without changing its schedule. Useful to show the user what the routine will produce. The run happens in its own task, not in this conversation, so you do not receive its output inline.",
    inputSchema: {
      type: "object",
      properties: { routine_id: { type: "string", description: "The routine's id (from list_routines)." } },
      required: ["routine_id"],
    },
  },
];

type Json = Record<string, unknown>;
const send = (msg: Json) => process.stdout.write(JSON.stringify(msg) + "\n");
const ok = (id: unknown, result: unknown) => send({ jsonrpc: "2.0", id, result });
const rpcErr = (id: unknown, code: number, message: string) => send({ jsonrpc: "2.0", id, error: { code, message } });
const textResult = (id: unknown, text: string, isError = false) =>
  ok(id, { content: [{ type: "text", text }], isError });

async function api(path: string, init?: RequestInit): Promise<Json> {
  const glue = path.includes("?") ? "&" : "?";
  const res = await fetch(`${HARNESS}${path}${glue}botId=${encodeURIComponent(BOT_ID)}`, {
    ...init,
    headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}`, ...(init?.headers ?? {}) },
  });
  const body = (await res.json().catch(() => ({}))) as Json;
  if (!res.ok) throw new Error(String(body.error ?? `HTTP ${res.status}`));
  return body;
}

const when = (ms: number) => new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

/** Render a routine the way the model should read it back to the user:
 * the schedule in words, the next run as a local wall-clock time. */
function describe(routine: Json): string {
  const schedule = (routine.schedule ?? {}) as Json;
  let timing: string;
  if (schedule.type === "once") {
    timing = `once on ${when(Number(schedule.at))}`;
  } else if (schedule.type === "interval") {
    const every = Number(schedule.everyMinutes);
    timing = every % 60 === 0 ? `every ${every / 60}h` : `every ${every} min`;
  } else {
    const days = (schedule.weekdays as number[] | undefined) ?? [];
    const which = days.length === 0 || days.length === 7 ? "every day" : days.map((d) => WEEKDAYS[d] ?? d).join(", ");
    timing = `${which} at ${schedule.time}`;
  }
  const next = routine.nextRunAt ? `, next run ${when(Number(routine.nextRunAt))}` : "";
  const paused = routine.enabled === false ? " [PAUSED]" : "";
  const kind = routine.watch ? " (watch — reports only changes)" : "";
  return `- ${routine.name} — ${timing}${next}${kind}${paused} [id: ${routine.id}]`;
}

/** Accept what a model naturally writes and hand the harness what it needs.
 *
 * The failures here are the ones worth spending a round trip on: a bad
 * weekday number or a 12-hour time silently schedules the wrong moment, and
 * the bot would report success. Reject them with the correction inline. */
function parseSchedule(raw: unknown): Json {
  const schedule = (raw ?? {}) as Json;
  const type = String(schedule.type ?? "").trim().toLowerCase();
  if (type === "once") {
    const at = schedule.at;
    // A date-time with no offset is local per the ES spec, which is exactly
    // the wall-clock semantics the scheduler uses.
    const ms = typeof at === "number" ? at : Date.parse(String(at ?? ""));
    if (!Number.isFinite(ms)) {
      throw new Error('For a one-off routine, schedule.at must be a local date-time such as "2026-08-25T09:00".');
    }
    return { type: "once", at: ms };
  }
  if (type === "interval") {
    const every = Math.round(Number(schedule.every_minutes ?? schedule.everyMinutes));
    if (!Number.isFinite(every) || every < 5 || every > 1440) {
      throw new Error("For an interval routine, schedule.every_minutes must be between 5 and 1440 minutes.");
    }
    return { type: "interval", everyMinutes: every };
  }
  if (type === "daily" || type === "weekly" || type === "recurring") {
    const time = String(schedule.time ?? "").trim();
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      throw new Error('schedule.time must be a 24-hour local time in HH:MM form, such as "09:00" or "17:30".');
    }
    return { type: "daily", time, weekdays: parseWeekdays(schedule.weekdays) };
  }
  throw new Error('schedule.type must be "daily" for a recurring routine or "once" for a single run.');
}

function parseWeekdays(raw: unknown): number[] {
  if (raw == null) return [0, 1, 2, 3, 4, 5, 6];
  if (!Array.isArray(raw)) throw new Error("schedule.weekdays must be an array of day numbers, 0=Sunday through 6=Saturday.");
  const days = [...new Set(raw.map(Number))];
  if (days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    throw new Error("schedule.weekdays must contain only 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday.");
  }
  return days.length ? days.sort() : [0, 1, 2, 3, 4, 5, 6];
}

async function callTool(name: string, args: Json): Promise<{ text: string; isError?: boolean }> {
  if (name === "list_routines") {
    const r = await api("/api/internal/routines");
    const mine = (r.routines as Json[]) ?? [];
    if (!mine.length) return { text: "You have no scheduled routines yet. Use create_routine to add one." };
    return { text: `Your routines on the Automations calendar:\n${mine.map(describe).join("\n")}` };
  }

  if (name === "create_routine") {
    const label = String(args.name ?? "").trim();
    const prompt = String(args.prompt ?? "").trim();
    if (!label || !prompt) return { text: "create_routine needs both name and prompt.", isError: true };
    const body: Json = { name: label, prompt, schedule: parseSchedule(args.schedule) };
    if (args.duration_minutes != null) body.durationMinutes = Number(args.duration_minutes);
    const r = await api("/api/internal/routines", { method: "POST", body: JSON.stringify(body) });
    const routine = (r.routine ?? {}) as Json;
    return { text: `Added to the Automations calendar:\n${describe(routine)}` };
  }

  if (name === "create_watch") {
    const label = String(args.name ?? "").trim();
    const prompt = String(args.prompt ?? "").trim();
    if (!label || !prompt) return { text: "create_watch needs both name and prompt.", isError: true };
    const body: Json = {
      name: label,
      prompt,
      schedule: parseSchedule({ type: "interval", every_minutes: args.every_minutes }),
      watch: true,
    };
    const r = await api("/api/internal/routines", { method: "POST", body: JSON.stringify(body) });
    const routine = (r.routine ?? {}) as Json;
    return {
      text: `Watching, and I'll only speak up when something changes:\n${describe(routine)}`,
    };
  }

  if (name === "update_routine") {
    const id = String(args.routine_id ?? "").trim();
    if (!id) return { text: "update_routine needs routine_id.", isError: true };
    const body: Json = {};
    if (typeof args.name === "string" && args.name.trim()) body.name = args.name.trim();
    if (typeof args.prompt === "string" && args.prompt.trim()) body.prompt = args.prompt.trim();
    if (args.schedule != null) body.schedule = parseSchedule(args.schedule);
    if (typeof args.enabled === "boolean") body.enabled = args.enabled;
    if (args.duration_minutes != null) body.durationMinutes = Number(args.duration_minutes);
    if (!Object.keys(body).length) return { text: "update_routine needs at least one field to change.", isError: true };
    const r = await api(`/api/internal/routines/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) });
    const routine = (r.routine ?? {}) as Json;
    return { text: `Updated:\n${describe(routine)}` };
  }

  if (name === "delete_routine") {
    const id = String(args.routine_id ?? "").trim();
    if (!id) return { text: "delete_routine needs routine_id.", isError: true };
    await api(`/api/internal/routines/${encodeURIComponent(id)}`, { method: "DELETE" });
    return { text: "Removed from the Automations calendar." };
  }

  if (name === "run_routine_now") {
    const id = String(args.routine_id ?? "").trim();
    if (!id) return { text: "run_routine_now needs routine_id.", isError: true };
    await api(`/api/internal/routines/${encodeURIComponent(id)}/run`, { method: "POST", body: "{}" });
    return { text: "Queued one run now — it appears as its own task, so its output will not come back to you here." };
  }

  return { text: `Unknown tool: ${name}`, isError: true };
}

async function handle(msg: Json) {
  const id = msg.id;
  const method = msg.method as string | undefined;
  if (!method) return;
  const params = (msg.params ?? {}) as Json;
  switch (method) {
    case "initialize":
      ok(id, {
        protocolVersion: (params.protocolVersion as string) ?? "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "mauscrew-routines", version: "0.1.0" },
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
      const name = params.name as string;
      if (!TOOLS.some((t) => t.name === name)) return rpcErr(id, -32602, `Unknown tool: ${name}`);
      try {
        const { text, isError } = await callTool(name, (params.arguments ?? {}) as Json);
        textResult(id, text, isError);
      } catch (e) {
        textResult(id, (e as Error).message, true);
      }
      return;
    }
    default:
      if (id !== undefined) rpcErr(id, -32601, `Method not found: ${method}`);
  }
}

const rl = readline.createInterface({ input: process.stdin, terminal: false });
rl.on("line", (line) => {
  const t = line.trim();
  if (!t) return;
  let msg: Json;
  try {
    msg = JSON.parse(t) as Json;
  } catch {
    return;
  }
  void handle(msg).catch((e) => {
    if (msg.id !== undefined) rpcErr(msg.id, -32603, (e as Error).message);
  });
});
rl.on("close", () => process.exit(0));
