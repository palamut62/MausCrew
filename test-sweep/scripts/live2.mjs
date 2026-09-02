// Live probe 2 — the delegated teammate must now be able to report on the
// step it was handed, and to queue outbound work for approval.
const BASE = "http://127.0.0.1:8899";
let pass = 0, fail = 0;
const check = (n, ok, d = "") => { const line = ok ? `PASS  ${n}` : `FAIL  ${n}${d ? ` :: ${d}` : ""}`; if (ok) pass++; else fail++; console.log(line); return ok; };
const info = (m) => console.log(`INFO  ${m}`);
async function api(method, path, body, attempt = 0) {
  try {
    const res = await fetch(`${BASE}${path}`, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const t = await res.text(); let b; try { b = JSON.parse(t); } catch { b = t; }
    return { status: res.status, body: b };
  } catch (e) { if (attempt < 4) { await new Promise((r) => setTimeout(r, 800)); return api(method, path, body, attempt + 1); } throw e; }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const botOf = async (id) => (await api("GET", "/api/bots")).body.bots.find((b) => b.id === id);
async function waitIdle(id, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const bot = await botOf(id);
    if (bot && !bot.busy) return { bot, waited: Date.now() - started };
    await sleep(1500);
  }
  return { bot: await botOf(id), waited: Date.now() - started, timedOut: true };
}

const bots = (await api("GET", "/api/bots")).body.bots;
const chief = bots.find((b) => b.chiefOfStaff);
const scout = bots.find((b) => b.name === "Scout");
info(`chief=${chief?.name} scout=${scout?.name}`);

const before = (await api("GET", "/api/workflows")).body.workflows.length;
const reviewsBefore = (await api("GET", "/api/review-queue")).body.items.length;

await api("POST", `/api/bots/${chief.id}/messages`, {
  text: `Do this in one turn:
1. create_workflow titled "Handoff probe" with one step, id "a", titled "Check the docs", assigned to bot_id ${scout.id}.
2. Then ask_bot Scout with the workflow id and that step's real id, telling it to (a) call update_workflow_step with status done and a one-line output, and (b) call queue_review with title "Handoff note", target "Slack #probe", content one sentence.
3. Reply with the workflow id and whether Scout confirmed both calls.`,
});

const idle = await waitIdle(chief.id, 420_000);
check("the delegating turn completes", !idle.timedOut, `busy after ${Math.round(idle.waited / 1000)}s`);

const workflows = (await api("GET", "/api/workflows")).body.workflows;
check("the chief created the workflow", workflows.length > before, `before ${before} now ${workflows.length}`);
const wf = workflows.find((w) => w.title.toLowerCase().includes("handoff")) ?? workflows[0];
const step = (wf?.steps ?? []).find((s) => s.assigneeBotId === scout.id);
info(`workflow "${wf?.title}" status=${wf?.status} step=${step?.title} status=${step?.status} output=${String(step?.output ?? "").slice(0, 80)}`);
check("the delegated assignee reported its step", step?.status === "done", `step status ${step?.status}`);
check("the report carried output", Boolean(step?.output), `output ${step?.output}`);
check("the workflow closed itself when every step was done", wf?.status === "completed", `workflow status ${wf?.status}`);

const reviews = (await api("GET", "/api/review-queue")).body.items;
const queued = reviews.find((r) => r.sourceBotId === scout.id);
check("the delegated bot could queue a review", Boolean(queued), `reviews before ${reviewsBefore}, now ${reviews.length}, sources ${reviews.map((r) => r.sourceBotId === scout.id ? "scout" : "other").join(",")}`);
if (queued) info(`queued by scout: "${queued.title}" -> ${queued.target} (${queued.status})`);

const scoutBot = await botOf(scout.id);
const scoutTail = JSON.stringify(scoutBot.messages.slice(-10));
check("no recursion leaked into the delegated turn", !scoutTail.includes("one hop"), "a peer call was attempted at depth 1");
info(`scout last words: ${(scoutBot.messages.filter((m) => m.role === "bot" && m.kind === "text").at(-1)?.text ?? "").slice(0, 240)}`);

console.log(`\nlive2: ${pass} passed, ${fail} failed`);
