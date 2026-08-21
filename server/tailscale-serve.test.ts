import { describe, expect, it } from "vitest";

import { ensureTailscaleServe, tailscaleServeProxy, tailscaleServeProxyUsesPort } from "./tailscale-serve.ts";

describe("Tailscale Serve pairing route", () => {
  it("finds the root proxy for the configured HTTPS host", () => {
    expect(
      tailscaleServeProxy(
        {
          Web: {
            "umut.example.ts.net:443": {
              Handlers: { "/": { Proxy: "http://localhost:8799" } },
            },
          },
        },
        "umut.example.ts.net",
      ),
    ).toBe("http://localhost:8799");
  });

  it("does not accept another host's mapping", () => {
    expect(
      tailscaleServeProxy(
        { Web: { "other.example.ts.net:443": { Handlers: { "/": { Proxy: "http://localhost:28799" } } } } },
        "umut.example.ts.net",
      ),
    ).toBeNull();
  });

  it("rejects the stale fallback port that caused downloaded error responses", () => {
    expect(tailscaleServeProxyUsesPort("http://localhost:28799", 8799)).toBe(false);
    expect(tailscaleServeProxyUsesPort("http://127.0.0.1:8799", 8799)).toBe(true);
  });

  it("moves a stale Serve mapping to the active packaged server port", async () => {
    const calls: string[][] = [];
    let configured = false;
    const execute = async (_file: string, args: string[]) => {
      calls.push(args);
      if (args[1] === "--bg") {
        configured = true;
        return { stdout: "" };
      }
      return {
        stdout: JSON.stringify({
          Web: {
            "umut.example.ts.net:443": {
              Handlers: { "/": { Proxy: `http://localhost:${configured ? 18799 : 8799}` } },
            },
          },
        }),
      };
    };

    await expect(
      ensureTailscaleServe(new URL("https://umut.example.ts.net"), 18799, execute),
    ).resolves.toEqual({ ok: true, checked: true });
    expect(calls).toEqual([
      ["serve", "status", "--json"],
      ["serve", "--bg", "localhost:18799"],
      ["serve", "status", "--json"],
    ]);
  });
});
