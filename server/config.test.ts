import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { claudeGateways, DATA_DIR, gatewayInstanceId, instanceConfigs, loadConfig, saveConfig, type AppConfig } from "./config.ts";
import { needsRecovery } from "./recovery.ts";

describe("OpenCode Go configuration", () => {
  it("injects the key only into OpenCode Go instances", () => {
    const cfg: AppConfig = {
      opencodeGo: { apiKey: "secret-value" },
      instances: {
        opencode: { driver: "opencodeGo" },
        grok: { driver: "grokAgent" },
      },
    };

    const instances = instanceConfigs(cfg);
    expect(instances.opencode.environment).toEqual({ OPENCODE_API_KEY: "secret-value" });
    expect(instances.grok.environment).toEqual({});
  });
});

describe("DeepSeek Harness configuration", () => {
  it("gives the key only to DeepSeek instances", () => {
    const cfg: AppConfig = {
      deepseekHarness: { apiKey: "sk-secret" },
      instances: {
        deepseek: { driver: "deepseek-harness" },
        codex: { driver: "codex" },
      },
    };

    const instances = instanceConfigs(cfg);
    expect(instances.deepseek.environment).toEqual({ DEEPSEEK_API_KEY: "sk-secret" });
    // a DeepSeek key has no business in another engine's child process
    expect(instances.codex.environment).toEqual({});
  });

  it("passes endpoint, telemetry and sandbox policy as driver config, not as environment", () => {
    // They are settings rather than secrets, and the driver decodes them —
    // routing them through the environment would put them outside the
    // validation decodeConfig applies.
    const instances = instanceConfigs({
      deepseekHarness: {
        apiKey: "sk",
        baseUrl: "https://models.internal",
        telemetry: "feedback-only",
        sandboxMode: "read-only",
        runtimeStrategy: "managed",
      },
      instances: { deepseek: { driver: "deepseek-harness" } },
    });
    expect(instances.deepseek.config).toEqual({
      baseUrl: "https://models.internal",
      telemetry: "feedback-only",
      sandbox: { mode: "read-only" },
      runtime: { strategy: "managed" },
    });
    expect(instances.deepseek.environment).toEqual({ DEEPSEEK_API_KEY: "sk" });
  });

  it("lets a hand-written instance config win over the shared form", () => {
    const instances = instanceConfigs({
      deepseekHarness: { baseUrl: "https://shared.example" },
      instances: { deepseek: { driver: "deepseek-harness", config: { baseUrl: "https://this-bot-only.example" } } },
    });
    expect((instances.deepseek.config as { baseUrl: string }).baseUrl).toBe("https://this-bot-only.example");
  });

  it("ships a default deepseek instance so the engine reaches the picker", () => {
    // Without a default entry the driver is registered but /api/instances
    // never lists it, and no amount of key-saving in Settings makes DeepSeek
    // selectable.
    const instances = instanceConfigs({ deepseekHarness: { apiKey: "sk" } });
    expect(instances.deepseek).toBeDefined();
    expect(instances.deepseek.driver).toBe("deepseek-harness");
    expect(instances.deepseek.environment).toEqual({ DEEPSEEK_API_KEY: "sk" });
    // appended last — the existing engine order in the picker stays put
    expect(Object.keys(instances).at(-1)).toBe("deepseek");
  });
});

describe("Claude gateways", () => {
  it("adds one instance per gateway without touching the built-in claude entry", () => {
    const instances = instanceConfigs({
      claudeGateways: [
        { id: "deepseek", label: "DeepSeek", baseUrl: "https://api.deepseek.com/anthropic", authToken: "sk", models: ["deepseek-v4-pro"] },
        { id: "openrouter", baseUrl: "https://openrouter.ai/api" },
      ],
    });

    // The plain claude.ai sign-in and a gateway are not alternatives — the
    // whole point of a list is that both work at once.
    expect(instances.claude.config).toBeUndefined();
    expect(instances["claude-deepseek"].driver).toBe("claudeAgent");
    expect(instances["claude-deepseek"].displayName).toBe("DeepSeek");
    expect(instances["claude-deepseek"].config).toEqual({
      baseUrl: "https://api.deepseek.com/anthropic",
      authToken: "sk",
      models: ["deepseek-v4-pro"],
    });
    // unnamed gateways fall back to the host, so two are still tellable apart
    expect(instances["claude-openrouter"].displayName).toBe("openrouter.ai");
    // appended, so they land at the end of the picker rail
    expect(Object.keys(instances).slice(-2)).toEqual(["claude-deepseek", "claude-openrouter"]);
  });

  it("migrates the older single-gateway config into the list", () => {
    const cfg: AppConfig = { claudeGateway: { baseUrl: "https://api.deepseek.com/anthropic", authToken: "sk" } };
    expect(claudeGateways(cfg)).toEqual([
      { id: "default", baseUrl: "https://api.deepseek.com/anthropic", authToken: "sk" },
    ]);
    expect(instanceConfigs(cfg)[gatewayInstanceId("default")]).toBeDefined();
  });

  it("skips a gateway with no endpoint rather than creating a broken engine", () => {
    const instances = instanceConfigs({ claudeGateways: [{ id: "empty", baseUrl: "" }] });
    expect(instances["claude-empty"]).toBeUndefined();
  });

  it("lets a hand-written instance of the same id win", () => {
    const instances = instanceConfigs({
      claudeGateways: [{ id: "deepseek", baseUrl: "https://api.deepseek.com/anthropic" }],
      instances: { "claude-deepseek": { driver: "claudeAgent", config: { baseUrl: "https://mine.example" } } },
    });
    expect((instances["claude-deepseek"].config as { baseUrl: string }).baseUrl).toBe("https://mine.example");
  });
});

describe("config.json on disk", () => {
  const file = join(DATA_DIR, "config.json");

  it("round-trips a save and keeps a last-good copy", () => {
    mkdirSync(DATA_DIR, { recursive: true });
    rmSync(file, { force: true });
    saveConfig({ profile: { name: "Ada" } });
    saveConfig({ analytics: { enabled: false } });
    expect(loadConfig()).toMatchObject({ profile: { name: "Ada" }, analytics: { enabled: false } });
    expect(JSON.parse(readFileSync(`${file}.lastgood`, "utf8"))).toMatchObject({ profile: { name: "Ada" } });
  });

  it("locks a damaged file instead of overwriting the settings in it", () => {
    mkdirSync(DATA_DIR, { recursive: true });
    const damaged = '{"profile": {"name": "Ada"}, "telegram": {"botToken": "kept"';
    writeFileSync(file, damaged);
    expect(loadConfig().profile).toBeUndefined();
    expect(needsRecovery(file)).toBe(true);
    expect(() => saveConfig({ analytics: { enabled: false } })).toThrow(expect.objectContaining({ status: 423 }));
    expect(readFileSync(file, "utf8")).toBe(damaged);
    expect(existsSync(join(DATA_DIR, ".recovery"))).toBe(true);
  });
});
