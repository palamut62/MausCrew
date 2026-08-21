import { afterEach, describe, expect, it, vi } from "vitest";

import { classifyMcpTool } from "./classifier.ts";
import { mcpMountsForBot, mcpSecretEnv, validateMcpServer } from "./registry.ts";

afterEach(() => vi.unstubAllEnvs());

describe("MCP registry", () => {
  it("classifies conservatively", () => {
    expect(classifyMcpTool("github.get_issue")).toBe("read");
    expect(classifyMcpTool("github.create_issue")).toBe("write");
    expect(classifyMcpTool("shell.execute")).toBe("execute");
    expect(classifyMcpTool("mysterious_magic")).toBe("unknown");
  });

  it("resolves encrypted environment only for granted bots", () => {
    vi.stubEnv(mcpSecretEnv("github", "API_KEY"), "secret-value");
    const cfg = {
      mcpServers: [{
        id: "github",
        name: "GitHub",
        command: "npx",
        args: ["server"],
        envNames: ["API_KEY"],
        allowedBots: ["bot-1"],
        enabled: true,
      }],
    };
    expect(mcpMountsForBot(cfg, "bot-1")).toEqual([{
      name: "custom_github",
      command: "npx",
      args: ["server"],
      env: { API_KEY: "secret-value" },
    }]);
    expect(mcpMountsForBot(cfg, "bot-2")).toEqual([]);
  });

  it("rejects shell-shaped commands and malformed environment names", () => {
    expect(() => validateMcpServer({
      id: "bad",
      name: "Bad",
      command: "tool\ncalc",
      args: [],
      envNames: [],
      allowedBots: [],
    })).toThrow("invalid command");
    expect(() => validateMcpServer({
      id: "bad",
      name: "Bad",
      command: "tool",
      args: [],
      envNames: ["BAD-NAME"],
      allowedBots: [],
    })).toThrow("environment names");
  });
});
