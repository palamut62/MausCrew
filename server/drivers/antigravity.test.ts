// Antigravity driver contract tests, run against the scripted fake `agy` CLI
// in server/testing/fake-agy-cli.ts: normalize the print-mode stream-json turn
// into canonical events, and report availability from `agy --version`.
//
// The fake CLI is a shebang script Windows cannot exec directly;
// spawnCli resolves it to `node <script>`, so these run everywhere.
import { chmodSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ensureDirs } from "../config.ts";
import type { ProviderInstance } from "../contracts.ts";
import { recordEvents, type EventRecorder } from "../testing/events.ts";
import { AntigravityDriver, meetsMinimumAgyVersion } from "./antigravity.ts";

const FAKE_CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "testing", "fake-agy-cli.ts");

describe("Antigravity decodeConfig", () => {
  it("publishes the official installer for every supported platform", () => {
    expect(AntigravityDriver.install).toMatchObject({
      command: {
        darwin: "curl -fsSL https://antigravity.google/cli/install.sh | bash",
        linux: "curl -fsSL https://antigravity.google/cli/install.sh | bash",
        win32: "irm https://antigravity.google/cli/install.ps1 | iex",
      },
    });
  });

  it("defaults to the agy binary and fullAuto on", () => {
    expect(AntigravityDriver.decodeConfig({})).toEqual({ cli: "agy", fullAuto: true });
    expect(AntigravityDriver.decodeConfig(undefined)).toEqual({ cli: "agy", fullAuto: true });
  });
  it("fullAuto defaults to true, only false when explicitly set", () => {
    expect(AntigravityDriver.decodeConfig({}).fullAuto).toBe(true);
    expect(AntigravityDriver.decodeConfig({ fullAuto: false }).fullAuto).toBe(false);
    expect(AntigravityDriver.decodeConfig({ fullAuto: true }).fullAuto).toBe(true);
  });
  it("rejects invalid types (throws → shadow snapshot)", () => {
    expect(() => AntigravityDriver.decodeConfig({ cli: 5 })).toThrow(/invalid cli/);
    expect(() => AntigravityDriver.decodeConfig({ fullAuto: "yes" })).toThrow(/invalid fullAuto/);
  });
});

describe("Antigravity turns (fake CLI)", () => {
  let instance: ProviderInstance;
  let recorder: EventRecorder;

  const create = async () => {
    instance = await AntigravityDriver.create({
      instanceId: "agy-test",
      displayName: "Antigravity Test",
      environment: {},
      enabled: true,
      config: { cli: FAKE_CLI, fullAuto: true },
    });
    recorder = recordEvents(instance.adapter);
  };

  beforeEach(() => {
    ensureDirs();
    chmodSync(FAKE_CLI, 0o755);
  });

  afterEach(async () => {
    recorder?.stop();
    await instance?.dispose();
  });

  it("normalizes a full print-mode turn into the canonical event sequence", async () => {
    await create();
    const { turnId } = await instance.adapter.sendTurn({ threadId: "t-happy", text: "hi", model: "gemini-3.1-pro-high" });
    await recorder.until((e) => e.type === "turn.completed");

    const types = recorder.events.map((e) => e.type);
    expect(types).toEqual([
      "turn.started",
      "session.started",
      "item.started", // tool ACTIVE
      "item.completed", // tool DONE
      "thread.token-usage.updated", // agent_response usage
      "content.delta", // result.response
      "item.completed", // assistant_text
      "thread.token-usage.updated", // result usage
      "turn.completed",
    ]);
    expect(recorder.events.every((e) => e.turnId === turnId && e.provider === "antigravityAgent")).toBe(true);

    const session = recorder.events.find((e) => e.type === "session.started")!;
    expect((session as any).sessionId).toBe("conv-fake-123");

    const tool = recorder.events.find((e) => e.type === "item.completed" && (e as any).itemType === "tool")!;
    expect((tool as any).ok).toBe(true);

    const usage = recorder.events.find((e) => e.type === "thread.token-usage.updated")!;
    expect(usage).toMatchObject({ input: 105, output: 20 });

    const text = recorder.events.find((e) => e.type === "item.completed" && (e as any).itemType === "assistant_text")!;
    expect((text as any).text).toBe("done from fake agy");

    const done = recorder.events.at(-1)!;
    expect(done).toMatchObject({ type: "turn.completed", ok: true });
    expect(instance.adapter.hasSession("t-happy")).toBe(false);
  });

  it("rejects respondToRequest — no interactive permission channel", async () => {
    await create();
    await expect(
      instance.adapter.respondToRequest("t-happy", "req-1", { behavior: "allow" }),
    ).rejects.toThrow(/no interactive permission channel/);
  });
});

