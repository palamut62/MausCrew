import { describe, expect, it, vi } from "vitest";

import type { ProviderAdapter, ProviderInstance, RuntimeEvent, RuntimeEventListener } from "../contracts.ts";
import { BUILT_IN_DRIVERS } from "../drivers/builtIn.ts";
import { ClaudeCodeAgentProvider } from "./claude-provider.ts";
import { CodexAgentProvider } from "./codex-provider.ts";
import { GooseAgentProvider } from "./goose-provider.ts";
import { ProviderInstanceAgentAdapter } from "./provider-instance-adapter.ts";

function fakeInstance(kind = "codex", snapshot: ProviderInstance["snapshot"] = async () => ({ state: "available", authenticated: true })) {
  const listeners = new Set<RuntimeEventListener>();
  const sendTurn = vi.fn(async () => ({ turnId: "turn-1" }));
  const interruptTurn = vi.fn(async () => undefined);
  const adapter: ProviderAdapter = {
    provider: kind, capabilities: { sessionModelSwitch: "unsupported" }, sendTurn, interruptTurn,
    respondToRequest: async () => undefined, hasSession: () => false, stopAll: async () => undefined,
    onEvent: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
  };
  const instance: ProviderInstance = { instanceId: `${kind}-1`, driverKind: kind, displayName: kind, enabled: true, models: { default: "model", options: [] }, adapter, snapshot, dispose: vi.fn(async () => undefined) };
  const emit = (event: RuntimeEvent) => { for (const listener of listeners) listener(event); };
  return { instance, sendTurn, interruptTurn, emit };
}

const base = { eventId: "event", provider: "codex", threadId: "session", turnId: "turn-1", createdAt: "2026-09-10T10:00:00.000Z" };

describe("AgentProvider facade", () => {
  it("keeps protocol details behind start, send, event and resume operations", async () => {
    const fake = fakeInstance(); const provider = new CodexAgentProvider(fake.instance);
    await provider.startSession({ id: "session", agentId: "agent", model: "gpt", cwd: "C:/repo", system: "persona", effort: "high" });
    expect(await provider.send("session", { text: "work" })).toEqual({ turnId: "turn-1" });
    expect(fake.sendTurn).toHaveBeenCalledWith(expect.objectContaining({ threadId: "session", text: "work", model: "gpt", cwd: "C:/repo", system: "persona", effort: "high" }));
    fake.emit({ ...base, type: "session.started", sessionId: "native-session", model: "gpt" });
    fake.emit({ ...base, type: "turn.completed", ok: true });
    expect(provider.getSession("session")).toMatchObject({ status: "idle", resumeCursor: "native-session" });
    await provider.send("session", { text: "continue" });
    expect(fake.sendTurn).toHaveBeenLastCalledWith(expect.objectContaining({ resumeCursor: "native-session" }));
    await provider.dispose();
  });

  it("prevents concurrent sends and routes cancellation to the provider turn", async () => {
    const fake = fakeInstance(); const provider = new ProviderInstanceAgentAdapter(fake.instance);
    await provider.startSession({ id: "session", agentId: "agent", model: "gpt", cwd: "C:/repo" });
    await provider.send("session", { text: "one" });
    await expect(provider.send("session", { text: "two" })).rejects.toThrow("busy");
    await provider.cancel("session");
    expect(fake.interruptTurn).toHaveBeenCalledWith("session", "turn-1");
    fake.emit({ ...base, type: "turn.completed", ok: true, stopReason: "cancelled" });
    expect(provider.getSession("session")?.status).toBe("cancelled");
  });

  it("fails closed for unavailable, unauthenticated and mismatched providers", async () => {
    const unavailable = fakeInstance("codex", async () => ({ state: "unavailable", reason: "missing" }));
    await expect(new CodexAgentProvider(unavailable.instance).startSession({ id: "s", agentId: "a", model: "m", cwd: "C:/repo" })).rejects.toThrow("missing");
    const unauthenticated = fakeInstance("codex", async () => ({ state: "available", authenticated: false }));
    await expect(new CodexAgentProvider(unauthenticated.instance).startSession({ id: "s", agentId: "a", model: "m", cwd: "C:/repo" })).rejects.toThrow("not authenticated");
    expect(() => new ClaudeCodeAgentProvider(fakeInstance("codex").instance)).toThrow("incompatible");
    expect(() => new GooseAgentProvider(fakeInstance("claudeAgent").instance)).toThrow("incompatible");
  });

  it("registers Goose as a first-class ACP driver without replacing Codex or Claude", () => {
    expect(BUILT_IN_DRIVERS.map((driver) => driver.driverKind)).toEqual(expect.arrayContaining(["codex", "claudeAgent", "gooseAgent"]));
    const goose = BUILT_IN_DRIVERS.find((driver) => driver.driverKind === "gooseAgent")!;
    expect(goose.defaultConfig()).toMatchObject({ cli: "goose", fullAuto: false });
    expect(goose.models).toMatchObject({ default: "auto", extensible: true });
  });
});
