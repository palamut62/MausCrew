import { describe, expect, it } from "vitest";

import { tailscaleServeProxy, tailscaleServeProxyUsesPort } from "./tailscale-serve.ts";

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
});
