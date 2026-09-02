// Live probe 3 — the automation loop with a real engine: a bot schedules
// itself, and a scheduled routine fires unattended and produces work.
const BASE = "http://127.0.0.1:8899";
let pass = 0, fail = 0;
const check = (n, ok, d = "") => { const l = ok ? `PASS  ${n}` : `FAIL  ${n}${d ? ` :: ${d}` : ""}`; if (ok) pass++; else fail++; console.log(l); return ok; };
const info = (m) => console.log(`INFO  ${m}`);
async function api(method, path, body, attempt = 0) {
  try {
    const res = await fetch(`${BASE}${path}`, { method, headers: body !== undefined ? { "content-type": "application/json" } : undefined, body: body === undefined ? undefined : JSON.stringify(body) });
    const t = await res.text(); let b; try { b = JSON.parse(t); } catch { b = t; }
    return { status: res.status, body: b };
  } catch (e) { if (attempt < 4) { await new Promise((r) => setTimeout(r, 700)); return api(method, path, body, attempt + 1); } throw e; }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const botOf = async (id) => (await api("GET", "/api/bots")).body.bots.find((b) => b.id === id);
async function waitIdle(id, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const b = await botOf(id); if (b && !b.busy) return { bot: b, waited: Date.now() - t0 }; await sleep(1500); }
  return { bot: await botOf(id), waited: Date.now() - t0, timedOut: true };
}

const scout = (await api("GET", "/api/bots")).body.bots.find((b) => b.name === "Scout");
info(`scout=${scout.id}`);

// ── 1. the bot puts work on its own calendar ────────────────────────────
{
  const before = (await api("GET", "/api/routines")).body.routines.length;
  await api("POST", `/api/bots/${scout.id}/messages`, {
    text: 'Use your automations tools to schedule a routine for yourself named "Probe daily" that runs every day at 09:00 with the prompt "Check the probe log". Then reply with the routine name only.',
  });
  const idle = await waitIdle(scout.id, 300_000);
  check("the self-scheduling turn completes", !idle.timedOut, `busy after ${Math.round(idle.waited / 1000)}s`);
  const routines = (await api("GET", "/api/routines")).body.routines;
  const mine = routines.find((r) => r.name.toLowerCase().includes("probe daily"));
  check("the bot scheduled itself", Boolean(mine), `routines ${before} -> ${routines.length}: ${routines.map((r) => r.name).join(" | ")}`);
  if (mine) {
    check("the routine belongs to the bot that made it", mine.botId === scout.id, `owner ${mine.botId}`);
    check("it has a real next run", typeof mine.nextRunAt === "number" && mine.nextRunAt > Date.now(), `nextRunAt ${mine.nextRunAt}`);
    info(`scheduled: ${mine.name} ${JSON.stringify(mine.schedule)} next=${new Date(mine.nextRunAt).toISOString()}`);
  }
}

// ── 2. a scheduled routine fires on its own and runs a real turn ────────
{
  const created = await api("POST", "/api/routines", {
    name: "Probe tick",
    prompt: "Reply with exactly one word: TICK",
    botId: scout.id,
    runOn: "maus",
    enabled: true,
    schedule: { type: "interval", everyMinutes: 1 },
    durationMinutes: 3,
  });
  const routine = created.body.routine;
  check("an interval routine is accepted", created.status === 201, `status ${created.status}`);
  info(`waiting for the schedule to fire (next=${new Date(routine.nextRunAt).toISOString()}, now=${new Date().toISOString()})`);

  let run = null;
  const deadline = Date.now() + 240_000;
  while (Date.now() < deadline) {
    await sleep(5000);
    const runs = (await api("GET", "/api/routines")).body.runs ?? [];
    run = runs.find((r) => r.routineId === routine.id && r.trigger !== "manual");
    if (run && ["completed", "failed", "cancelled"].includes(run.status)) break;
    if (run) info(`  run ${run.status}...`);
  }
  check("the schedule fired without anyone asking", Boolean(run), "no scheduled run appeared within 4 minutes");
  check("the unattended run completed", run?.status === "completed", `status ${run?.status} error=${String(run?.error ?? "").slice(0, 120)}`);
  info(`run summary: ${String(run?.summary ?? run?.result ?? "").slice(0, 160)}`);
  check("the unattended turn produced the answer", /tick/i.test(JSON.stringify(run ?? {})), `run: ${JSON.stringify(run ?? {}).slice(0, 200)}`);

  await api("PATCH", `/api/routines/${routine.id}`, { enabled: false });
  const stopped = (await api("GET", "/api/routines")).body.routines.find((r) => r.id === routine.id);
  check("the routine can be stopped again", stopped?.enabled === false && stopped?.nextRunAt === null, JSON.stringify(stopped ?? {}).slice(0, 140));
  await api("DELETE", `/api/routines/${routine.id}`);
}

console.log(`\nlive3: ${pass} passed, ${fail} failed`);
