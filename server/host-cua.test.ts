import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateRawSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

let dir: string;
let hostCua: typeof import("./host-cua.ts");

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "mauscrew-host-cua-"));
  vi.stubEnv("MAUSCREW_DATA_DIR", dir);
  hostCua = await import("./host-cua.ts");
});

afterAll(() => {
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

/** A one-entry zip in the shape a wheel has, built the same way as
 * zip.test.ts's fixture writer. */
function wheelWith(path: string, contents: string): Buffer {
  const name = Buffer.from(path, "utf8");
  const data = Buffer.from(contents, "utf8");
  const stored = deflateRawSync(data);
  let crc = ~0;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  crc = ~crc >>> 0;

  const local = Buffer.alloc(30 + name.length);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(stored.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  name.copy(local, 30);

  const header = Buffer.alloc(46 + name.length);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(0x0314, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(8, 10);
  header.writeUInt32LE(crc, 16);
  header.writeUInt32LE(stored.length, 20);
  header.writeUInt32LE(data.length, 24);
  header.writeUInt16LE(name.length, 28);
  header.writeUInt32LE((0o755 << 16) >>> 0, 38);
  header.writeUInt32LE(0, 42);
  name.copy(header, 46);

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(header.length, 12);
  end.writeUInt32LE(local.length + stored.length, 16);
  return Buffer.concat([local, stored, header, end]);
}

const respondWith = (body: Buffer) =>
  vi.fn(async () => new Response(body, { status: 200 })) as unknown as typeof fetch;

describe("host desktop driver", () => {
  it("reads the session the same way the desktop shell does", () => {
    expect(hostCua.hostCuaSession({ XDG_SESSION_TYPE: "x11", DISPLAY: ":0" })).toBe("x11");
    expect(hostCua.hostCuaSession({ XDG_SESSION_TYPE: "wayland" })).toBe("wayland");
    // XWayland exposes DISPLAY too; the Wayland signal has to win or the
    // harness would promise control the driver cannot deliver.
    expect(hostCua.hostCuaSession({ WAYLAND_DISPLAY: "wayland-0", DISPLAY: ":0" })).toBe("wayland");
    expect(hostCua.hostCuaSession({})).toBe("headless");
  });

  it("pins one build per architecture and refuses the rest", () => {
    expect(hostCua.wheelForArch("x64")?.url).toContain("x86_64");
    expect(hostCua.wheelForArch("arm64")?.url).toContain("aarch64");
    expect(hostCua.wheelForArch("ia32")).toBeNull();
  });

  it("refuses a wheel whose bytes are not the pinned artifact", async () => {
    // The file becomes an executable that drives the user's desktop. Coming
    // from the right URL is not the bar.
    const result = await hostCua.installHostCua({
      fetchImpl: respondWith(wheelWith("cua_driver/bin/cua-driver", "#!/bin/sh\nexit 0\n")),
      arch: "x64",
    });
    expect(result.ok).toBe(false);
    expect(result.problem).toContain("does not match the pinned build");
    expect(existsSync(hostCua.HOST_CUA_BINARY)).toBe(false);
    // A failed install must not leave a descriptor that reads as ready.
    expect(JSON.parse(readFileSync(hostCua.HOST_CUA_DESCRIPTOR, "utf8")).mode).toBe("unavailable");
  });

  it("reports a download failure instead of a half-installed driver", async () => {
    const failing = vi.fn(async () => new Response("nope", { status: 503 })) as unknown as typeof fetch;
    const result = await hostCua.installHostCua({ fetchImpl: failing, arch: "x64" });
    expect(result.ok).toBe(false);
    expect(result.problem).toContain("503");
    expect(existsSync(hostCua.HOST_CUA_BINARY)).toBe(false);
  });

  it("refuses to start on a session the driver cannot drive", async () => {
    const wayland = await hostCua.startHostCua({
      env: { XDG_SESSION_TYPE: "wayland", DISPLAY: ":0" },
      platform: "linux",
    });
    expect(wayland.ok).toBe(false);
    expect(wayland.problem).toContain("Wayland");
    expect(wayland.descriptor.mode).toBe("unavailable");

    const headless = await hostCua.startHostCua({ env: {}, platform: "linux" });
    expect(headless.ok).toBe(false);
    expect(headless.problem).toContain("no graphical session");
  });

  it("refuses to start when the driver was never installed", async () => {
    const result = await hostCua.startHostCua({
      env: { XDG_SESSION_TYPE: "x11", DISPLAY: ":0" },
      platform: "linux",
    });
    expect(result.ok).toBe(false);
    expect(result.problem).toContain("not installed");
  });

  it("says nothing is supported off Linux", async () => {
    const status = await hostCua.hostCuaStatus({ platform: "win32", env: {}, arch: "x64" });
    expect(status.supported).toBe(false);
    expect((await hostCua.startHostCua({ platform: "darwin" })).ok).toBe(false);
  });

  it("keeps the digest check honest", () => {
    // Guards the constant itself: a wheel table edited to a URL without a
    // matching hash would make every install succeed silently.
    const wheel = hostCua.wheelForArch("x64")!;
    expect(wheel.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(createHash("sha256").update("x").digest("hex")).not.toBe(wheel.sha256);
  });
});
