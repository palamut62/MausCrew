// Desktop control on a Linux host.
//
// macOS has an embedded CUA daemon started by Electron; Windows has the Cua
// SDK bridge staged into Resources. Linux had neither, so "this computer" was
// simply refused there — the one platform where the app otherwise runs fine.
//
// It does not need a third implementation. The Local VM already downloads a
// SHA-256-pinned cua-driver wheel and runs `cua-driver serve` inside a
// container against DISPLAY=:1; the only thing that makes it a *container*
// story is where that binary runs. This installs the same pinned wheel on the
// host and serves the same socket against the user's own display, so agents
// get the identical tool inventory, and MausCrew still reimplements no clicks,
// typing, screenshots, or window discovery.
//
// Two hard limits, both reported rather than worked around:
//
//  - X11 only. Under Wayland, input injection and capture go through portals
//    cua-driver does not speak, so the honest answer is "not supported here",
//    not a bot that clicks nothing.
//  - Install is explicit. The first run downloads ~40 MB; that is a decision
//    the user makes in Settings, not something a turn does behind their back.
import { spawn, execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { writeFileAtomic } from "./atomic.js";
import { DATA_DIR } from "./config.js";
import { CUA_DRIVER_VERSION, LINUX_WHEELS } from "./container-computer.js";
import { readZipEntries } from "./zip.js";
const run = promisify(execFile);
/** Same rule as electron/capabilities.cjs, restated here because the harness
 * has no access to that module and must not guess differently from the UI. */
export function hostCuaSession(env = process.env) {
    const declared = String(env.XDG_SESSION_TYPE ?? "").toLowerCase();
    if (declared === "wayland")
        return "wayland";
    if (declared === "x11" || declared === "xorg")
        return "x11";
    if (env.WAYLAND_DISPLAY)
        return "wayland";
    if (env.DISPLAY)
        return "x11";
    return "headless";
}
export const HOST_CUA_DIR = join(DATA_DIR, "runtimes", "cua");
export const HOST_CUA_BINARY = join(HOST_CUA_DIR, CUA_DRIVER_VERSION, "cua-driver");
export const HOST_CUA_SOCKET = join(HOST_CUA_DIR, "cua-driver.sock");
/** Read by readCuaConnection() here and by hostDriverStatus() in Electron. */
export const HOST_CUA_DESCRIPTOR = join(HOST_CUA_DIR, "host-connection.json");
/** The wheel for this machine, or null when the architecture has none. */
export function wheelForArch(arch = process.arch) {
    if (arch === "x64")
        return LINUX_WHEELS.x86_64;
    if (arch === "arm64")
        return LINUX_WHEELS.aarch64;
    return null;
}
async function writeDescriptor(descriptor) {
    await mkdir(HOST_CUA_DIR, { recursive: true });
    writeFileAtomic(HOST_CUA_DESCRIPTOR, JSON.stringify(descriptor, null, 2), { mode: 0o600 });
    return descriptor;
}
export async function readDescriptor() {
    try {
        const parsed = JSON.parse(await readFile(HOST_CUA_DESCRIPTOR, "utf8"));
        return parsed?.mode ? parsed : { mode: "unavailable" };
    }
    catch {
        return { mode: "unavailable" };
    }
}
/** The one file in the wheel worth extracting. Wheel paths use forward
 * slashes, but archives written elsewhere have been seen with backslashes,
 * so matching normalizes rather than trusting the separator. */
function isDriverEntry(name) {
    return name.replaceAll("\\", "/").endsWith("cua_driver/bin/cua-driver");
}
/**
 * Download, verify, and unpack the pinned driver.
 *
 * The SHA-256 is checked before a single byte is written to disk: this file
 * becomes an executable that drives the user's desktop, so "downloaded from
 * the right URL" is not the bar — "is byte-for-byte the pinned artifact" is.
 */
export async function installHostCua({ fetchImpl = fetch, arch = process.arch } = {}) {
    const wheel = wheelForArch(arch);
    if (!wheel)
        return { ok: false, problem: `no pinned cua-driver build for ${arch}` };
    await writeDescriptor({ mode: "installing" });
    try {
        const response = await fetchImpl(wheel.url);
        if (!response.ok)
            throw new Error(`download failed with HTTP ${response.status}`);
        const bytes = Buffer.from(await response.arrayBuffer());
        const digest = createHash("sha256").update(bytes).digest("hex");
        if (digest !== wheel.sha256) {
            throw new Error(`wheel digest ${digest.slice(0, 12)}… does not match the pinned build`);
        }
        const [driver] = readZipEntries(bytes, isDriverEntry);
        if (!driver)
            throw new Error("the wheel did not contain cua-driver");
        const target = HOST_CUA_BINARY;
        await mkdir(join(HOST_CUA_DIR, CUA_DRIVER_VERSION), { recursive: true });
        await writeFile(target, driver.data);
        await chmod(target, 0o755);
        const { stdout } = await run(target, ["--version"], { timeout: 20_000 });
        const version = stdout.trim();
        if (version !== `cua-driver ${CUA_DRIVER_VERSION}`) {
            throw new Error(`unpacked driver reports "${version}"`);
        }
        await writeDescriptor({ mode: "unavailable", reason: "installed; not started yet", version });
        return { ok: true, version };
    }
    catch (error) {
        const problem = error instanceof Error ? error.message : String(error);
        // Never leave a half-written binary that a later run would treat as
        // installed.
        await rm(join(HOST_CUA_DIR, CUA_DRIVER_VERSION), { recursive: true, force: true }).catch(() => { });
        await writeDescriptor({ mode: "unavailable", reason: problem });
        return { ok: false, problem };
    }
}
let daemon = null;
function socketReady(timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    return new Promise((resolve) => {
        const tick = () => {
            if (existsSync(HOST_CUA_SOCKET))
                return resolve(true);
            if (Date.now() > deadline)
                return resolve(false);
            setTimeout(tick, 200).unref?.();
        };
        tick();
    });
}
/**
 * Start the host daemon and publish the connection agents mount.
 *
 * The descriptor deliberately has the same shape the macOS path writes, so
 * readCuaConnection() decodes both with one code path and a turn never learns
 * which platform produced it.
 */
export async function startHostCua({ env = process.env, platform = process.platform } = {}) {
    if (platform !== "linux") {
        return { ok: false, problem: "the host driver is the Linux path only", descriptor: { mode: "unavailable" } };
    }
    const session = hostCuaSession(env);
    if (session !== "x11") {
        const reason = session === "wayland"
            ? "this is a Wayland session; desktop control needs X11"
            : "no graphical session was found";
        return { ok: false, problem: reason, descriptor: await writeDescriptor({ mode: "unavailable", reason }) };
    }
    if (!existsSync(HOST_CUA_BINARY)) {
        const reason = "the desktop driver is not installed yet";
        return { ok: false, problem: reason, descriptor: await writeDescriptor({ mode: "unavailable", reason }) };
    }
    if (daemon && daemon.exitCode === null && existsSync(HOST_CUA_SOCKET)) {
        return { ok: true, descriptor: await readDescriptor() };
    }
    await mkdir(HOST_CUA_DIR, { recursive: true });
    await rm(HOST_CUA_SOCKET, { force: true }).catch(() => { });
    const driverEnv = {
        ...process.env,
        DISPLAY: env.DISPLAY ?? ":0",
        CUA_DRIVER_INSTALL_CHANNEL: "python_package",
        CUA_DRIVER_RS_TELEMETRY_ENABLED: "0",
    };
    daemon = spawn(HOST_CUA_BINARY, ["serve", "--socket", HOST_CUA_SOCKET, "--permission-mode", "standard"], {
        env: driverEnv,
        stdio: ["ignore", "ignore", "pipe"],
        detached: false,
    });
    let stderr = "";
    daemon.stderr?.on("data", (chunk) => {
        stderr = `${stderr}${chunk}`.slice(-2000);
    });
    daemon.on("exit", () => {
        daemon = null;
        void writeDescriptor({ mode: "unavailable", reason: stderr.trim().slice(-300) || "the desktop driver stopped" });
    });
    if (!(await socketReady(20_000))) {
        daemon.kill();
        daemon = null;
        const reason = stderr.trim().slice(-300) || "the desktop driver did not start listening";
        return { ok: false, problem: reason, descriptor: await writeDescriptor({ mode: "unavailable", reason }) };
    }
    return {
        ok: true,
        descriptor: await writeDescriptor({
            mode: "host",
            version: CUA_DRIVER_VERSION,
            mcpCommand: HOST_CUA_BINARY,
            mcpArgs: ["mcp", "--socket", HOST_CUA_SOCKET],
            mcpEnv: {
                DISPLAY: driverEnv.DISPLAY,
                CUA_DRIVER_INSTALL_CHANNEL: "python_package",
                CUA_DRIVER_RS_TELEMETRY_ENABLED: "0",
            },
        }),
    };
}
export async function stopHostCua() {
    const child = daemon;
    daemon = null;
    if (child && child.exitCode === null) {
        child.kill("SIGTERM");
        // The exit handler rewrites the descriptor; do it here too in case the
        // process is already gone and the handler never fires.
    }
    await rm(HOST_CUA_SOCKET, { force: true }).catch(() => { });
    await writeDescriptor({ mode: "unavailable", reason: "stopped" });
}
export async function hostCuaStatus({ env = process.env, platform = process.platform, arch = process.arch } = {}) {
    const session = platform === "linux" ? hostCuaSession(env) : "headless";
    const descriptor = await readDescriptor();
    const supported = platform === "linux" && session === "x11" && wheelForArch(arch) !== null;
    return {
        supported,
        session,
        installed: existsSync(HOST_CUA_BINARY),
        running: descriptor.mode === "host",
        version: CUA_DRIVER_VERSION,
        arch,
        ...(descriptor.reason && descriptor.mode !== "host" ? { problem: descriptor.reason } : {}),
        ...(platform === "linux" && !supported && session !== "x11"
            ? { problem: session === "wayland" ? "this is a Wayland session; desktop control needs X11" : "no graphical session was found" }
            : {}),
    };
}
