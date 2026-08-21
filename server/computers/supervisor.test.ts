import { describe, expect, it } from "vitest";

import type { ComputerProvider } from "./provider.ts";
import { ComputerSupervisor } from "./supervisor.ts";

function fakeProvider(id: "local-vm" | "box", calls: string[]): ComputerProvider {
  const result = () => ({ provider: id, configured: true, state: "ready", ready: true, persistent: true, isolated: true });
  return {
    id,
    status: async () => { calls.push(`${id}:status`); return result(); },
    start: async () => { calls.push(`${id}:start`); return result(); },
    stop: async () => { calls.push(`${id}:stop`); return result(); },
    reset: async () => { calls.push(`${id}:reset`); return result(); },
    destroy: async () => { calls.push(`${id}:destroy`); return result(); },
    getScreen: async () => ({ data: "frame", mime: "image/png" }),
    execute: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
  };
}

describe("ComputerSupervisor", () => {
  it("routes lifecycle actions to the selected provider", async () => {
    const calls: string[] = [];
    const supervisor = new ComputerSupervisor([fakeProvider("local-vm", calls), fakeProvider("box", calls)]);
    const scope = { botId: "bot-1", botName: "Research" };

    await supervisor.start("local-vm", scope);
    await supervisor.stop("box", scope);
    await supervisor.reset("box", scope);
    await supervisor.destroy("local-vm", scope);

    expect(calls).toEqual(["local-vm:start", "box:stop", "box:reset", "local-vm:destroy"]);
    expect(supervisor.list()).toEqual(["local-vm", "box"]);
  });

  it("rejects duplicate or unavailable providers", () => {
    const provider = fakeProvider("box", []);
    expect(() => new ComputerSupervisor([provider, provider])).toThrow("duplicate computer provider");
    expect(() => new ComputerSupervisor([]).provider("box")).toThrow("unavailable");
  });
});