describe("Antigravity snapshot", () => {
  it("reports available with the CLI version against the fake", async () => {
    chmodSync(FAKE_CLI, 0o755);
    const instance = await AntigravityDriver.create({
      instanceId: "agy-snap",
      displayName: undefined,
      environment: {},
      enabled: true,
      config: { cli: FAKE_CLI, fullAuto: false },
    });
    const snap = await instance.snapshot();
    expect(snap.state).toBe("available");
    expect(snap.version).toBe("1.1.12");
    // agy auth is keyring-backed with no reliable file marker, so the snapshot
    // must NOT claim signed-in from a mere directory — authenticated stays unset.
    expect((snap as any).authenticated).toBeUndefined();
    await instance.dispose();
  });

  it("a missing binary is unavailable", async () => {
    const instance = await AntigravityDriver.create({
      instanceId: "agy-missing",
      displayName: undefined,
      environment: {},
      enabled: true,
      config: { cli: "definitely-not-a-real-agy-binary", fullAuto: false },
    });
    const snap = await instance.snapshot();
    expect(snap.state).toBe("unavailable");
    await instance.dispose();
  });
});

// agy 1.0.0 answers `--print --output-format stream-json` with its help text
// and exit code 2. Installed is not usable, and the picker said "ready".
describe("Antigravity version gate", () => {
  it("accepts the version the driver was written against", () => {
    expect(meetsMinimumAgyVersion("1.1.12")).toBe(true);
    expect(meetsMinimumAgyVersion("1.1.0")).toBe(true);
    expect(meetsMinimumAgyVersion("2.0.0")).toBe(true);
    expect(meetsMinimumAgyVersion("1.2.3-beta.1")).toBe(true);
  });

  it("refuses the builds that cannot run a headless turn", () => {
    expect(meetsMinimumAgyVersion("1.0.0")).toBe(false);
    expect(meetsMinimumAgyVersion("1.0.99")).toBe(false);
    expect(meetsMinimumAgyVersion("0.9.7")).toBe(false);
  });

  it("does not refuse a version string it failed to parse", () => {
    // Refusing to run because the version could not be read would be the
    // worse mistake: the CLI may well be new enough.
    expect(meetsMinimumAgyVersion("agy (dev build)")).toBe(true);
    expect(meetsMinimumAgyVersion("")).toBe(true);
  });

  it("reports an old CLI as unavailable, with the version it found", async () => {
    const old = join(tmpdir(), `fake-agy-old-${process.pid}.mjs`);
    writeFileSync(old, "#!/usr/bin/env node\nconsole.log('1.0.0');\n");
    chmodSync(old, 0o755);
    const instance = await AntigravityDriver.create({
      instanceId: "agy-old",
      displayName: undefined,
      environment: {},
      enabled: true,
      config: { cli: old, fullAuto: false },
    });
    const snap = await instance.snapshot();
    expect(snap.state).toBe("unavailable");
    expect(snap.reason).toContain("1.0.0");
    expect(snap.reason).toMatch(/1\.1\.0 or newer/);
    await instance.dispose();
    rmSync(old, { force: true });
  });
});
