// Live probe 9: verify the automatic journal harvest and next-turn memory block.
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
async function waitForIdle(id, minimumMessages, timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs;
  let bot;
  do {
    bot = await botOf(id);
    if (bot && !bot.busy && (bot.messages?.length ?? 0) >= minimumMessages) return bot;
    await sleep(1_000);
  } while (Date.now() < deadline);
  return bot;
}

const suffix = Date.now().toString(36).slice(-5).toUpperCase();
const marker = `B7_MEMORY_${suffix}`;
const created = await api("POST", "/api/bots");
const botId = created.body.bot.id;
const selected = await api("PATCH", `/api/bots/${botId}`, {
  name: `MemoryProbe${suffix}`,
  modelSelection: { instanceId: "claude", model: "claude-sonnet-5" },
});
check("the memory probe selects Claude", selected.status === 200, `status ${selected.status}`);

const before = (await botOf(botId)).messages.length;
const first = await api("POST", `/api/bots/${botId}/messages`, {
  text: `Remember this durable project marker ${marker}. Reply with exactly MEMORY_ACK and do not use tools.`,
});
check("the first memory turn starts", first.status === 202, `status ${first.status}`);
const afterFirst = await waitForIdle(botId, before + 2);
check("the first memory turn settles", Boolean(afterFirst && !afterFirst.busy), "still busy after three minutes");

const memory = await api("GET", `/api/bots/${botId}/memory`);
check("the completed turn creates a journal entry", memory.status === 200 && memory.body.journalDays >= 1, JSON.stringify(memory.body));
check("the journal is injected into later turns", memory.body.injected > 0, JSON.stringify(memory.body));

const beforeSecond = afterFirst.messages.length;
const second = await api("POST", `/api/bots/${botId}/messages`, {
  text: `Use your persistent notes and reply with exactly ${marker}. Do not use tools.`,
});
check("the follow-up memory turn starts", second.status === 202, `status ${second.status}`);
const afterSecond = await waitForIdle(botId, beforeSecond + 2);
const reply = (afterSecond?.messages ?? []).filter((message) => message.role === "bot" && message.kind === "text").at(-1);
check("the follow-up memory turn settles", Boolean(afterSecond && !afterSecond.busy), "still busy after three minutes");
check("the bot can use the durable marker", reply?.text?.includes(marker) === true, reply?.text?.slice(0, 180));

console.log(`\nlive9: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
