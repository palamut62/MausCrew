// Live probe 7: one deterministic, tool-free turn through each installed engine.
const BASE = process.env.MAUSCREW_BASE_URL ?? "http://127.0.0.1:8899";
const TARGETS = (process.env.MAUSCREW_ENGINE_TARGETS ?? "codex,grok,kimi,droid,opencodeGo,deepseek")
  .split(",")
  .map((target) => target.trim())
  .filter(Boolean);
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
async function waitForOutcome(id, token, timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs;
  let bot;
  do {
    bot = await botOf(id);
    const messages = bot.messages ?? [];
    const promptIndex = messages.findLastIndex((message) => message.role === "user" && message.text?.includes(token));
    const afterPrompt = promptIndex < 0 ? [] : messages.slice(promptIndex + 1);
    const reply = afterPrompt.find((message) => message.role === "bot" && message.kind === "text");
    const failed = afterPrompt.find((message) => message.kind === "activity" && message.tool?.ok === false);
    if (!bot.busy && (reply || failed)) return bot;
    await sleep(1_000);
  } while (Date.now() < deadline);
  return bot;
}

const instances = (await api("GET", "/api/instances")).body.instances;
for (const instanceId of TARGETS) {
  const instance = instances.find((candidate) => candidate.instanceId === instanceId);
  const available = instance?.snapshot?.state === "available";
  check(`${instanceId} is reported available`, available, JSON.stringify(instance?.snapshot ?? {}));
  if (!available) continue;

  const created = await api("POST", "/api/bots");
  const botId = created.body.bot.id;
  try {
    const model = instance.models.default;
    const patched = await api("PATCH", `/api/bots/${botId}`, {
      name: `Smoke${instanceId}${Date.now().toString(36).slice(-5)}`,
      modelSelection: { instanceId, model },
    });
    check(`${instanceId} selection is accepted`, patched.status === 200, `status ${patched.status} ${JSON.stringify(patched.body).slice(0, 140)}`);
    if (patched.status !== 200) continue;

    const token = `PONG_${instanceId.toUpperCase()}`;
    const sent = await api("POST", `/api/bots/${botId}/messages`, {
      text: `Reply with exactly ${token}. Do not use tools, files, network, browser, email, calendar, or connected apps.`,
    });
    check(`${instanceId} turn starts`, sent.status === 202, `status ${sent.status} ${JSON.stringify(sent.body).slice(0, 120)}`);
    if (sent.status !== 202) continue;

    const bot = await waitForOutcome(botId, token);
    const messages = bot.messages ?? [];
    const promptIndex = messages.findLastIndex((message) => message.role === "user" && message.text?.includes(token));
    const afterPrompt = promptIndex < 0 ? [] : messages.slice(promptIndex + 1);
    const reply = afterPrompt.filter((message) => message.role === "bot" && message.kind === "text").at(-1);
    const errors = afterPrompt.filter((message) => message.kind === "activity" && message.tool?.ok === false).slice(-3);
    check(`${instanceId} turn completes`, bot && !bot.busy, "still busy after three minutes");
    check(`${instanceId} returns its token`, reply?.text?.includes(token) === true, reply?.text?.slice(0, 180) || JSON.stringify(errors));
  } finally {
    await api("DELETE", `/api/bots/${botId}`);
  }
}

console.log(`\nlive7: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
