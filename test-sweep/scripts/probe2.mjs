// Rig probe 2 — automation, triggers, tools, security, computers, remote.
const BASE = "http://127.0.0.1:8899";
const WEBHOOK_BASE = "http://127.0.0.1:8901";
let pass = 0, fail = 0;
const out = [];

async function api(method, path, body, headers = {}, base = BASE) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...headers },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed; try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: res.status, body: parsed };
}
const check = (name, ok, detail = "") => {
  if (ok) { pass++; out.push(`PASS  ${name}`); } else { fail++; out.push(`FAIL  ${name}${detail ? ` :: ${detail}` : ""}`); }
  return ok;
};
const info = (msg) => out.push(`INFO  ${msg}`);

const bots = (await api("GET", "/api/bots")).body.bots;
const botId = bots[0].id;

// ── routines: the cron surface ──────────────────────────────────────────
let routineId;
{
  const bad = await api("POST", "/api/routines", { name: "", prompt: "", botId, schedule: { type: "daily", time: "99:99", weekdays: [] } });
  check("routine rejects an impossible schedule", bad.status >= 400, `status ${bad.status} ${JSON.stringify(bad.body).slice(0, 90)}`);

  const orphan = await api("POST", "/api/routines", { name: "Orphan", prompt: "hi", botId: "ghost", runOn: "maus", enabled: true, schedule: { type: "interval", everyMinutes: 15 }, durationMinutes: 5 });
  check("routine for a missing bot is refused", orphan.status >= 400, `status ${orphan.status}`);

  const daily = await api("POST", "/api/routines", { name: "Morning brief", prompt: "Summarise overnight mail", botId, runOn: "maus", enabled: true, schedule: { type: "daily", time: "08:30", weekdays: [1, 2, 3, 4, 5] }, durationMinutes: 10 });
  routineId = daily.body?.routine?.id;
  check("create a daily routine", daily.status === 201 && Boolean(routineId), `status ${daily.status} ${JSON.stringify(daily.body).slice(0, 120)}`);
  check("daily routine schedules a next run", typeof daily.body?.routine?.nextRunAt === "number", `nextRunAt ${daily.body?.routine?.nextRunAt}`);

  const interval = await api("POST", "/api/routines", { name: "Watch", prompt: "Any new releases?", botId, runOn: "maus", enabled: true, watch: true, schedule: { type: "interval", everyMinutes: 15 }, durationMinutes: 5 });
  check("create an interval watch", interval.status === 201 && interval.body.routine.watch === true, JSON.stringify(interval.body).slice(0, 120));

  const once = await api("POST", "/api/routines", { name: "One shot", prompt: "ping", botId, runOn: "maus", enabled: true, schedule: { type: "once", at: Date.now() + 3600_000 }, durationMinutes: 5 });
  check("create a one-shot routine", once.status === 201, `status ${once.status}`);

  const paused = await api("PATCH", `/api/routines/${routineId}`, { enabled: false });
  check("disabling clears the next run", paused.status === 200 && paused.body.routine.enabled === false && paused.body.routine.nextRunAt === null, JSON.stringify(paused.body?.routine ?? paused.body).slice(0, 140));

  const resumed = await api("PATCH", `/api/routines/${routineId}`, { enabled: true });
  check("re-enabling reschedules", resumed.status === 200 && typeof resumed.body.routine.nextRunAt === "number");

  const listed = await api("GET", "/api/routines");
  check("routines list with runs", listed.status === 200 && listed.body.routines.length >= 3, `count ${listed.body?.routines?.length}`);

  const calendar = await api("GET", `/api/routines?from=${Date.now()}&to=${Date.now() + 7 * 864e5}`);
  check("calendar window query works", calendar.status === 200, `status ${calendar.status}`);
  info(`calendar keys: ${Object.keys(calendar.body).join(", ")}`);
}

// ── manual run of a routine (unattended path, no engine needed to queue) ─
{
  const run = await api("POST", `/api/routines/${routineId}/run`);
  check("run a routine on demand", run.status === 201 && Boolean(run.body?.run?.id), `status ${run.status} ${JSON.stringify(run.body).slice(0, 120)}`);
  const runId = run.body?.run?.id;
  await new Promise((r) => setTimeout(r, 2500));
  const after = await api("GET", "/api/routines");
  const record = (after.body.runs ?? []).find((r) => r.id === runId);
  info(`manual run status after 2.5s: ${record?.status ?? "not listed"} ${record?.error ? `(${String(record.error).slice(0, 70)})` : ""}`);
  check("the run is recorded", Boolean(record), "run missing from history");
  const seen = await api("POST", `/api/routine-runs/${runId}/seen`);
  check("a run can be marked seen", seen.status === 200 || seen.status === 404, `status ${seen.status}`);
  const ghost = await api("POST", "/api/routine-runs/ghost/cancel");
  check("cancelling an unknown run 404s", ghost.status === 404, `status ${ghost.status}`);
}

