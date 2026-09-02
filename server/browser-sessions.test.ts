import { describe, expect, it, vi } from "vitest";

import { discoverBrowserSessions, validBrowserEndpoint } from "./browser-sessions.ts";

describe("browser session discovery", () => {
  it("returns explicit localhost CDP sessions and their tabs", async () => {
    const fetcher = vi.fn(async (url: string) => ({
      ok: true,
      json: async () => url.endsWith("version")
        ? { Browser: "Chrome/140", "User-Agent": "Chrome", webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/browser/1" }
        : [{ id: "tab", type: "page", title: "Mail", url: "https://mail.example.test" }],
    })) as unknown as typeof fetch;
    const sessions = await discoverBrowserSessions([9222], fetcher);
    expect(sessions[0]).toMatchObject({ endpoint: "http://127.0.0.1:9222", tabs: [{ title: "Mail" }] });
  });

  it("rejects non-loopback endpoints", () => {
    expect(validBrowserEndpoint("http://example.com:9222")).toBeNull();
    expect(validBrowserEndpoint("http://localhost:9222")).toBe("http://localhost:9222");
  });
});
