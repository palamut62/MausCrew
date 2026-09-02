// Live probe 6: room sequencing, one-hop mentions, and Project Room isolation.
import { mkdirSync } from "node:fs";

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
async function state() { return (await api("GET", "/api/bots")).body; }
async function roomOf(id) { return (await state()).groups.find((group) => group.id === id); }
async function waitRoom(id, minimumBotReplies, timeoutMs = 300_000) {
  const deadline = Date.now() + timeoutMs;
  let room;
  do {
    room = await roomOf(id);
    const replies = (room.messages ?? []).filter((message) => message.role === "bot" && message.kind === "text");
    if (!room.busyBotId && replies.length >= minimumBotReplies) return room;
    await sleep(1_000);
  } while (Date.now() < deadline);
  return room;
}
async function makeBot(name) {
  const created = await api("POST", "/api/bots");
  const patched = await api("PATCH", `/api/bots/${created.body.bot.id}`, {
    name,
    modelSelection: { instanceId: "claude", model: "claude-sonnet-5" },
  });
  return patched.body.bot;
}

const suffix = Date.now().toString(36).slice(-6);
const alpha = await makeBot(`RoomAlpha${suffix}`);
const beta = await makeBot(`RoomBeta${suffix}`);
const createdRoom = await api("POST", "/api/groups", {
  name: `Room probe ${suffix}`,
  memberIds: [alpha.id, beta.id],
});
const roomId = createdRoom.body.group.id;
await api("PATCH", `/api/groups/${roomId}`, { defaultResponder: { kind: "mentions" } });

const direct = await api("POST", `/api/groups/${roomId}/messages`, {
  text: `@${alpha.name} and @${beta.name}: each reply once with only your own name. Do not use tools and do not mention anyone.`,
});
check("a two-bot room turn starts", direct.status === 202, `status ${direct.status}`);
let room = await waitRoom(roomId, 2);
const directReplies = (room.messages ?? []).filter((message) => message.role === "bot" && message.kind === "text");
check("both mentioned bots reply", new Set(directReplies.map((message) => message.from?.botId)).size === 2, JSON.stringify(directReplies.map((message) => message.from?.name)));
check("room responders run sequentially", directReplies.length === 2 && directReplies[0].at <= directReplies[1].at, `reply count ${directReplies.length}`);

await api("PATCH", `/api/groups/${roomId}`, {
  defaultResponder: { kind: "mentions" },
  bulletin: `When ${alpha.name} is asked to begin, reply exactly "@${beta.name} HOP". When ${beta.name} sees that, reply exactly "@${alpha.name} STOP". Do not use tools.`,
});
const beforeHop = directReplies.length;
const hopSend = await api("POST", `/api/groups/${roomId}/messages`, { text: `@${alpha.name} begin` });
check("the hop-limit turn starts", hopSend.status === 202, `status ${hopSend.status}`);
room = await waitRoom(roomId, beforeHop + 2);
const allReplies = (room.messages ?? []).filter((message) => message.role === "bot" && message.kind === "text");
const hopReplies = allReplies.slice(beforeHop);
check("the mentioned teammate gets one chained turn", hopReplies.length >= 2 && hopReplies.some((message) => message.from?.botId === beta.id), JSON.stringify(hopReplies.map((message) => ({ from: message.from?.name, text: message.text }))));
await sleep(5_000);
room = await roomOf(roomId);
const settledHopReplies = (room.messages ?? []).filter((message) => message.role === "bot" && message.kind === "text").slice(beforeHop);
check("MAX_GROUP_HOPS=1 prevents a third reply", settledHopReplies.length === 2, `reply count ${settledHopReplies.length}`);

const projectBot = await makeBot(`ProjectBot${suffix}`);
const marker = `PROJECT_MARKER_${suffix.toUpperCase()}`;
const projectWorkspace = `C:/Users/umuti/AppData/Local/Temp/mc-rig/project-${suffix}`;
mkdirSync(projectWorkspace, { recursive: true });
const projectCreate = await api("POST", "/api/projects", {
  name: `Isolated project ${suffix}`,
  description: "Live isolation probe",
  workspacePath: projectWorkspace,
  instructions: `The secret-free test marker is ${marker}. When asked for the marker, reply with it exactly.`,
  memberIds: [projectBot.id],
});
check("a Project Room is created", projectCreate.status === 201 && projectCreate.body.group.projectId === projectCreate.body.project.id, `status ${projectCreate.status}`);
const projectRoomId = projectCreate.body.group.id;
await api("PATCH", `/api/groups/${projectRoomId}`, { defaultResponder: { kind: "everyone" } });
const projectSend = await api("POST", `/api/groups/${projectRoomId}/messages`, {
  text: "Reply only with the marker from the project instructions. Do not use tools.",
});
check("the Project Room turn starts", projectSend.status === 202, `status ${projectSend.status}`);
const projectRoom = await waitRoom(projectRoomId, 1);
const projectReply = (projectRoom.messages ?? []).filter((message) => message.role === "bot" && message.kind === "text").at(-1);
check("project instructions reach the room turn", projectReply?.text?.includes(marker) === true, projectReply?.text?.slice(0, 160));
const freshState = await state();
const privateBot = freshState.bots.find((bot) => bot.id === projectBot.id);
check("the project transcript stays in the room", !(privateBot.messages ?? []).some((message) => message.text?.includes(marker)));
check("the project keeps its isolated workspace", freshState.projects.find((project) => project.id === projectCreate.body.project.id)?.workspacePath === projectWorkspace);

console.log(`\nlive6: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
