// Live probe 5: edit a user message, fork the thread, and switch both branches.
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
    if (!bot.busy && (bot.messages?.length ?? 0) >= minimumMessages) return bot;
    await sleep(1_000);
  } while (Date.now() < deadline);
  return bot;
}
function activePath(messages, leafId) {
  const byId = new Map(messages.map((message) => [message.id, message]));
  const path = [];
  let current = byId.get(leafId);
  const seen = new Set();
  while (current && !seen.has(current.id)) {
    path.unshift(current);
    seen.add(current.id);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return path;
}

const suffix = Date.now().toString(36).slice(-6);
const created = await api("POST", "/api/bots");
const botId = created.body.bot.id;
await api("PATCH", `/api/bots/${botId}`, {
  name: `BranchProbe${suffix}`,
  modelSelection: { instanceId: "claude", model: "claude-sonnet-5" },
});

let bot = await botOf(botId);
const initialCount = bot.messages.length;
const firstSend = await api("POST", `/api/bots/${botId}/messages`, {
  text: "Reply with exactly BRANCH_A and do not use tools.",
});
check("the original turn starts", firstSend.status === 202, `status ${firstSend.status}`);
bot = await waitForIdle(botId, initialCount + 2);
check("the original turn settles", !bot.busy, "still busy after three minutes");

const originalUser = bot.messages.findLast((message) => message.role === "user" && message.text?.includes("BRANCH_A"));
const originalReply = bot.messages.findLast((message) => message.role === "bot" && message.kind === "text");
check("the original branch has a user message and reply", Boolean(originalUser && originalReply));
check("the original reply is visible", originalReply?.text?.includes("BRANCH_A") === true, originalReply?.text?.slice(0, 120));

const edit = await api("POST", `/api/bots/${botId}/messages/${originalUser.id}/edit`, {
  text: "Reply with exactly BRANCH_B and do not use tools.",
});
check("editing starts a forked turn", edit.status === 202, `status ${edit.status} ${JSON.stringify(edit.body).slice(0, 120)}`);
bot = await waitForIdle(botId, initialCount + 4);
check("the forked turn settles", !bot.busy, "still busy after three minutes");

const editedUser = bot.messages.findLast((message) => message.role === "user" && message.text?.includes("BRANCH_B"));
const editedReply = bot.messages.findLast((message) => message.role === "bot" && message.kind === "text");
const forkLeaf = bot.activeLeafId;
const forkPath = activePath(bot.messages, forkLeaf);
check("the edited message is a sibling of the original", editedUser?.parentId === originalUser?.parentId, `parents ${originalUser?.parentId} / ${editedUser?.parentId}`);
check("the active path contains the edit", forkPath.some((message) => message.id === editedUser?.id));
check("the active path hides the original version", !forkPath.some((message) => message.id === originalUser?.id));
check("the edited reply is visible", editedReply?.text?.includes("BRANCH_B") === true, editedReply?.text?.slice(0, 120));

const switchBack = await api("POST", `/api/bots/${botId}/active-branch`, { messageId: originalReply.id });
check("the original branch can be selected", switchBack.status === 200 && switchBack.body.activeLeafId === originalReply.id, `status ${switchBack.status}`);
bot = await botOf(botId);
const originalPath = activePath(bot.messages, bot.activeLeafId);
check("the selected original path contains BRANCH_A", originalPath.some((message) => message.id === originalUser.id));
check("the selected original path hides BRANCH_B", !originalPath.some((message) => message.id === editedUser.id));

const switchFork = await api("POST", `/api/bots/${botId}/active-branch`, { messageId: forkLeaf });
check("the edited branch can be selected again", switchFork.status === 200 && switchFork.body.activeLeafId === forkLeaf, `status ${switchFork.status}`);

console.log(`\nlive5: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
