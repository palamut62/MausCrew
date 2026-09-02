// Rig probe 1 — core surfaces: bots, tasks, threads, groups, projects, teams.
const BASE = "http://127.0.0.1:8899";
let pass = 0, fail = 0;
const results = [];

async function api(method, path, body, headers = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: res.status, body: parsed };
}

function check(name, ok, detail = "") {
  if (ok) { pass++; results.push(`PASS  ${name}`); }
  else { fail++; results.push(`FAIL  ${name}${detail ? ` :: ${detail}` : ""}`); }
  return ok;
}

// ── health / engines / config ───────────────────────────────────────────
{
  const h = await api("GET", "/api/health");
  check("health returns app identity", h.status === 200 && h.body.app === "mauscrew", JSON.stringify(h.body).slice(0, 120));
  check("health carries owner metadata", h.body?.owner?.name === "Umut Çelik");

  const i = await api("GET", "/api/instances");
  const available = (i.body.instances ?? []).filter((x) => x.snapshot?.state === "available");
  check("instances list engines", i.status === 200 && Array.isArray(i.body.instances), `status ${i.status}`);
  results.push(`INFO  engines: ${(i.body.instances ?? []).length} total, available: ${available.map((a) => a.instanceId).join(", ") || "none"}`);

  const c = await api("GET", "/api/config");
  check("config never echoes secrets", c.status === 200 && !JSON.stringify(c.body).match(/sk-[a-zA-Z0-9]{20}/), "a key-shaped string leaked");
}

// ── bots ────────────────────────────────────────────────────────────────
let botId, threadId;
{
  const probeName = `Probe-${Date.now().toString(36)}`;
  const created = await api("POST", "/api/bots");
  botId = created.body?.bot?.id;
  threadId = created.body?.bot?.threadId;
  check("create bot", created.status === 200 || created.status === 201, `status ${created.status}`);

  const named = await api("PATCH", `/api/bots/${botId}`, { name: probeName });
  check("name the probe bot", named.status === 200 && named.body.bot.name === probeName, `status ${named.status}`);
  const duplicate = await api("POST", "/api/bots");
  const dup = await api("PATCH", `/api/bots/${duplicate.body.bot.id}`, { name: probeName });
  check("duplicate bot name is refused", dup.status === 409, `status ${dup.status} ${JSON.stringify(dup.body).slice(0, 80)}`);

  const patched = await api("PATCH", `/api/bots/${botId}`, { title: "Prober", description: "runs probes", notifications: false });
  check("patch bot profile", patched.status === 200 && patched.body.bot.title === "Prober", JSON.stringify(patched.body).slice(0, 100));

  const badModel = await api("PATCH", `/api/bots/${botId}`, { modelSelection: { instanceId: 123 } });
  check("patch rejects malformed modelSelection", badModel.status >= 400 || badModel.body?.bot?.modelSelection?.instanceId !== 123, `status ${badModel.status}`);

  const badChief = await api("PATCH", `/api/bots/${botId}`, { chiefOfStaff: "yes" });
  check("chiefOfStaff must be boolean", badChief.status === 400, `status ${badChief.status}`);

  const chief = await api("PATCH", `/api/bots/${botId}`, { chiefOfStaff: true });
  check("promote to Chief of Staff", chief.status === 200 && chief.body.bot.chiefOfStaff === true);

  const bots = await api("GET", "/api/bots");
  const chiefs = bots.body.bots.filter((b) => b.chiefOfStaff);
  check("only one Chief of Staff exists", chiefs.length === 1, `found ${chiefs.length}`);

  const missing = await api("PATCH", "/api/bots/does-not-exist", { title: "x" });
  check("patching an unknown bot 404s", missing.status === 404, `status ${missing.status}`);
}

