import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { augmentedPath } from "./env-path.js";
const run = promisify(execFile);
export function tailscaleServeProxy(status, hostname) {
    if (!status || typeof status !== "object")
        return null;
    const web = status.Web;
    if (!web || typeof web !== "object")
        return null;
    const entry = web[`${hostname}:443`];
    const proxy = entry?.Handlers?.["/"]?.Proxy;
    return typeof proxy === "string" ? proxy : null;
}
export function tailscaleServeProxyUsesPort(proxy, port) {
    if (!proxy)
        return false;
    try {
        const target = new URL(proxy);
        return (target.protocol === "http:" &&
            (target.hostname === "localhost" || target.hostname === "127.0.0.1" || target.hostname === "::1") &&
            Number(target.port || 80) === port);
    }
    catch {
        return false;
    }
}
/** A .ts.net pairing URL is useful only when Tailscale Serve points at this
 * exact harness port. Other HTTPS reverse proxies are left alone. */
export async function verifyTailscaleServe(publicUrl, localPort) {
    if (!publicUrl.hostname.toLowerCase().endsWith(".ts.net"))
        return { ok: true, checked: false };
    const command = `tailscale serve --bg localhost:${localPort}`;
    try {
        const { stdout } = await run("tailscale", ["serve", "status", "--json"], {
            timeout: 5000,
            encoding: "utf8",
            env: { ...process.env, PATH: augmentedPath() },
            windowsHide: true,
        });
        const proxy = tailscaleServeProxy(JSON.parse(stdout), publicUrl.hostname);
        if (tailscaleServeProxyUsesPort(proxy, localPort))
            return { ok: true, checked: true };
    }
    catch {
        // The actionable message below covers a missing CLI, invalid JSON, and a
        // stale/disabled Serve mapping without leaking the raw process failure.
    }
    return {
        ok: false,
        checked: true,
        error: `Tailscale is not forwarding this address to MausCrew. Run: ${command}, then create a new pairing link.`,
    };
}