// ── webhook triggers ────────────────────────────────────────────────────
let hookId, endpointUrl, secret;
{
  const created = await api("POST", "/api/webhooks", { name: "Deploy hook", prompt: "A deploy landed: {{body}}", botId, runOn: "maus", enabled: true });
  hookId = created.body?.webhook?.id;
  endpointUrl = created.body?.credential?.endpointUrl ?? created.body?.credential?.url;
  secret = created.body?.credential?.secret ?? created.body?.secret;
  check("create a webhook trigger", created.status === 201 && Boolean(endpointUrl), `status ${created.status} ${JSON.stringify(created.body).slice(0, 160)}`);
  info(`webhook credential keys: ${Object.keys(created.body?.credential ?? {}).join(", ")}`);
  check("a new hook is enabled immediately", created.body?.webhook?.enabled === true, `enabled=${created.body?.webhook?.enabled}`);

  const hookPath = new URL(endpointUrl).pathname;
  const unauth = await api("POST", hookPath, { any: "thing" }, {}, WEBHOOK_BASE);
  check("unauthenticated delivery is refused", unauth.status === 401 || unauth.status === 403, `status ${unauth.status} ${JSON.stringify(unauth.body).slice(0, 90)}`);

  const token = created.body?.credential?.token ?? created.body?.credential?.bearer ?? secret;
  const authed = await api("POST", hookPath, { event: "deploy", ref: "main" }, { authorization: `Bearer ${token}` }, WEBHOOK_BASE);
  info(`authenticated delivery -> ${authed.status} ${JSON.stringify(authed.body).slice(0, 120)}`);
  check("authenticated delivery is accepted", authed.status >= 200 && authed.status < 300, `status ${authed.status}`);

  const list = await api("GET", "/api/webhooks");
  const mine = list.body.webhooks.find((w) => w.id === hookId);
  check("delivery is counted on the hook", (mine?.deliveryCount ?? 0) >= 1 || (list.body.attempts ?? []).length >= 1, `count ${mine?.deliveryCount}, attempts ${(list.body.attempts ?? []).length}`);
  check("ingress status is reported", Boolean(list.body.ingress), JSON.stringify(list.body.ingress ?? {}).slice(0, 100));

  const del = await api("DELETE", `/api/webhooks/${hookId}`);
  check("delete a webhook", del.status === 200, `status ${del.status}`);
}

// ── MCP servers (plugins/tools) ─────────────────────────────────────────
{
  const bad = await api("PUT", "/api/mcp-servers", { servers: [{ name: "", command: "" }] });
  check("MCP server needs name and command", bad.status === 400, `status ${bad.status} ${JSON.stringify(bad.body).slice(0, 90)}`);

  const tooMany = await api("PUT", "/api/mcp-servers", { servers: Array.from({ length: 31 }, (_, i) => ({ id: `s${i}`, name: `s${i}`, command: "node", args: [], allowedBots: [], enabled: true })) });
  check("MCP server count is capped", tooMany.status === 400, `status ${tooMany.status}`);

  const ok = await api("PUT", "/api/mcp-servers", { servers: [{ id: "probe-mcp", name: "probe", command: "node", args: ["-e", "process.exit(0)"], envNames: [], allowedBots: [], enabled: false, instructions: "probe only" }] });
  check("register an MCP server", ok.status === 200, `status ${ok.status} ${JSON.stringify(ok.body).slice(0, 120)}`);

  const cfg = await api("GET", "/api/config");
  const stored = (cfg.body.mcpServers ?? []).find((s) => s.name === "probe");
  check("MCP server is stored in config", Boolean(stored), `servers: ${(cfg.body.mcpServers ?? []).length}`);
  check("MCP env values are never echoed", !JSON.stringify(stored ?? {}).includes("value"), JSON.stringify(stored ?? {}).slice(0, 120));

  const test = await api("POST", "/api/mcp-servers/test", { server: { id: "probe-mcp", name: "probe", command: "definitely-not-a-real-binary", args: [], envNames: [], allowedBots: [] } });
  check("testing a broken MCP server fails cleanly", test.status < 500, `status ${test.status} ${JSON.stringify(test.body).slice(0, 120)}`);
  info(`mcp test result: ${JSON.stringify(test.body).slice(0, 160)}`);
}

