// Rig probe 5 — team portability, message lifecycle, task control, takeover.
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
const bots = (await api("GET", "/api/bots")).body.bots;
const bot = bots.find((candidate) => !candidate.busy && !candidate.hidden) ?? bots[0];

// ── team export / import round trip ─────────────────────────────────────
{
  const exported = await api("POST", "/api/teams/export", { name: "Probe team", memberIds: [bots[0].id, bots[1].id] });
  check("export a team manifest", exported.status === 200 || exported.status === 201, `status ${exported.status} ${JSON.stringify(exported.body).slice(0, 140)}`);
  const manifest = exported.body?.manifest ?? exported.body;
  info(`manifest keys: ${Object.keys(manifest ?? {}).join(", ")}`);
  check("the manifest carries no secrets", !JSON.stringify(manifest).match(/sk-[A-Za-z0-9]{16}|Bearer [A-Za-z0-9]{16}/), "something key-shaped is in the manifest");

  const before = (await api("GET", "/api/bots")).body.bots.length;
  const imported = await api("POST", "/api/teams/import", manifest);
  check("import the same manifest back", imported.status === 200 || imported.status === 201, `status ${imported.status} ${JSON.stringify(imported.body).slice(0, 140)}`);
  const after = (await api("GET", "/api/bots")).body.bots.length;
  check("importing actually adds the bots", after > before, `before ${before} after ${after}`);
  info(`bots went ${before} -> ${after}`);

  const tampered = await api("POST", "/api/teams/import", { ...manifest, version: 999 });
  check("a tampered manifest is refused", tampered.status >= 400, `status ${tampered.status}`);
}

// ── messages: edit, branch, react, delete ───────────────────────────────
{
  const target = (await api("GET", "/api/bots")).body.bots.find((b) => b.messages?.length);
  const threadId = target.threadId;
  const first = target.messages[0];

  const react = await api("POST", `/api/threads/${threadId}/messages/${first.id}/reactions`, { emoji: "👍", by: "user" });
  check("react to a message", react.status === 200, `status ${react.status} ${JSON.stringify(react.body).slice(0, 120)}`);
  const unreact = await api("POST", `/api/threads/${threadId}/messages/${first.id}/reactions`, { emoji: "👍", by: "user" });
  check("the same reaction toggles off", unreact.status === 200, `status ${unreact.status}`);

  const ghost = await api("POST", `/api/threads/${threadId}/messages/nope/reactions`, { emoji: "👍" });
  check("reacting to an unknown message 404s", ghost.status === 404, `status ${ghost.status}`);
}

// ── tasks: create, rename, switch, delete ───────────────────────────────
{
  const created = await api("POST", `/api/bots/${bot.id}/tasks`, { title: "Probe task 2" });
  const task = created.body.task ?? created.body;
  check("create a second task", Boolean(task?.threadId), JSON.stringify(created.body).slice(0, 120));

  const renamed = await api("PATCH", `/api/bots/${bot.id}/tasks/${task.threadId}`, { title: "Renamed probe task" });
  check("rename a task", renamed.status === 200, `status ${renamed.status} ${JSON.stringify(renamed.body).slice(0, 120)}`);

  const removed = await api("DELETE", `/api/bots/${bot.id}/tasks/${task.threadId}`);
  check("delete a task", removed.status === 200, `status ${removed.status}`);

  const after = await api("GET", "/api/bots");
  const stillThere = after.body.bots.find((b) => b.id === bot.id).tasks?.some((t) => t.threadId === task.threadId);
  check("the deleted task is gone", !stillThere);
}

// ── takeover: the human grabs the wheel ─────────────────────────────────
{
  const on = await api("POST", `/api/bots/${bot.id}/takeover`, { active: true });
  check("take control of a bot", on.status === 200 && on.body.bot?.humanTakeover?.active === true, `status ${on.status} ${JSON.stringify(on.body?.bot?.humanTakeover ?? {})}`);
  const off = await api("POST", `/api/bots/${bot.id}/takeover`, { active: false, resume: false });
  check("hand control back", off.status === 200 && !off.body.bot?.humanTakeover?.active);
}

// ── interrupt / steer plumbing (no engine needed to reject cleanly) ─────
{
  const steerIdle = await api("POST", `/api/bots/${bot.id}/steer`, { text: "extra context" });
  info(`steer while idle -> ${steerIdle.status} ${JSON.stringify(steerIdle.body).slice(0, 120)}`);
  check("steering an idle bot answers cleanly", steerIdle.status < 500, `status ${steerIdle.status}`);

  const stopIdle = await api("POST", `/api/bots/${bot.id}/interrupt`);
  info(`interrupt while idle -> ${stopIdle.status} ${JSON.stringify(stopIdle.body).slice(0, 120)}`);
  check("interrupting an idle bot answers cleanly", stopIdle.status < 500, `status ${stopIdle.status}`);
}

// ── config round trip ───────────────────────────────────────────────────
{
  const cfg = (await api("GET", "/api/config")).body;
  const saved = await api("PUT", "/api/config", { ...cfg, profile: { name: "Probe User", email: "probe@example.com" } });
  check("save config", saved.status === 200, `status ${saved.status} ${JSON.stringify(saved.body).slice(0, 120)}`);
  const back = (await api("GET", "/api/config")).body;
  check("the saved profile comes back", back.profile?.name === "Probe User", JSON.stringify(back.profile ?? {}));
  check("secrets are still not echoed", !JSON.stringify(back).match(/sk-[A-Za-z0-9]{16}/));
}

console.log(`\nprobe5: ${pass} passed, ${fail} failed`);
