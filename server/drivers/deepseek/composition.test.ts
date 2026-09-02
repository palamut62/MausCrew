// Integration mounting (spec §52, §53; P4-05, P4-06, P4-07).
//
// The unit half. What is checked here is the part that has to be exactly
// right before a runtime ever sees it: which integrations become mounts on
// which platform, what identity a mounted set has, and that a credential
// cannot escape its quotes and become YAML syntax.
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { BUNDLED_CORDIS_CONFIG, decodeConfig } from "./config.ts";
import {
  composeFor,
  mountFingerprint,
  mountSupport,
  mountsFor,
  renderComposition,
  type TurnIntegrations,
} from "./composition.ts";

const HOST = { computerMcp: true, agentsMcp: true, routinesMcp: true, composioMcp: true };

const ALL: TurnIntegrations = {
  composio: { url: "https://mcp.composio.dev/x", headers: { "x-api-key": "ck_live_1" } },
  computer: { kind: "box", boxId: "bx_1", token: "box-token" },
  agents: { command: "node", args: ["/proxy.js"], env: { MAUSCREW_COMMS_TOKEN: "t" } },
  dweb: { url: "http://127.0.0.1:7777" },
};

describe("bundled sandbox composition", () => {
  it("confines both shell and filesystem tools with the fail-closed local provider", () => {
    const base = readFileSync(BUNDLED_CORDIS_CONFIG, "utf8");
    expect(base).toContain("@deepseek-ai/dsh-sandbox-local");
    expect(base).toContain("@deepseek-ai/dsh-sandbox-policy");
    expect(base).toContain("toolBash: !!js");
    expect(base).toContain("name: '@deepseek-ai/dsh-bash-local'");
    expect(base).toContain("@deepseek-ai/dsh-fs-sandbox");
    expect(base).toContain("@deepseek-ai/dsh-tool-str-replace-editor");
    expect(base).toContain("@deepseek-ai/dsh-user-questions");
    expect(base).toContain("@deepseek-ai/dsh-tool-ask-user");
    expect(base).toContain("DSH_SANDBOX_MODE === 'danger-full-access'");
    expect(base).not.toContain("@deepseek-ai/dsh-fs-local");
  });
});

describe("mountSupport", () => {
  it("offers every mount when the runtime runs on this machine", () => {
    expect(mountSupport(decodeConfig({ runtime: { mode: "external-python" } }))).toEqual(HOST);
  });

  it("withholds the stdio mounts under WSL", () => {
    // The proxies are host executables; a Linux runtime cannot spawn them.
    // Reporting the capability anyway would put a Local VM option in front of
    // a user for whom every call fails (§54).
    const wsl = mountSupport(decodeConfig({ runtime: { mode: "wsl" } }));
    expect(wsl).toEqual({ computerMcp: false, agentsMcp: false, routinesMcp: false, composioMcp: true });
  });
});

describe("mountsFor", () => {
  it("turns each integration into one mcp-client config", () => {
    const mounts = mountsFor(ALL, HOST);
    expect(mounts.map((m) => m.serverName).sort()).toEqual(["agents", "composio", "computer", "dweb"]);

    const composio = mounts.find((m) => m.serverName === "composio")!;
    expect(composio.config).toMatchObject({
      transport: "streamable-http",
      url: "https://mcp.composio.dev/x",
      headers: { "x-api-key": "ck_live_1" },
    });

    // the box is reached through MausCrew's REST-to-MCP proxy, exactly as
    // in every other driver — the agent should not know which computer it is
    const computer = mounts.find((m) => m.serverName === "computer")!;
    expect(computer.config.transport).toBe("stdio");
    expect(String((computer.config.args as string[])[0])).toMatch(/computer-proxy\.(ts|js)$/);
  });

  it("prefers a direct local computer connection over the box proxy", () => {
    const mounts = mountsFor(
      { localComputer: { command: "/usr/bin/cua", args: ["--stdio"], env: { A: "1" } } },
      HOST,
    );
    expect(mounts).toHaveLength(1);
    expect(mounts[0].config).toMatchObject({ serverName: "computer", command: "/usr/bin/cua" });
  });

  it("mounts only the same server once when both computers are offered", () => {
    // Two `computer` mcp-client instances would collide on the serverName
    // namespace and fail plugin load, taking the whole composition with them.
    const mounts = mountsFor(
      {
        computer: { kind: "box", boxId: "bx_1", token: "t" },
        localComputer: { command: "/usr/bin/cua", args: [], env: {} },
      },
      HOST,
    );
    expect(mounts.filter((m) => m.serverName === "computer")).toHaveLength(1);
  });

  it("drops what this platform cannot mount instead of producing a dead server", () => {
    const mounts = mountsFor(ALL, { computerMcp: false, agentsMcp: false, routinesMcp: false, composioMcp: true });
    expect(mounts.map((m) => m.serverName)).toEqual(["composio", "dweb"]);
  });

  it("mounts nothing when there is nothing to mount", () => {
    expect(mountsFor(undefined, HOST)).toEqual([]);
    expect(mountsFor({}, HOST)).toEqual([]);
  });
});