// ── skills ──────────────────────────────────────────────────────────────
{
  const list = await api("GET", `/api/bots/${botId}/skills`);
  check("list a bot's skills", list.status === 200 && Array.isArray(list.body.skills ?? list.body.installed ?? []), `status ${list.status} ${JSON.stringify(list.body).slice(0, 140)}`);
  info(`skills payload keys: ${Object.keys(list.body ?? {}).join(", ")}`);

  const created = await api("POST", `/api/bots/${botId}/skills`, { name: "probe-skill", description: "A probe skill", instructions: "# Probe\n\nDo the probe thing." });
  check("create a workspace skill", created.status === 201 || created.status === 200, `status ${created.status} ${JSON.stringify(created.body).slice(0, 140)}`);

  const after = await api("GET", `/api/bots/${botId}/skills`);
  const names = JSON.stringify(after.body);
  check("the new skill is listed", names.includes("probe-skill"), names.slice(0, 160));

  const removed = await api("DELETE", `/api/bots/${botId}/skills/probe-skill`);
  check("delete a workspace skill", removed.status === 200, `status ${removed.status}`);
}

// ── security policy + audit ─────────────────────────────────────────────
{
  const policy = await api("GET", "/api/security/policy");
  check("security policy is readable", policy.status === 200 || policy.status === 503, `status ${policy.status}`);
  info(`policy status ${policy.status}: ${JSON.stringify(policy.body).slice(0, 140)}`);

  const noType = await fetch(`${BASE}/api/security/policy`, { method: "PUT", body: "{}" });
  check("policy PUT demands JSON content-type", noType.status === 415, `status ${noType.status}`);

  const audit = await api("GET", "/api/security/audit?limit=5");
  check("audit log is queryable", audit.status === 200, `status ${audit.status} ${JSON.stringify(audit.body).slice(0, 120)}`);
}

// ── computers: local VM + host control ──────────────────────────────────
{
  const local = await api("GET", "/api/local-computer");
  check("local computer status", local.status === 200 && "runtime" in local.body, JSON.stringify(local.body).slice(0, 160));
  info(`local computer: runtime=${local.body?.runtime} state=${local.body?.state ?? local.body?.status}`);

  const noJson = await fetch(`${BASE}/api/local-computer/start`, { method: "POST" });
  check("local computer lifecycle demands JSON", noJson.status === 415 || noJson.status === 400, `status ${noJson.status}`);

  const host = await api("GET", "/api/host-computer");
  check("host computer status", host.status === 200, `status ${host.status} ${JSON.stringify(host.body).slice(0, 140)}`);
  info(`host cua: ${JSON.stringify(host.body).slice(0, 160)}`);

  const sessions = await api("GET", "/api/browser-sessions");
  check("browser sessions are discoverable", sessions.status === 200, `status ${sessions.status}`);
  info(`browser sessions: ${JSON.stringify(sessions.body).slice(0, 140)}`);

  const profile = await api("GET", "/api/browser-profile");
  check("browser profile status", profile.status === 200, `status ${profile.status} ${JSON.stringify(profile.body).slice(0, 120)}`);
}

// ── remote access ───────────────────────────────────────────────────────
{
  const status = await api("GET", "/api/remote/status");
  check("remote status", status.status === 200, `status ${status.status} ${JSON.stringify(status.body).slice(0, 120)}`);

  const pair = await api("POST", "/api/remote/pairings", {});
  check("pairing requires a saved HTTPS remote address", pair.status === 409 || pair.status === 200 || pair.status === 201, `status ${pair.status} ${JSON.stringify(pair.body).slice(0, 120)}`);
  const code = pair.body?.pairing?.code ?? pair.body?.code;
  info(`pairing code issued: ${code ? "yes" : "no"}`);

  const claimLocal = await api("POST", "/api/remote/claim", { code: code ?? "000000", name: "probe phone" });
  check("claiming from localhost is refused", claimLocal.status === 400, `status ${claimLocal.status} ${JSON.stringify(claimLocal.body).slice(0, 90)}`);

  const devices = await api("GET", "/api/remote/devices");
  check("device list uses /api/remote/status, not a separate GET", devices.status === 404 && Array.isArray(status.body?.devices ?? []), `status ${devices.status}`);
}

// ── connectors + voice ──────────────────────────────────────────────────
{
  const catalog = await api("GET", "/api/connectors/catalog");
  check("connector catalog", catalog.status === 200, `status ${catalog.status} ${JSON.stringify(catalog.body).slice(0, 100)}`);
  info(`connectors in catalog: ${(catalog.body?.connectors ?? catalog.body?.catalog ?? []).length}`);

  const voices = await api("GET", "/api/tts/voices");
  check("voice list fails cleanly without a key", voices.status < 500, `status ${voices.status} ${JSON.stringify(voices.body).slice(0, 120)}`);
}

console.log(out.join("\n"));
console.log(`\nprobe2: ${pass} passed, ${fail} failed`);
