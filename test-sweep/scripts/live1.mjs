// Live agent probe — real engine turns: reply, tools, delegation, workflow,
// review queue, approval cards. Keeps every prompt tiny.
const BASE = "http://127.0.0.1:8899";
let pass = 0, fail = 0; const out = [];
const check = (n, ok, d = "") => { const line = ok ? `PASS  ${n}` : `FAIL  ${n}${d ? ` :: ${d}` : ""}`; if (ok) pass++; else fail++; out.push(line); console.log(line); return ok; };
const info = (m) => { out.push(`INFO  ${m}`); console.log(`INFO  ${m}`); };
async function api(method, path, body, attempt = 0) {
  try {
    const res = await fetch(`${BASE}${path}`, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const t = await res.text(); let b; try { b = JSON.parse(t); } catch { b = t; }
    return { status: res.status, body: b };
  } catch (error) {
    if (attempt < 4) { await new Promise((r) => setTimeout(r, 800)); return api(method, path, body, attempt + 1); }
    throw error;
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function botOf(id) {
  const bots = (await api("GET", "/api/bots")).body.bots;
  return bots.find((b) => b.id === id);
}
async function waitIdle(id, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const bot = await botOf(id);
    if (bot && !bot.busy) return { bot, waited: Date.now() - started };
    await sleep(1500);
  }
  return { bot: await botOf(id), waited: Date.now() - started, timedOut: true };
}
const textOf = (bot, _threadId) => (bot.messages ?? []).filter((m) => m.role === "bot" && m.kind === "text").map((m) => m.text ?? "").join("\n");

// ── set the stage: a chief on claude and one specialist ──────────────────
const bots = (await api("GET", "/api/bots")).body.bots;
const chief = bots.find((b) => b.chiefOfStaff) ?? bots[0];
const specialist = bots.find((b) => b.id !== chief.id);
await api("PATCH", `/api/bots/${chief.id}`, { name: "Chief", modelSelection: { instanceId: "claude", model: "claude-sonnet-5" }, chiefOfStaff: true });
await api("PATCH", `/api/bots/${specialist.id}`, { name: "Scout", title: "Research", description: "Answers short factual questions.", modelSelection: { instanceId: "claude", model: "claude-sonnet-5" } });
info(`chief=${chief.id} specialist=${specialist.id}`);

// ── 1. a plain turn actually runs on a real engine ───────────────────────
{
  const sent = await api("POST", `/api/bots/${specialist.id}/messages`, { text: "Reply with exactly one word: PONG" });
  check("a message can be sent to a bot", sent.status === 200 || sent.status === 201 || sent.status === 202, `status ${sent.status} ${JSON.stringify(sent.body).slice(0, 120)}`);
  const { bot, waited, timedOut } = await waitIdle(specialist.id, 150_000);
  check("the turn completes", !timedOut, `still busy after ${Math.round(waited / 1000)}s`);
  const reply = textOf(bot);
  check("the engine answered", /pong/i.test(reply), `reply: ${reply.slice(-160)}`);
  info(`turn took ${Math.round(waited / 1000)}s; usage=${JSON.stringify(bot.usage ?? {}).slice(0, 120)}`);
  check("token usage is tallied", Boolean(bot.usage && (bot.usage.input || bot.usage.output || bot.usage.turns)), JSON.stringify(bot.usage ?? {}));
}

// ── 2. delegation: the chief asks the specialist ─────────────────────────
{
  await api("POST", `/api/bots/${chief.id}/messages`, {
    text: "Use ask_bot to ask Scout for the capital of France, then reply with just the city name Scout gave you.",
  });
  const chiefIdle = await waitIdle(chief.id, 240_000);
  check("the chief's delegating turn completes", !chiefIdle.timedOut, `busy after ${Math.round(chiefIdle.waited / 1000)}s`);
  const chiefText = textOf(chiefIdle.bot);
  check("the delegated answer comes back", /paris/i.test(chiefText), `chief said: ${chiefText.slice(-200)}`);
  const scout = await botOf(specialist.id);
  const scoutSaw = JSON.stringify(scout.messages ?? []).toLowerCase();
  check("the specialist actually ran a turn for it", scoutSaw.includes("france") || scoutSaw.includes("paris"), "no trace of the delegated question");
}

// ── 3. workflow: created by the chief, a step reported by the assignee ───
{
  const before = (await api("GET", "/api/workflows")).body.workflows.length;
  await api("POST", `/api/bots/${chief.id}/messages`, {
    text: `Call create_workflow with title "Probe plan" and two steps: step id "a" titled "Collect facts" assigned to bot_id ${specialist.id}, and step id "b" titled "Summarise" assigned to yourself, with b depending on a. Then use ask_bot to tell Scout the workflow id and step id for "Collect facts" and instruct it to call update_workflow_step with status done and a one-line output. Then reply with the workflow id.`,
  });
  const idle = await waitIdle(chief.id, 300_000);
  check("the workflow turn completes", !idle.timedOut, `busy after ${Math.round(idle.waited / 1000)}s`);
  const list = (await api("GET", "/api/workflows")).body.workflows;
  check("a workflow was created by the chief", list.length > before, `before ${before}, now ${list.length}`);
  const wf = list[0];
  info(`workflow: ${wf?.title} status=${wf?.status} steps=${JSON.stringify((wf?.steps ?? []).map((s) => [s.title, s.status, s.assigneeBotId === specialist.id ? "scout" : "chief"]))}`);
  const scoutStep = (wf?.steps ?? []).find((s) => s.assigneeBotId === specialist.id);
  check("the assignee's step is reachable and was updated", scoutStep && scoutStep.status !== "pending", `step status: ${scoutStep?.status ?? "missing"}`);
  check("the assignee's report carries output", Boolean(scoutStep?.output), `output: ${String(scoutStep?.output).slice(0, 100)}`);
}

// ── 4. review queue: a bot queues outbound work instead of sending it ────
{
  const before = (await api("GET", "/api/review-queue")).body.items.length;
  await api("POST", `/api/bots/${chief.id}/messages`, {
    text: 'Draft a one-sentence release note for "MausCrew 0.2" and put it in the review queue with queue_review, target "Slack #releases". Do not send anything.',
  });
  const idle = await waitIdle(chief.id, 240_000);
  check("the queueing turn completes", !idle.timedOut);
  const items = (await api("GET", "/api/review-queue")).body.items;
  check("the draft landed in the review queue", items.length > before, `before ${before}, now ${items.length}`);
  const item = items[0];
  info(`queued: ${item?.title} -> ${item?.target} (${item?.status})`);
  check("the queued item is pending, not sent", item?.status === "pending", `status ${item?.status}`);

  const dismissed = await api("POST", `/api/review-queue/${item.id}/dismiss`);
  check("the user can dismiss it", dismissed.status === 200 && dismissed.body.item.status === "dismissed");
}

// ── 5. permission gate: a shell command must ask ─────────────────────────
{
  await api("POST", `/api/bots/${specialist.id}/messages`, { text: "Run the shell command `echo probe-approval-test` using your terminal tool." });
  let card = null;
  for (let i = 0; i < 40; i++) {
    await sleep(2000);
    const bot = await botOf(specialist.id);
    card = (bot.messages ?? []).reverse().find((m) => m.card || m.kind === "options" || (m.ui && String(m.ui.component).includes("permission")));
    if (card) break;
    if (!bot.busy) break;
  }
  check("a tool that needs permission raises a card", Boolean(card), "no approval card appeared");
  info(`card: ${JSON.stringify(card ?? {}).slice(0, 220)}`);
  if (card?.card?.requestId ?? card?.card?.id) {
    const requestId = card.card.requestId ?? card.card.id;
    const denied = await api("POST", `/api/threads/${(await botOf(specialist.id)).threadId}/respond`, { requestId, behavior: "deny" });
    info(`deny -> ${denied.status} ${JSON.stringify(denied.body).slice(0, 120)}`);
  }
  const idle = await waitIdle(specialist.id, 120_000);
  info(`after the gate the bot settled: busy=${idle.bot?.busy} timedOut=${Boolean(idle.timedOut)}`);
}

console.log(out.join("\n"));
console.log(`\nlive1: ${pass} passed, ${fail} failed`);
