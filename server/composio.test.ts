import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { AppConfig } from "./config.ts";
import {
  authorizeService,
  connectionStatus,
  mcpIntegration,
  prepareProjectSession,
  removeService,
} from "./composio.ts";

let api: Server;
let base = "";
const calls: Array<{ method: string; path: string; query: string; body: any }> = [];
let twitterAuthConfigs = [{ id: "ac_twitter", is_disabled: false }];

beforeAll(async () => {
  api = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://stub");
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : null;
    calls.push({ method: req.method ?? "GET", path: url.pathname, query: url.search, body });

    if (req.headers["x-api-key"] !== "ak_test") {
      res.writeHead(401, { "content-type": "application/json" });
      return res.end(JSON.stringify({ error: { message: "invalid project key" } }));
    }

    if (req.method === "POST" && url.pathname === "/api/v3.1/tool_router/session") {
      res.writeHead(201, { "content-type": "application/json" });
      return res.end(JSON.stringify({
        session_id: "trs_test",
        mcp: { type: "http", url: "https://app.composio.dev/tool_router/v3/trs_test/mcp" },
        config: { user_id: body.user_id },
      }));
    }
    if (req.method === "GET" && url.pathname === "/api/v3.1/tool_router/session/trs_test") {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({
        session_id: "trs_test",
        mcp: { type: "http", url: "https://app.composio.dev/tool_router/v3/trs_test/mcp" },
        config: { user_id: "mauscrew_existing" },
      }));
    }
    if (req.method === "GET" && url.pathname.endsWith("/toolkits")) {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({
        items: [
          { slug: "github", connected_account: { id: "ca_github", status: "ACTIVE" } },
          { slug: "gmail", is_no_auth: true },
          { slug: "slack" },
        ],
      }));
    }
    if (req.method === "GET" && url.pathname === "/api/v3/auth_configs") {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ items: twitterAuthConfigs }));
    }
    if (req.method === "POST" && url.pathname.endsWith("/link")) {
      if (body.toolkit === "twitter" && !body.auth_config_override) {
        res.writeHead(400, { "content-type": "application/json" });
        return res.end(JSON.stringify({
          error: "Composio does not manage auth for toolkit twitter and no auth config without required fields is available. Please create an auth config manually or specify one in auth_config_override.",
        }));
      }
      res.writeHead(201, { "content-type": "application/json" });
      return res.end(JSON.stringify({ redirect_url: `https://connect.composio.dev/link/${body.toolkit}` }));
    }
    if (req.method === "DELETE" && url.pathname === "/api/v3.1/connected_accounts/ca_github") {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ success: true }));
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });
  await new Promise<void>((resolve) => api.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(api.address() as { port: number }).port}/api/v3.1`;
  process.env.MAUSCREW_COMPOSIO_API = base;
  process.env.MAUSCREW_COMPOSIO_TOOLKITS_API = base.replace("/api/v3.1", "/api/v3");
});

afterAll(async () => {
  delete process.env.MAUSCREW_COMPOSIO_API;
  delete process.env.MAUSCREW_COMPOSIO_TOOLKITS_API;
  await new Promise<void>((resolve) => api.close(() => resolve()));
});

describe.sequential("Composio Sessions", () => {
  it("accepts only project API keys", async () => {
    await expect(prepareProjectSession("old_key")).rejects.toThrow(/start with ak_/i);
    await expect(prepareProjectSession("ak_wrong")).rejects.toThrow(/invalid project key/i);
  });

  it("creates one stable per-installation session and reuses it", async () => {
    const created = await prepareProjectSession("ak_test", { userId: "mauscrew_existing" });
    expect(created).toEqual({
      apiKey: "ak_test",
      userId: "mauscrew_existing",
      sessionId: "trs_test",
    });
    expect(calls.filter((call) => call.method === "POST" && call.path.endsWith("/session")).at(-1)?.body).toEqual({
      user_id: "mauscrew_existing",
    });

    const reused = await prepareProjectSession("ak_test", created);
    expect(reused).toEqual({
      apiKey: "ak_test",
      userId: "mauscrew_existing",
      sessionId: "trs_test",
    });
  });

  it("mounts the Session MCP endpoint with the project key header", async () => {
    const cfg: AppConfig = {
      composio: { apiKey: "ak_test", userId: "mauscrew_existing", sessionId: "trs_test" },
    };
    await expect(mcpIntegration(cfg)).resolves.toEqual({
      url: "https://app.composio.dev/tool_router/v3/trs_test/mcp",
      headers: { "x-api-key": "ak_test" },
    });
  });

  it("reports connection state, creates auth links and revokes disconnects", async () => {
    const cfg: AppConfig = {
      composio: { apiKey: "ak_test", userId: "mauscrew_existing", sessionId: "trs_test" },
    };
    await expect(connectionStatus(cfg, ["github", "gmail", "slack", "notion"])).resolves.toEqual({
      github: { connected: true, status: "ACTIVE" },
      gmail: { connected: true, status: "ACTIVE" },
      slack: { connected: false, status: "not_connected" },
      notion: { connected: false, status: "not_connected" },
    });
    await expect(authorizeService(cfg, "github")).resolves.toEqual({
      url: "https://connect.composio.dev/link/github",
    });
    await expect(authorizeService(cfg, "x")).resolves.toEqual({
      url: "https://connect.composio.dev/link/twitter",
    });
    expect(calls.find(
      (call) => call.method === "POST"
        && call.path.endsWith("/link")
        && call.body.toolkit === "twitter",
    )?.body).toEqual({ toolkit: "twitter", auth_config_override: "ac_twitter" });
    await expect(removeService(cfg, "github")).resolves.toEqual({ removed: 1 });
    expect(calls.some(
      (call) => call.method === "DELETE"
        && call.path.endsWith("/connected_accounts/ca_github")
        && call.query === "?revoke_on_delete=true",
    )).toBe(true);
  });

  it("explains how to connect X when the project has no custom OAuth config", async () => {
    const cfg: AppConfig = {
      composio: { apiKey: "ak_test", userId: "mauscrew_existing", sessionId: "trs_test" },
    };
    twitterAuthConfigs = [];
    await expect(authorizeService(cfg, "twitter")).rejects.toThrow(
      /X \(Twitter\) needs a custom OAuth Auth Config.*try Connect again/i,
    );
  });
});
