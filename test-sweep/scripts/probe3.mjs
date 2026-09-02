// Rig probe 3 — corrected shapes: webhook delivery, MCP registry, skills.
const BASE = "http://127.0.0.1:8899";
let pass = 0, fail = 0;
const out = [];
async function api(method, path, body, headers = {}, base = BASE) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...headers },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed; try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: res.status, body: parsed };
}
const check = (n, ok, d = "") => { if (ok) { pass++; out.push(`PASS  ${n}`); } else { fail++; out.push(`FAIL  ${n}${d ? ` :: ${d}` : ""}`); } return ok; };
const info = (m) => out.push(`INFO  ${m}`);
const botId = (await api("GET", "/api/bots")).body.bots[0].id;

// ── webhook delivery, using the credential the app actually hands out ────
{
  const created = await api("POST", "/api/webhooks", { name: "Deploy", prompt: "deploy: {{body}}", botId, runOn: "maus", enabled: true });
  const { webhook, credential } = created.body;
  info(`endpointUrl: ${credential.endpointUrl}  (capability url ends with secret: ${credential.url.endsWith(credential.secret)})`);

  const wrong = await fetch(credential.endpointUrl, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer wrong-secret" }, body: JSON.stringify({ x: 1 }) });
  check("a wrong secret is rejected", wrong.status === 401, `status ${wrong.status}`);

  const noAuth = await fetch(credential.endpointUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ x: 1 }) });
  check("an unauthenticated delivery is rejected", noAuth.status === 401, `status ${noAuth.status}`);

  const wrongMethod = await fetch(credential.endpointUrl, { method: "GET" });
  check("GET on a hook is refused", wrongMethod.status === 405, `status ${wrongMethod.status}`);

  const bearer = await fetch(credential.endpointUrl, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${credential.secret}` }, body: JSON.stringify({ event: "deploy", ref: "main" }) });
  const bearerBody = await bearer.json();
  check("bearer delivery is accepted", bearer.status === 202 && bearerBody.accepted === true, `status ${bearer.status} ${JSON.stringify(bearerBody).slice(0, 120)}`);

  const capability = await fetch(credential.url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event: "deploy", ref: "capability" }) });
  check("capability-URL delivery is accepted", capability.status === 202, `status ${capability.status}`);

  const unknown = await fetch(credential.endpointUrl.replace(/wh_[A-Za-z0-9_-]+/, "wh_notarealhook"), { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${credential.secret}` }, body: "{}" });
  check("an unknown endpoint 404s", unknown.status === 404 || unknown.status === 401, `status ${unknown.status}`);

  await new Promise((r) => setTimeout(r, 1500));
  const list = await api("GET", "/api/webhooks");
  const mine = list.body.webhooks.find((w) => w.id === webhook.id);
  check("deliveries are counted", (mine?.deliveryCount ?? 0) >= 2, `count ${mine?.deliveryCount}`);
  check("attempts are recorded, rejections included", (list.body.attempts ?? []).length >= 3, `attempts ${(list.body.attempts ?? []).length}`);
  const rejected = (list.body.attempts ?? []).filter((a) => a.status === 401 || a.outcome === "rejected");
  check("rejected deliveries are auditable", rejected.length >= 1, `rejected ${rejected.length}`);
  info(`attempt sample: ${JSON.stringify((list.body.attempts ?? [])[0] ?? {}).slice(0, 200)}`);

  const disabled = await api("PATCH", `/api/webhooks/${webhook.id}`, { enabled: false });
  check("a hook can be paused", disabled.status === 200 && disabled.body.webhook.enabled === false, `status ${disabled.status}`);
  const afterPause = await fetch(credential.endpointUrl, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${credential.secret}` }, body: "{}" });
  info(`delivery while paused -> ${afterPause.status}`);

  await api("DELETE", `/api/webhooks/${webhook.id}`);
  const afterDelete = await fetch(credential.endpointUrl, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${credential.secret}` }, body: "{}" });
  check("a deleted hook stops accepting", afterDelete.status === 404 || afterDelete.status === 401, `status ${afterDelete.status}`);
}

