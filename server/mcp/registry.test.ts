import { afterEach, describe, expect, it, vi } from "vitest";

import { classifyMcpTool } from "./classifier.ts";
import { mcpDisabledTool, mcpInstructionsPrompt, mcpMountsForBot, mcpSecretEnv, validateMcpServer } from "./registry.ts";

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

  it("blocks a disabled tool under every spelling an engine may use", () => {
    const cfg = {
      mcpServers: [{
        id: "db",
        name: "Postgres",
        command: "npx",
        args: ["server"],
        envNames: [],
        allowedBots: [],
        enabled: true,
        disabledTools: ["write_query"],
      }],
    };
    for (const spelling of ["mcp__custom_db__write_query", "custom_db__write_query", "write_query", "WRITE_QUERY"]) {
      expect(mcpDisabledTool(cfg, "bot-1", spelling)).toEqual({ server: "Postgres", tool: "write_query" });
    }
    expect(mcpDisabledTool(cfg, "bot-1", "mcp__custom_db__read_query")).toBeNull();
  });

  it("does not block a bot the server was never granted to", () => {
    const cfg = {
      mcpServers: [{
        id: "db",
        name: "Postgres",
        command: "npx",
        args: [],
        envNames: [],
        allowedBots: ["bot-1"],
        enabled: true,
        disabledTools: ["write_query"],
      }],
    };
    expect(mcpDisabledTool(cfg, "bot-2", "mcp__custom_db__write_query")).toBeNull();
  });

  it("carries per-server instructions into the prompt and stays empty without them", () => {
    const base = { id: "db", name: "Postgres", command: "npx", args: [], envNames: [], allowedBots: [], enabled: true };
    expect(mcpInstructionsPrompt({ mcpServers: [base] }, "bot-1")).toBe("");
    const prompt = mcpInstructionsPrompt(
      { mcpServers: [{ ...base, instructions: "Staging only.", disabledTools: ["write_query"] }] },
      "bot-1",
    );
    expect(prompt).toContain("Staging only.");
    expect(prompt).toContain("write_query");
    expect(prompt).toContain("custom_db");
  });

  it("keeps guidance fields optional and rejects malformed tool names", () => {
    expect(validateMcpServer({ id: "db", name: "Postgres", command: "npx", args: [], envNames: [], allowedBots: [] }))
      .not.toHaveProperty("disabledTools");
    expect(validateMcpServer({
      id: "db",
      name: "Postgres",
      command: "npx",
      args: [],
      envNames: [],
      allowedBots: [],
      disabledTools: ["write_query", "write_query"],
    }).disabledTools).toEqual(["write_query"]);
    expect(() => validateMcpServer({
      id: "db",
      name: "Postgres",
      command: "npx",
      args: [],
      envNames: [],
      allowedBots: [],
      disabledTools: ["write query; rm -rf /"],
    })).toThrow("disabled tool names");
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
