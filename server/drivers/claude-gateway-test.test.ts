// The value of a probe is entirely in what it says when it fails: a status
// code tells the user nothing they can act on. These tests are mostly about
// the wording being specific enough to fix the problem.
import { describe, expect, it } from "vitest";

import { probeGateway, probeUrl } from "./claude-gateway-test.ts";

const reply = (status: number, body = "") =>
  (async () => new Response(body, { status })) as unknown as typeof fetch;

describe("where the probe knocks", () => {
  it("calls the path the CLI would, not the base URL", () => {
    expect(probeUrl("https://openrouter.ai/api")).toBe("https://openrouter.ai/api/v1/messages");
    expect(probeUrl("https://api.deepseek.com/anthropic/")).toBe(
      "https://api.deepseek.com/anthropic/v1/messages",
    );
  });
});

describe("what it says when it fails", () => {
  // The failure that prompted this: a key for another service, rejected with
  // a message that reads like a bug in the app.
  it("recognises a key that belongs to a different service", async () => {
    const result = await probeGateway(
      { baseUrl: "https://openrouter.ai/api", authToken: "sk-mg-v1-abc", model: "stealth/ox-alpha" },
      reply(401, '{"error":{"message":"Missing Authentication header"}}'),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problem).toMatch(/sk-or-/);
    expect(result.problem).toContain("different service");
  });

  it("does not accuse a correctly-prefixed key of being the wrong kind", async () => {
    const result = await probeGateway(
      { baseUrl: "https://openrouter.ai/api", authToken: "sk-or-v1-abc", model: "x/y" },
      reply(401),
    );
    if (result.ok) throw new Error("expected failure");
    expect(result.problem).not.toMatch(/different service/);
    expect(result.problem).toMatch(/rejected the key/);
  });

  it("separates a wrong address from a wrong key", async () => {
    const notFound = await probeGateway(
      { baseUrl: "https://example.com", authToken: "k", model: "m" },
      reply(404),
    );
    if (notFound.ok) throw new Error("expected failure");
    expect(notFound.problem).toMatch(/nothing at/);
    expect(notFound.problem).toMatch(/Anthropic Messages API/);
  });

  it("names the model when the model is what was refused", async () => {
    const result = await probeGateway(
      { baseUrl: "https://api.example.com", authToken: "k", model: "ghost-1" },
      reply(400, '{"error":"unknown model"}'),
    );
    if (result.ok) throw new Error("expected failure");
    expect(result.problem).toContain("ghost-1");
  });

  it("distinguishes no credit, rate limiting, and their outage", async () => {
    const cases: Array<[number, RegExp]> = [
      [402, /no credit/i],
      [429, /rate-limiting/i],
      [503, /their side/i],
    ];
    for (const [status, expected] of cases) {
      const result = await probeGateway(
        { baseUrl: "https://api.example.com", authToken: "k", model: "m" },
        reply(status),
      );
      if (result.ok) throw new Error(`expected ${status} to fail`);
      expect(result.problem, String(status)).toMatch(expected);
    }
  });

  it("says a key is missing rather than blaming the host", async () => {
    const result = await probeGateway(
      { baseUrl: "https://api.example.com", model: "m" },
      reply(401),
    );
    if (result.ok) throw new Error("expected failure");
    expect(result.problem).toMatch(/needs a key and none is set/);
  });

  // A probe that throws is a failed probe, not a crash in the settings panel.
  it("survives a network error and an unreachable host", async () => {
    const boom = (async () => {
      throw new Error("getaddrinfo ENOTFOUND");
    }) as unknown as typeof fetch;
    const result = await probeGateway(
      { baseUrl: "https://nowhere.invalid", authToken: "k", model: "m" },
      boom,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problem).toMatch(/Could not reach/);
  });

  it("refuses to test what it cannot test", async () => {
    expect((await probeGateway({ baseUrl: "", model: "m" }, reply(200))).ok).toBe(false);
    expect((await probeGateway({ baseUrl: "https://x.example", model: "" }, reply(200))).ok).toBe(false);
  });
});

describe("when it works", () => {
  it("says which host answered as which model", async () => {
    const result = await probeGateway(
      { baseUrl: "https://api.deepseek.com/anthropic", authToken: "k", model: "deepseek-v4" },
      reply(200, '{"content":[{"type":"text","text":"hi"}]}'),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.detail).toContain("api.deepseek.com");
    expect(result.detail).toContain("deepseek-v4");
  });
});