// ── MCP registry with the real schema ───────────────────────────────────
{
  const ok = await api("PUT", "/api/mcp-servers", {
    servers: [{ id: "probe-mcp", name: "probe", command: "node", args: ["-e", "process.exit(0)"], envNames: ["PROBE_TOKEN"], allowedBots: [botId], enabled: false, instructions: "probe only", disabledTools: ["dangerous.tool"] }],
  });
  check("register an MCP server", ok.status === 200, `status ${ok.status} ${JSON.stringify(ok.body).slice(0, 140)}`);

  const cfg = await api("GET", "/api/config");
  const stored = (cfg.body.mcpServers ?? []).find((s) => s.id === "probe-mcp");
  check("server is stored", Boolean(stored), `count ${(cfg.body.mcpServers ?? []).length}`);
  check("env names are exposed, values never are", Array.isArray(stored?.envNames) && !("env" in (stored ?? {})), JSON.stringify(stored ?? {}).slice(0, 160));
  check("per-server tool blocks persist", (stored?.disabledTools ?? []).includes("dangerous.tool"));
  check("allowlist scoping persists", (stored?.allowedBots ?? []).includes(botId));

  const badId = await api("PUT", "/api/mcp-servers", { servers: [{ id: "bad id!", name: "x", command: "node", args: [], envNames: [], allowedBots: [] }] });
  check("an invalid server id is refused", badId.status === 400, `status ${badId.status} ${JSON.stringify(badId.body).slice(0, 90)}`);

  const injection = await api("PUT", "/api/mcp-servers", { servers: [{ id: "inject", name: "x", command: "node\nrm -rf /", args: [], envNames: [], allowedBots: [] }] });
  check("newline injection in a command is refused", injection.status === 400, `status ${injection.status} ${JSON.stringify(injection.body).slice(0, 90)}`);

  const test = await api("POST", "/api/mcp-servers/test", { server: { id: "probe-mcp", name: "probe", command: "definitely-not-real", args: [], envNames: [], allowedBots: [] } });
  check("testing a broken server fails cleanly", test.status < 500, `status ${test.status} ${JSON.stringify(test.body).slice(0, 140)}`);
  info(`mcp test -> ${JSON.stringify(test.body).slice(0, 180)}`);

  await api("PUT", "/api/mcp-servers", { servers: [] });
}

// ── skills with the real schema ─────────────────────────────────────────
{
  const created = await api("POST", `/api/bots/${botId}/skills`, {
    name: "probe-skill",
    description: "A probe skill used by the test sweep.",
    whenToUse: "When probing.",
    instructions: "# Probe\n\nDo the probe thing, carefully.",
  });
  check("create a workspace skill", created.status === 201, `status ${created.status} ${JSON.stringify(created.body).slice(0, 140)}`);

  const dup = await api("POST", `/api/bots/${botId}/skills`, { name: "probe-skill", description: "again", instructions: "again" });
  check("a duplicate skill name is refused", dup.status === 409, `status ${dup.status}`);

  const traversal = await api("POST", `/api/bots/${botId}/skills`, { name: "../escape", description: "x", instructions: "y" });
  check("path traversal in a skill name is refused", traversal.status >= 400, `status ${traversal.status} ${JSON.stringify(traversal.body).slice(0, 90)}`);

  const list = await api("GET", `/api/bots/${botId}/skills`);
  check("the skill is listed", JSON.stringify(list.body.skills).includes("probe-skill"), JSON.stringify(list.body.skills).slice(0, 160));

  const updated = await api("PUT", `/api/bots/${botId}/skills/probe-skill`, { name: "probe-skill", description: "Updated description.", instructions: "# Probe\n\nUpdated." });
  check("update a skill", updated.status === 200, `status ${updated.status} ${JSON.stringify(updated.body).slice(0, 120)}`);

  const renamed = await api("PUT", `/api/bots/${botId}/skills/probe-skill`, { name: "other-name", description: "x", instructions: "y" });
  check("renaming through update is refused", renamed.status === 400, `status ${renamed.status}`);

  const removed = await api("DELETE", `/api/bots/${botId}/skills/probe-skill`);
  check("delete a skill", removed.status === 200, `status ${removed.status}`);

  const after = await api("GET", `/api/bots/${botId}/skills`);
  check("the skill is gone", !JSON.stringify(after.body.skills).includes("probe-skill"));
}

console.log(out.join("\n"));
console.log(`\nprobe3: ${pass} passed, ${fail} failed`);
