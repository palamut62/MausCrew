// Live probe 8: force a narrow rate-limit failure and verify one real handover.
const BASE = "http://127.0.0.1:8899";
let pass = 0;
let fail = 0;
const check = (name, ok, detail = "") => {
  console.log(ok ? `PASS  ${name}` : `FAIL  ${name}${detail ? ` :: ${detail}` : ""}`);
  if (ok) pass++; else fail++;
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function api(method, path, body) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: response.status, body: parsed };
}
const botOf = async (id) => (await api("GET", "/api/bots")).body.bots.find((bot) => bot.id === id);
async function waitForOutcome(id, token, timeoutMs = 300_000) {
  const deadline = Date.now() + timeoutMs;
  let bot;
  do {
    bot = await botOf(id);
    const activityNames = (bot?.messages ?? [])
      .filter((message) => message.kind === "activity")
      .map((message) => message.tool?.name ?? "");
    const reply = (bot?.messages ?? []).filter((message) => message.role === "bot" && message.kind === "text").at(-1);
    if (bot && !bot.busy && activityNames.some((name) => /continuing on Codex.*history/i.test(name)) && reply?.text?.includes(token)) {
      return bot;
    }
    await sleep(1_000);
  } while (Date.now() < deadline);
  return bot;
}

const configured = await api("PATCH", "/api/config", {
  claudeGateways: [{
    id: "live-limit",
    label: "Live Limit Probe",
    baseUrl: "http://127.0.0.1:8910",
    authToken: "rig-only-token",
    models: ["claude-sonnet-5"],
  }],
  fallbackChain: ["codex"],
});
check("the isolated rig accepts a rate-limit gateway and Codex fallback", configured.status === 200, `status ${configured.status}`);

const instances = (await api("GET", "/api/instances")).body.instances;
check("the rate-limit gateway is live", instances.some((instance) => instance.instanceId === "claude-live-limit"));
check("Codex is available for handover", instances.some((instance) => instance.instanceId === "codex"));

const created = await api("POST", "/api/bots");
const botId = created.body.bot.id;
const selected = await api("PATCH", `/api/bots/${botId}`, {
  name: `FailoverProbe${Date.now().toString(36).slice(-5)}`,
  modelSelection: { instanceId: "claude-live-limit", model: "claude-sonnet-5" },
});
check("the bot selects the failing gateway", selected.status === 200, `status ${selected.status}`);

const token = `HANDOVER_${Date.now().toString(36).toUpperCase()}`;
const sent = await api("POST", `/api/bots/${botId}/messages`, {
  text: `Reply with exactly ${token}. Do not use tools, files, network, browser, email, calendar, or connected apps.`,
});
check("the failing turn starts", sent.status === 202, `status ${sent.status}`);

const bot = await waitForOutcome(botId, token);
const activityNames = (bot.messages ?? [])
  .filter((message) => message.kind === "activity")
  .map((message) => message.tool?.name ?? "");
const reply = (bot.messages ?? []).filter((message) => message.role === "bot" && message.kind === "text").at(-1);
check("the turn settles after handover", Boolean(bot && !bot.busy), "handover did not settle within five minutes");
check(
  "the transcript names the rate-limit handover and Codex",
  activityNames.some((name) => /rate-limited.*continuing on Codex.*history/i.test(name)),
  JSON.stringify(activityNames.slice(-5)),
);
check("Codex completes the original request", reply?.text?.includes(token) === true, reply?.text?.slice(0, 180));
check("the bot's configured engine is not silently rewritten", bot.modelSelection.instanceId === "claude-live-limit", bot.modelSelection.instanceId);

console.log(`\nlive8: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
