import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { AuditStore } from "./audit-store.ts";
import type { AuditRecord } from "./types.ts";
import { normalizePermissionAction } from "../governance/action.ts";

const dirs: string[] = [];
afterEach(async () => Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))));

describe("AuditStore", () => {
  it("writes redacted daily NDJSON and reads newest records", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mauscrew-audit-"));
    dirs.push(directory);
    const store = new AuditStore(directory);
    const action = normalizePermissionAction({ botId: "b1", engine: "claude", tool: "Read", summary: "curl -H Authorization: Bearer abcdefghijklmnop", raw: { token: "secret" } });
    const record: AuditRecord = {
      id: "a1",
      timestamp: "2026-08-21T10:00:00.000Z",
      agentId: "b1",
      engine: "claude",
      tool: "Read",
      action,
      policyDecision: "allow",
      policyRuleId: "safe.read-only",
      policyReason: "safe",
      result: "success",
    };
    await store.append(record);

    const disk = await readFile(join(directory, "2026-08-21.ndjson"), "utf8");
    expect(disk).not.toContain("secret");
    expect(disk).not.toContain("abcdefghijklmnop");
    expect(disk).toContain("[REDACTED]");
    await expect(store.list({ agentId: "b1" })).resolves.toHaveLength(1);
  });
});
