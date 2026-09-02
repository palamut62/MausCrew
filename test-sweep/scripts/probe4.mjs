// Rig probe 4 — the boundaries: hosts, origins, auth, size caps, traversal, SSE.
import { connect } from "node:net";
const HOST = "127.0.0.1", PORT = 8899, BASE = `http://${HOST}:${PORT}`;
let pass = 0, fail = 0; const out = [];
const check = (n, ok, d = "") => { if (ok) { pass++; out.push(`PASS  ${n}`); } else { fail++; out.push(`FAIL  ${n}${d ? ` :: ${d}` : ""}`); } };
const info = (m) => out.push(`INFO  ${m}`);

const raw = (requestLine) => new Promise((resolve) => {
  const socket = connect(PORT, HOST, () => socket.write(requestLine));
  let buf = ""; socket.on("data", (c) => { buf += c; });
  socket.on("close", () => resolve(buf));
  setTimeout(() => { socket.destroy(); resolve(buf); }, 3000);
});

// ── host and origin gates ───────────────────────────────────────────────
{
  const evilHost = await raw("GET /api/bots HTTP/1.1\r\nHost: evil.example.com\r\nConnection: close\r\n\r\n");
  check("a foreign Host header is refused", evilHost.includes(" 403 "), evilHost.split("\r\n")[0]);

  const noHost = await raw("GET /api/bots HTTP/1.0\r\nConnection: close\r\n\r\n");
  check("a request with no Host is refused", noHost.includes(" 403 "), noHost.split("\r\n")[0]);

  const crossOrigin = await fetch(`${BASE}/api/bots`, { headers: { origin: "https://evil.example.com" } });
  check("a cross-origin browser request is refused", crossOrigin.status === 403, `status ${crossOrigin.status}`);

  const loopbackOrigin = await fetch(`${BASE}/api/bots`, { headers: { origin: "http://127.0.0.1:5199" } });
  check("a loopback origin is allowed", loopbackOrigin.status === 200, `status ${loopbackOrigin.status}`);

  const dnsRebind = await raw("GET /api/bots HTTP/1.1\r\nHost: 127.0.0.1.nip.io:8899\r\nConnection: close\r\n\r\n");
  check("a rebinding-style host is refused", dnsRebind.includes(" 403 "), dnsRebind.split("\r\n")[0]);
}

// ── internal API is token-gated ─────────────────────────────────────────
{
  const noToken = await fetch(`${BASE}/api/internal/agents?self=x`);
  check("internal API without a token is 401", noToken.status === 401, `status ${noToken.status}`);

  const wrongToken = await fetch(`${BASE}/api/internal/agents?self=x`, { headers: { authorization: "Bearer nope" } });
  check("internal API with a wrong token is 401", wrongToken.status === 401, `status ${wrongToken.status}`);

  const forgedWorkflow = await fetch(`${BASE}/api/internal/workflows`, {
    method: "POST", headers: { "content-type": "application/json", authorization: "Bearer nope" },
    body: JSON.stringify({ fromBotId: "x", title: "forged", steps: [{ id: "a", title: "a" }] }),
  });
  check("a forged workflow creation is 401", forgedWorkflow.status === 401, `status ${forgedWorkflow.status}`);
}

// ── input hardening ─────────────────────────────────────────────────────
{
  const botId = (await (await fetch(`${BASE}/api/bots`)).json()).bots[0].id;

  const badJson = await fetch(`${BASE}/api/bots/${botId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: "{not json" });
  check("malformed JSON is refused, not crashed on", badJson.status >= 400 && badJson.status < 500, `status ${badJson.status}`);

  const huge = await fetch(`${BASE}/api/bots/${botId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ description: "x".repeat(5_000_000) }) });
  check("an oversized body is refused", huge.status >= 400, `status ${huge.status}`);
  info(`oversized body -> ${huge.status}`);

  const stillAlive = await fetch(`${BASE}/api/health`);
  check("the server survives all of the above", stillAlive.status === 200);
}

// ── static + frames traversal ───────────────────────────────────────────
{
  for (const path of ["/../../../../Windows/win.ini", "/frames/../../server/index.ts", "/%2e%2e%2f%2e%2e%2fpackage.json", "/frames/..%5c..%5cpackage.json"]) {
    const res = await fetch(`${BASE}${path}`);
    const text = (await res.text()).slice(0, 60);
    check(`traversal blocked: ${path}`, res.status === 404 || res.status === 403 || !text.includes("mauscrew"), `status ${res.status} body ${text.replace(/\n/g, " ")}`);
  }
}

// ── SSE stream ──────────────────────────────────────────────────────────
{
  const controller = new AbortController();
  const res = await fetch(`${BASE}/api/events`, { signal: controller.signal });
  check("SSE responds as an event stream", res.headers.get("content-type")?.includes("text/event-stream") === true, res.headers.get("content-type") ?? "no content-type");
  const reader = res.body.getReader();
  const first = await Promise.race([
    reader.read().then(({ value }) => new TextDecoder().decode(value)),
    new Promise((r) => setTimeout(() => r(""), 4000)),
  ]);
  check("the stream opens with a hello frame", first.includes("hello"), first.slice(0, 120).replace(/\n/g, "\\n"));
  // a live mutation must reach the stream
  const mutation = fetch(`${BASE}/api/bots`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  const frame = await Promise.race([
    (async () => { for (let i = 0; i < 6; i++) { const { value } = await reader.read(); const t = new TextDecoder().decode(value); if (t.includes('"bot"')) return t; } return ""; })(),
    new Promise((r) => setTimeout(() => r(""), 6000)),
  ]);
  await mutation;
  check("a mutation is pushed to the stream", frame.includes("bot"), frame.slice(0, 120).replace(/\n/g, "\\n"));
  controller.abort();
}

// ── audit trail ─────────────────────────────────────────────────────────
{
  const policy = await (await fetch(`${BASE}/api/security/policy`)).json();
  const put = await fetch(`${BASE}/api/security/policy`, {
    method: "PUT", headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...policy.policy, defaults: { ...policy.policy.defaults, shell: "deny" } }),
  });
  check("policy can be saved", put.status === 200, `status ${put.status}`);
  const back = await (await fetch(`${BASE}/api/security/policy`)).json();
  check("the saved policy is what comes back", back.policy?.defaults?.shell === "deny", JSON.stringify(back.policy?.defaults ?? {}).slice(0, 120));
  const restore = await fetch(`${BASE}/api/security/policy`, {
    method: "PUT", headers: { "content-type": "application/json" },
    body: JSON.stringify(policy.policy),
  });
  check("the policy can be restored", restore.status === 200);

  const bogus = await fetch(`${BASE}/api/security/policy`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ version: 1, defaults: { shell: "sometimes" } }) });
  check("an invalid policy verdict is refused", bogus.status >= 400, `status ${bogus.status} ${(await bogus.text()).slice(0, 100)}`);
}

console.log(out.join("\n"));
console.log(`\nprobe4: ${pass} passed, ${fail} failed`);
