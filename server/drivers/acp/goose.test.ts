import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import type { RuntimeEvent } from "../../contracts.ts";
import { GooseAgentDriver } from "./goose.ts";

const directories: string[] = [];
afterEach(() => { while (directories.length) rmSync(directories.pop()!, { recursive: true, force: true }); });
const FAKE_CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "testing", "fake-acp-cli.ts");

describe("Goose ACP driver", () => {
  it("runs goose acp semantics and applies a requested model over ACP", async () => {
    const root = mkdtempSync(join(tmpdir(), "mauscrew-goose-")); directories.push(root);
    const rpcDump = join(root, "rpc.json");
    const instance = await GooseAgentDriver.create({ instanceId: "goose-1", displayName: "Goose", enabled: true, config: { cli: FAKE_CLI, fullAuto: false }, environment: { FAKE_ACP_RPC_DUMP: rpcDump } });
    const events: RuntimeEvent[] = []; const unsubscribe = instance.adapter.onEvent((event) => events.push(event));
    try {
      await instance.adapter.sendTurn({ threadId: "thread", text: "hello", model: "custom-model", cwd: process.cwd() });
      await new Promise<void>((resolve, reject) => {
        const deadline = setTimeout(() => reject(new Error("Goose turn timeout")), 5_000);
        const check = setInterval(() => { if (events.some((event) => event.type === "turn.completed")) { clearTimeout(deadline); clearInterval(check); resolve(); } }, 10);
      });
      expect(events).toEqual(expect.arrayContaining([expect.objectContaining({ type: "session.started" }), expect.objectContaining({ type: "turn.completed", ok: true })]));
      expect(JSON.parse(readFileSync(rpcDump, "utf8"))).toEqual(expect.arrayContaining(["session/set_model", "session/prompt"]));
    } finally { unsubscribe(); await instance.dispose(); }
  });
});
