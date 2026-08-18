import { describe, expect, it } from "vitest";

import { instanceConfigs, type AppConfig } from "./config.ts";

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
