// DeepSeek's on-disk roots must follow MAUSCREW_DATA_DIR. A driver that wrote
// to the real ~/.mauscrew regardless would both defeat test isolation and, by
// creating that directory early, make ensureDirs() skip the .openmausbot →
// .mauscrew migration — the user's whole fleet would look lost.
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const ROOT = join(tmpdir(), "mauscrew-deepseek-paths-test");

// DATA_DIR is resolved once at import, so the env has to be in place before
// the module graph is (re)loaded.
async function loadSessionManager() {
  vi.resetModules();
  return import("./session-manager.ts");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("DeepSeek paths under MAUSCREW_DATA_DIR", () => {
  it("puts session roots under the configured data dir", async () => {
    vi.stubEnv("MAUSCREW_DATA_DIR", ROOT);
    const { defaultSessionRoot, sessionRootFor } = await loadSessionManager();

    expect(defaultSessionRoot()).toBe(join(ROOT, "deepseek-harness", "sessions"));
    expect(sessionRootFor("inst", "")).toBe(join(ROOT, "deepseek-harness", "sessions", "instance-inst"));
  });

  it("puts default workspaces under the configured data dir", async () => {
    vi.stubEnv("MAUSCREW_DATA_DIR", ROOT);
    const { defaultWorkspaceFor } = await loadSessionManager();

    expect(defaultWorkspaceFor("inst", "thread")).toBe(join(ROOT, "workspaces", "inst", "thread"));
  });

  it("still honours an explicitly configured session root", async () => {
    vi.stubEnv("MAUSCREW_DATA_DIR", ROOT);
    const { sessionRootFor } = await loadSessionManager();

    const configured = join(tmpdir(), "elsewhere");
    expect(sessionRootFor("inst", configured)).toBe(join(configured, "instance-inst"));
  });
});
