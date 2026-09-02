import { EventEmitter } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

let dir: string;
let profile: typeof import("./browser-profile.ts");

/** A child that behaves like the sign-in process: prints its report line on
 * stdout, then exits. */
function fakeChild() {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    exitCode: number | null;
    kill(signal?: string): void;
    killed: string[];
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.exitCode = null;
  child.killed = [];
  child.kill = (signal = "SIGTERM") => {
    child.killed.push(signal);
  };
  return child;
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "mauscrew-browser-profile-"));
  vi.stubEnv("MAUSCREW_DATA_DIR", dir);
  profile = await import("./browser-profile.ts");
});

afterAll(() => {
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

describe("browser profile sign-in", () => {
  it("accepts only http(s) addresses", () => {
    expect(profile.validSignInUrl("https://example.com/login")).toBe("https://example.com/login");
    expect(profile.validSignInUrl("http://localhost:3000")).toBe("http://localhost:3000/");
    // This string becomes a navigation in a window that carries the
    // profile's sessions; a file: or javascript: URL there reads the machine
    // or runs script with those cookies attached.
    for (const bad of ["file:///etc/passwd", "javascript:alert(1)", "data:text/html,x", "", "   ", 42]) {
      expect(profile.validSignInUrl(bad)).toBeNull();
    }
  });

  it("records what the window ended up holding, and only the domains", async () => {
    const child = fakeChild();
    const spawnImpl = vi.fn(() => child) as unknown as typeof import("node:child_process").spawn;
    expect(profile.openSignInWindow("https://example.com/login", { spawnImpl, execPath: "node" })).toEqual({ ok: true });
    expect((await profile.browserProfileStatus()).signingIn).toBe(true);

    child.stdout.emit("data", Buffer.from(`${JSON.stringify({ ok: true, origins: ["example.com", "accounts.google.com"], at: 1_700_000_000_000 })}\n`));
    child.exitCode = 0;
    child.emit("exit", 0, null);

    const status = await profile.browserProfileStatus();
    expect(status.signingIn).toBe(false);
    expect(status.lastSeen).toEqual({ origins: ["example.com", "accounts.google.com"], at: 1_700_000_000_000 });
    // The URL reached the child through the environment, not the argv.
    const options = (spawnImpl as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][2] as {
      env: Record<string, string>;
    };
    expect(options.env.MAUSCREW_SIGNIN_URL).toBe("https://example.com/login");
    expect(options.env.MAUSCREW_PLAYWRIGHT_PROFILE).toBe(profile.PROFILE_DIR);
  });

  it("refuses a second window while one is open, and closes the one that is", async () => {
    const child = fakeChild();
    const spawnImpl = vi.fn(() => child) as unknown as typeof import("node:child_process").spawn;
    profile.openSignInWindow("https://example.com", { spawnImpl, execPath: "node" });
    expect(profile.openSignInWindow("https://other.example", { spawnImpl, execPath: "node" })).toEqual({
      ok: false,
      problem: "a sign-in window is already open",
    });
    profile.closeSignInWindow();
    expect(child.killed).toContain("SIGTERM");
    child.exitCode = 0;
    child.emit("exit", 0, "SIGTERM");
  });

  it("keeps the last known sites when a run reports nothing", async () => {
    const before = (await profile.browserProfileStatus()).lastSeen;
    const child = fakeChild();
    const spawnImpl = vi.fn(() => child) as unknown as typeof import("node:child_process").spawn;
    profile.openSignInWindow("https://example.com", { spawnImpl, execPath: "node" });
    child.stderr.emit("data", Buffer.from("chromium crashed"));
    child.exitCode = 1;
    child.emit("exit", 1, null);

    const status = await profile.browserProfileStatus();
    // A crashed window did not sign anyone out; blanking the list would be a
    // lie in the safer-looking direction.
    expect(status.lastSeen).toEqual(before);
    expect(status.problem).toContain("chromium crashed");
  });

  it("refuses to delete the profile while a window holds it open", async () => {
    const child = fakeChild();
    const spawnImpl = vi.fn(() => child) as unknown as typeof import("node:child_process").spawn;
    profile.openSignInWindow("https://example.com", { spawnImpl, execPath: "node" });
    expect(await profile.forgetBrowserProfile()).toEqual({
      ok: false,
      problem: "close the sign-in window first",
    });
    child.exitCode = 0;
    child.emit("exit", 0, null);
    expect(await profile.forgetBrowserProfile()).toEqual({ ok: true });
    expect((await profile.browserProfileStatus()).lastSeen).toBeNull();
  });
});
