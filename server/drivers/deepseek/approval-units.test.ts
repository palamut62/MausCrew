// Unit tests for the two halves of the approval broker that can be tested
// without a process: the config surface the driver reads, and the risk
// classifier the Cordis plugin applies (spec §41, §42, §61).
//
// The plugin is imported as the plain .mjs it is — the same file the runtime
// loads — rather than a copy, so a classification that drifts here is a
// classification that drifted there.
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { approvalsActive, BUNDLED_CORDIS_CONFIG, decodeConfig, DEFAULT_APPROVAL_TIMEOUT_MS } from "./config.ts";
import {
  needsApproval,
  rememberCordisDefinition,
  summarize,
  unsupportedCordisClientReason,
} from "../../bridges/deepseek/mauscrew-approval.mjs";

describe("approval configuration", () => {
  it("defaults every bot to the composition that actually gates tools", () => {
    const config = decodeConfig({});
    expect(config.cordis.configPath).toBe(BUNDLED_CORDIS_CONFIG);
    expect(approvalsActive(config)).toBe(true);
    expect(config.approval).toEqual({ policy: "ask", timeoutMs: DEFAULT_APPROVAL_TIMEOUT_MS });
  });

  it("ships the composition and the plugin it names", () => {
    // checkCordisConfig fails a bot whose composition is missing, so a
    // packaging mistake here would take every DeepSeek bot down.
    expect(existsSync(BUNDLED_CORDIS_CONFIG)).toBe(true);
    expect(existsSync(BUNDLED_CORDIS_CONFIG.replace("mauscrew.cordis.yml", "mauscrew-approval.mjs"))).toBe(true);
  });

  it("stops claiming approvals when the user composes their own runtime", () => {
    const config = decodeConfig({ cordis: { configPath: "/opt/mine/cordis.yml" } });
    expect(approvalsActive(config)).toBe(false);
  });

  it("reads an unrecognized policy as ask, never as a free hand", () => {
    expect(decodeConfig({ approval: { policy: "always-allow" } }).approval.policy).toBe("ask");
    expect(decodeConfig({ approval: { policy: "never" } }).approval.policy).toBe("never");
  });

  it("clamps a nonsense approval deadline instead of failing the bot", () => {
    expect(decodeConfig({ approval: { timeoutMs: 0 } }).approval.timeoutMs).toBe(5_000);
    expect(decodeConfig({ approval: { timeoutMs: 999_999_999 } }).approval.timeoutMs).toBe(60 * 60 * 1000);
  });
});

describe("tool risk classification", () => {
  it("asks before anything that touches the world", () => {
    for (const tool of ["bash", "pwsh", "run_code", "write", "edit", "apply_patch", "delete", "web_fetch"]) {
      expect(needsApproval(tool)).toBe(true);
    }
  });

  it("does not ask about reading things inside a workspace the user chose", () => {
    for (const tool of ["read", "glob", "grep", "ls", "web_search", "todo_write"]) {
      expect(needsApproval(tool)).toBe(false);
    }
  });

  it("asks about every tool a connected app contributes", () => {
    expect(needsApproval("mcp_github_create_pr")).toBe(true);
    expect(needsApproval("subagent")).toBe(true);
  });

  it("treats a tool it has never heard of as dangerous", () => {
    // The list cannot be complete — a composition may register anything —
    // so the unknown case is the one that has to be safe.
    expect(needsApproval("deploy_to_production")).toBe(true);
    expect(needsApproval("")).toBe(true);
  });

  it("allows Dynamic Cordis inspection and definition but asks before activation", () => {
    for (const tool of ["cordis_inspect_list", "cordis_inspect_query", "cordis_inspect_self", "cordis_define", "cordis_stop", "cordis_undefine"]) {
      expect(needsApproval(tool)).toBe(false);
    }
    expect(needsApproval("cordis_run")).toBe(true);
  });
});

describe("Dynamic Cordis approval evidence", () => {
  it("rejects browser client code while accepting a host-only definition", () => {
    expect(unsupportedCordisClientReason("cordis_define", {
      code: { host: "return { apply() {} }", client: "return { apply() {} }" },
    })).toContain("host-side");
    expect(unsupportedCordisClientReason("cordis_define", {
      code: { host: "return { apply() {} }" },
    })).toBeNull();
  });

  it("shows the successful definition's purpose and host code before run", () => {
    const definitions = new Map<string, { name: string; purpose: string; host: string }>();
    const args = {
      plugin: { kind: "new", idPrefix: "snap" },
      name: "Snapshot helper",
      purpose: "Adds a read-only snapshot tool.",
      code: { host: "return { name: 'snapshot', apply(ctx) {} }" },
    };
    rememberCordisDefinition(definitions, "cordis_define", args, {
      isError: false,
      value: { pluginId: "snap-1", packageId: "pkg-1", name: args.name, purpose: args.purpose },
    }, "session-a");

    const detail = summarize(
      "cordis_run",
      { pluginId: "snap-1", packageId: "pkg-1", mode: "run" },
      definitions,
      "session-a",
    );
    expect(detail).toContain('Run Dynamic Cordis plugin "Snapshot helper"');
    expect(detail).toContain("Adds a read-only snapshot tool.");
    expect(detail).toContain("return { name: 'snapshot'");
  });

  it("never uses another session's source as approval evidence", () => {
    const definitions = new Map<string, { name: string; purpose: string; host: string }>();
    rememberCordisDefinition(definitions, "cordis_define", {
      name: "Private helper",
      purpose: "Session A only.",
      code: { host: "return { apply() {} }" },
    }, {
      isError: false,
      value: { pluginId: "plug-1", packageId: "pkg-1" },
    }, "session-a");
    const detail = summarize("cordis_run", { pluginId: "plug-1", packageId: "pkg-1" }, definitions, "session-b");
    expect(detail).toContain("Host code: unavailable");
    expect(detail).not.toContain("Session A only");
  });
});