// ── tasks + threads + messages ──────────────────────────────────────────
let taskThread;
{
  const task = await api("POST", `/api/bots/${botId}/tasks`, { title: "Probe task" });
  taskThread = task.body?.task?.threadId ?? task.body?.threadId;
  check("create a task (fresh thread)", (task.status === 200 || task.status === 201) && Boolean(taskThread), `status ${task.status} ${JSON.stringify(task.body).slice(0, 120)}`);

  const bots = await api("GET", "/api/bots?messages=5");
  const probe = bots.body.bots.find((b) => b.id === botId);
  check("bot carries its tasks", (probe?.tasks ?? []).length >= 2, `tasks: ${(probe?.tasks ?? []).length}`);
  check("message paging parameter accepted", bots.status === 200);

  const badPage = await api("GET", "/api/bots?messages=-3");
  check("negative page size refused", badPage.status === 400, `status ${badPage.status}`);
}

// ── groups (rooms) ──────────────────────────────────────────────────────
let groupId;
{
  const second = await api("POST", "/api/bots", { name: "Probe2" });
  const secondId = second.body.bot.id;
  const group = await api("POST", "/api/groups", { name: "Probe room", memberIds: [botId, secondId] });
  groupId = group.body?.group?.id;
  check("create a room with members", (group.status === 200 || group.status === 201) && Boolean(groupId), `status ${group.status} ${JSON.stringify(group.body).slice(0, 120)}`);

  const bulletin = await api("PATCH", `/api/groups/${groupId}`, { bulletin: "Ship carefully." });
  check("room bulletin persists", bulletin.status === 200 && bulletin.body.group.bulletin === "Ship carefully.");

  const responder = await api("PATCH", `/api/groups/${groupId}`, { defaultResponder: { kind: "mentions" } });
  check("room default responder set", responder.status === 200 && responder.body.group.defaultResponder?.kind === "mentions", JSON.stringify(responder.body).slice(0, 120));

  const gone = await api("PATCH", "/api/groups/nope", { name: "x" });
  check("unknown room 404s", gone.status === 404, `status ${gone.status}`);
}

// ── projects ────────────────────────────────────────────────────────────
let projectId;
{
  const project = await api("POST", "/api/projects", {
    name: "Probe project",
    description: "isolated",
    instructions: "Stay on topic.",
    resources: [{ label: "Docs", value: "https://example.com" }],
    memberIds: [botId],
  });
  projectId = project.body?.project?.id;
  check("create a project (and its room)", (project.status === 200 || project.status === 201) && Boolean(projectId), `status ${project.status} ${JSON.stringify(project.body).slice(0, 140)}`);
  check("project creation returns its room", Boolean(project.body?.group?.id));

  const upd = await api("PATCH", `/api/projects/${projectId}`, { description: "changed" });
  check("update project", upd.status === 200 && upd.body.project.description === "changed");

  const bad = await api("PATCH", `/api/projects/${projectId}`, { workspacePath: "C:/Windows/System32" });
  results.push(`INFO  workspacePath guard -> ${bad.status} ${JSON.stringify(bad.body).slice(0, 100)}`);
}

// ── team export / import ────────────────────────────────────────────────
{
  const exported = await api("POST", "/api/teams/export", { name: "Probe team", memberIds: [botId] });
  check("export a bot as a manifest", exported.status === 200 && Boolean(exported.body?.manifest ?? exported.body?.team ?? exported.body?.name), `status ${exported.status} ${JSON.stringify(exported.body).slice(0, 140)}`);

  const badImport = await api("POST", "/api/teams/import", { nonsense: true });
  check("import rejects a malformed manifest", badImport.status >= 400, `status ${badImport.status}`);
}

// ── shared workspace ────────────────────────────────────────────────────
{
  const ws = await api("GET", "/api/shared-workspace");
  check("shared workspace status", ws.status === 200, `status ${ws.status} ${JSON.stringify(ws.body).slice(0, 120)}`);
}

console.log(results.join("\n"));
console.log(`\nprobe1: ${pass} passed, ${fail} failed`);
console.log(JSON.stringify({ botId, threadId, taskThread, groupId, projectId }));
