// Live probe 4 — the approval gate: a tool the policy says to ASK about must
// stop the turn behind a card the user answers, and a denial must hold.
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

const scout = (await api("GET", "/api/bots")).body.bots.find((b) => b.name === "Scout");
const thread = (await botOf(scout.id)).threadId;
info(`bot=${scout.name} thread=${thread}`);

// The policy default for shell is ASK, so this must raise a card rather than run.
await api("POST", `/api/bots/${scout.id}/messages`, { text: "Run this exact shell command in your terminal and show me its output: echo probe-gate-check" });

let card = null;
for (let i = 0; i < 60; i++) {
  await sleep(2000);
  const bot = await botOf(scout.id);
  card = (bot.messages ?? []).filter((m) => m.card?.requestId).at(-1);
  if (card) break;
  if (!bot.busy && i > 4) break;
}
check("a shell tool raises an approval card", Boolean(card), "no card with a requestId appeared");
if (card) {
  info(`card: tool=${card.card.tool} title="${card.card.title}" options=${JSON.stringify(card.card.options)}`);
  check("the card names the tool it is gating", Boolean(card.card.tool), JSON.stringify(card.card).slice(0, 160));
  check("the card is unanswered while it waits", !card.card.answered, `answered=${card.card.answered}`);

  const denied = await api("POST", `/api/threads/${thread}/respond`, { requestId: card.card.requestId, behavior: "deny" });
  check("the user can deny it", denied.status === 200, `status ${denied.status} ${JSON.stringify(denied.body).slice(0, 120)}`);

  const stale = await api("POST", `/api/threads/${thread}/respond`, { requestId: card.card.requestId, behavior: "allow" });
  check("the same card cannot be answered twice", stale.status === 409, `status ${stale.status} ${JSON.stringify(stale.body).slice(0, 120)}`);

  // the turn has to end, and the bot has to say the command did not run
  const deadline = Date.now() + 180_000;
  let bot;
  for (;;) {
    bot = await botOf(scout.id);
    if (!bot.busy) break;
    if (Date.now() > deadline) break;
    await sleep(2000);
  }
  check("the turn settles after the denial", !bot.busy, "the bot is still busy three minutes later");
  const said = (bot.messages ?? []).filter((m) => m.role === "bot" && m.kind === "text").at(-1)?.text ?? "";
  info(`bot after denial: ${said.slice(0, 220)}`);
  const ranAnyway = (bot.messages ?? []).some((m) => (m.text ?? "").includes("probe-gate-check\n") || (m.tool?.name ?? "").includes("probe-gate-check"));
  check("the denied command did not run", !ranAnyway, "output of the denied command showed up");

  const answered = (await botOf(scout.id)).messages.find((m) => m.card?.requestId === card.card.requestId);
  check("the card records the answer", answered?.card?.answered === "deny", `answered=${answered?.card?.answered}`);
}

// the audit trail must carry the decision
const audit = (await api("GET", "/api/security/audit?limit=20")).body;
const rows = audit.records ?? audit.audit ?? audit.entries ?? [];
const denials = rows.filter((r) => String(r.decision ?? "").toLowerCase().includes("deny"));
check("the denial is in the audit log", denials.length >= 1, `decisions seen: ${rows.map((r) => r.decision).slice(0, 8).join(",")}`);
info(`audit sample: ${JSON.stringify(rows[0] ?? {}).slice(0, 200)}`);

console.log(`\nlive4: ${pass} passed, ${fail} failed`);