describe("mountFingerprint", () => {
  it("is empty for no mounts, so an unmounted instance never restarts", () => {
    expect(mountFingerprint([])).toBe("");
  });

  it("ignores the order the harness happened to build them in", () => {
    const a = mountsFor(ALL, HOST);
    expect(mountFingerprint([...a].reverse())).toBe(mountFingerprint(a));
  });

  it("changes when a credential rotates", () => {
    // Reusing the process here would keep calling with the old token, which
    // reads to the user as an integration that silently stopped working.
    const before = mountsFor({ computer: { kind: "box", boxId: "bx_1", token: "old" } }, HOST);
    const after = mountsFor({ computer: { kind: "box", boxId: "bx_1", token: "new" } }, HOST);
    expect(mountFingerprint(after)).not.toBe(mountFingerprint(before));
  });

  it("treats Dynamic Cordis as a process-level runtime feature", () => {
    expect(mountFingerprint([], { dynamicCordis: true })).not.toBe("");
    expect(mountFingerprint([], { dynamicCordis: true })).not.toBe(mountFingerprint([]));
  });
});

describe("renderComposition", () => {
  const base = "- id: agent-core\n  name: '@deepseek-ai/dsh-agent-spine-demo'\n";

  it("keeps the base composition verbatim, including its !!js tags", () => {
    const tagged = base + "- id: bash\n  config:\n    cwd: !!js process.env.DSH_CWD\n";
    const out = renderComposition(tagged, mountsFor(ALL, HOST));
    expect(out).toContain("cwd: !!js process.env.DSH_CWD");
    expect(out.indexOf("agent-core")).toBeLessThan(out.indexOf("mauscrew-mcp-"));
  });

  it("emits one plugin entry per mount", () => {
    const out = renderComposition(base, mountsFor(ALL, HOST));
    for (const name of ["composio", "computer", "agents", "dweb"]) {
      expect(out).toContain(`- id: mauscrew-mcp-${name}`);
    }
    expect(out.match(/name: '@deepseek-ai\/dsh-mcp-client'/g)).toHaveLength(4);
  });

  it("quotes a credential that would otherwise be read as YAML syntax", () => {
    const out = renderComposition(
      base,
      mountsFor({ composio: { url: "https://x", headers: { auth: "*alias &anchor: !tag #c" } } }, HOST),
      );
    expect(out).toContain('auth: "*alias &anchor: !tag #c"');
  });

  it("escapes a quote inside a value rather than closing the scalar", () => {
    const out = renderComposition(
      base,
      mountsFor({ composio: { url: "https://x", headers: { auth: 'a"b\\c' } } }, HOST),
    );
    expect(out).toContain('auth: "a\\"b\\\\c"');
  });

  it("mounts only the host-side Dynamic Cordis runtime", () => {
    const out = renderComposition(base, [], { dynamicCordis: true });
    expect(out).toContain("@deepseek-ai/dsh-cordis-host-runner");
    expect(out).toContain("@deepseek-ai/dsh-tool-cordis");
    expect(out).not.toContain("cordis-client-runner");
    expect(out).not.toContain("ui-cordis");
  });
});

describe("composeFor", () => {
  let scratch: string;
  beforeEach(() => {
    scratch = mkdtempSync(join(tmpdir(), "mauscrew-dsh-comp-"));
  });
  afterEach(() => {
    rmSync(scratch, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });

  it("writes a composition owner-only and returns its path", () => {
    const config = decodeConfig({ runtime: { mode: "external-python" } });
    const path = composeFor(config, scratch, mountsFor(ALL, HOST));
    expect(path).not.toBeNull();
    expect(existsSync(path!)).toBe(true);
    const text = readFileSync(path!, "utf8");
    expect(text).toContain("mauscrew-mcp-composio");
    expect(text).toContain("mauscrew-approval.mjs");
    expect(text).not.toContain("name: './mauscrew-approval.mjs'");
    // The file holds the box token and the Composio key. 0600 on POSIX;
    // Windows mode bits do not carry the same meaning, so it is not asserted.
    if (process.platform !== "win32") {
      expect(statSync(path!).mode & 0o077).toBe(0);
    }
  });

  it("writes nothing when there is nothing to mount", () => {
    const config = decodeConfig({ runtime: { mode: "external-python" } });
    expect(composeFor(config, scratch, [])).toBeNull();
  });

  it("writes a composition for Dynamic Cordis even without MCP mounts", () => {
    const config = decodeConfig({ runtime: { mode: "external-python" } });
    const path = composeFor(config, scratch, [], { dynamicCordis: true });
    expect(path).not.toBeNull();
    expect(readFileSync(path!, "utf8")).toContain("@deepseek-ai/dsh-tool-cordis");
  });

  it("refuses to compose onto a base that is not there", () => {
    // A file of only mcp-client entries is not a smaller composition, it is a
    // runtime with no model and no approval gate. The driver turns this null
    // into a message rather than a silent downgrade.
    const config = decodeConfig({
      runtime: { mode: "external-python" },
      cordis: { configPath: join(scratch, "nope.yml") },
    });
    expect(composeFor(config, scratch, mountsFor(ALL, HOST))).toBeNull();
  });
});
