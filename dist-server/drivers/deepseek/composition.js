// Per-instance Cordis composition: mounting MausCrew's integrations as
// tools the DeepSeek agent can call (spec §52, §53; P4-05, P4-06, P4-07).
//
// Every other driver hands its engine a list of MCP servers per turn. The
// DeepSeek runtime has no such flag: its whole plugin tree comes from the one
// file named by DSH_CORDIS_CONFIG, read once at startup. So "mount an
// integration" here means writing a composition — the bundled one, plus an
// `@deepseek-ai/dsh-mcp-client` instance per server — and pointing the runtime
// at that copy instead.
//
// Two consequences follow from the file being read once, and both are honest
// limits rather than bugs to hide:
//
//   * the mounted set belongs to the runtime process, not to the turn. A turn
//     that needs a different set needs a new process. The driver restarts for
//     that, and only when no other turn is in flight.
//   * a stdio mount is a program the runtime spawns. Under WSL the runtime is
//     a Linux process and MausCrew's proxies are Windows executables, so
//     stdio mounts cannot cross that boundary and are not offered there
//     (spec §54: no capability reported that is not real).
//
// The generated file carries credentials — a Composio consumer key in a
// header, the box token in the computer proxy's env. It is written 0600 under
// the instance's session root, which is already the private per-instance
// directory, and rewritten rather than appended to.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { computerProxyEnv } from "../../container-computer.js";
/** Proxy entry files live beside the drivers as .ts in dev (Node's type
 * stripping) and .js in the compiled dist-server. Same resolution the Claude
 * driver uses, for the same two-shape reason. */
const proxyPath = (relative) => {
    const ts = join(dirname(fileURLToPath(import.meta.url)), "..", "..", `${relative}.ts`);
    return existsSync(ts) ? ts : ts.replace(/\.ts$/, ".js");
};
// In the packaged app process.execPath is the Electron binary; this makes it
// behave as plain node for the spawned MCP proxies (harmless in dev).
const NODE_ENV_FLAG = { ELECTRON_RUN_AS_NODE: "1" };
const TOOL_CALL_TIMEOUT_MS = 60_000;
export function mountSupport(config) {
    const stdio = config.runtime.mode !== "wsl";
    return { computerMcp: stdio, agentsMcp: stdio, routinesMcp: stdio, composioMcp: true };
}
/** Translate a turn's integrations into MCP mounts.
 *
 * `support` is applied here rather than at the call site so an integration
 * the harness sent anyway — capabilities and config can disagree after a
 * settings change — is dropped instead of producing a server that cannot
 * start. */
export function mountsFor(integrations, support) {
    if (!integrations)
        return [];
    const mounts = [];
    if (integrations.composio && support.composioMcp) {
        mounts.push({
            serverName: "composio",
            config: {
                transport: "streamable-http",
                serverName: "composio",
                url: integrations.composio.url,
                headers: { ...integrations.composio.headers },
                toolCallTimeoutMs: TOOL_CALL_TIMEOUT_MS,
                failOnStartupError: false,
            },
        });
    }
    // Cloud box and local/VM computer are one server to the model, exactly as
    // in every other driver: the agent should not have to know which computer
    // it is driving.
    if (support.computerMcp) {
        if (integrations.computer) {
            mounts.push(stdioMount("computer", process.execPath, [proxyPath("computer-proxy")], {
                ...NODE_ENV_FLAG,
                ...computerProxyEnv(integrations.computer),
            }));
        }
        else if (integrations.localComputer) {
            mounts.push(stdioMount("computer", integrations.localComputer.command, integrations.localComputer.args, integrations.localComputer.env));
        }
    }
    if (integrations.agents && support.agentsMcp) {
        mounts.push(stdioMount("agents", integrations.agents.command, integrations.agents.args, integrations.agents.env));
    }
    if (integrations.routines && support.routinesMcp) {
        mounts.push(stdioMount("routines", integrations.routines.command, integrations.routines.args, integrations.routines.env));
    }
    if (integrations.dweb && support.composioMcp) {
        mounts.push(stdioMount("dweb", process.execPath, [proxyPath("drivers/dweb-proxy")], {
            ...NODE_ENV_FLAG,
            DWEB_URL: integrations.dweb.url,
        }));
    }
    return mounts;
}
function stdioMount(serverName, command, args, env) {
    return {
        serverName,
        config: {
            transport: "stdio",
            serverName,
            command,
            args: [...args],
            env: { ...env },
            toolCallTimeoutMs: TOOL_CALL_TIMEOUT_MS,
            // The agent losing one tool server is worse handled by refusing to
            // start at all: the rest of the composition — the model, the files,
            // the approval gate — still works, and the user gets a turn that
            // explains itself rather than an instance stuck on unavailable.
            failOnStartupError: false,
        },
    };
}
/** A stable identity for a mounted set. Two turns whose fingerprints match can
 * share a runtime process; two that differ cannot, because the composition is
 * read once. Includes the credentials deliberately — a rotated box token is a
 * different mount, and reusing the process would keep calling with the old
 * one. */
export function mountFingerprint(mounts, features = {}) {
    const dynamicCordis = features.dynamicCordis === true;
    if (mounts.length === 0 && !dynamicCordis)
        return "";
    return JSON.stringify({
        dynamicCordis,
        mounts: [...mounts].sort((a, b) => a.serverName.localeCompare(b.serverName)),
    });
}
/** Render the composition: the base file verbatim, then one plugin entry per
 * mount.
 *
 * The base is copied rather than parsed. It contains `!!js` tags that only the
 * runtime's loader understands, and a round trip through a YAML library here
 * would either drop them or need a custom schema to preserve them — for no
 * benefit, since everything appended is plain data. */
export function renderComposition(baseYaml, mounts, features = {}) {
    const lines = [
        baseYaml.trimEnd(),
        "",
        "# ── generated by MausCrew ────────────────────────────────────────────",
        "# Runtime extensions and integration mounts for one process. Rewritten",
        "# whenever the mounted set changes; edits here are lost on the next turn.",
        "",
    ];
    if (features.dynamicCordis === true) {
        // Host-only by design. DeepSeek's client runner expects its own browser
        // runtime and event transport, neither of which exists in MausCrew.
        lines.push("- id: mauscrew-cordis-host-runner");
        lines.push("  name: '@deepseek-ai/dsh-cordis-host-runner'");
        lines.push("- id: mauscrew-tool-cordis");
        lines.push("  name: '@deepseek-ai/dsh-tool-cordis'");
        lines.push("");
    }
    for (const mount of mounts) {
        lines.push(`- id: mauscrew-mcp-${mount.serverName}`);
        lines.push("  name: '@deepseek-ai/dsh-mcp-client'");
        lines.push("  config:");
        lines.push(indent(toYaml(mount.config), 4));
    }
    return lines.join("\n") + "\n";
}
/** Write the rendered composition for this instance and return its path.
 * Owner-only: this file holds the tokens the mounts authenticate with. */
export function writeComposition(sessionRoot, text) {
    const dir = join(sessionRoot, "composition");
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const path = join(dir, "mauscrew.generated.cordis.yml");
    writeFileSync(path, text, { mode: 0o600 });
    return path;
}
/** Build the composition for a turn, or `null` when nothing is mounted — in
 * which case the base file is used directly and no copy is written. */
export function composeFor(config, sessionRoot, mounts, features = {}) {
    if (mounts.length === 0 && features.dynamicCordis !== true)
        return null;
    const base = config.cordis.configPath;
    // Without a base there is no approval gate and no adapter list, and a file
    // containing only mcp-client entries would start a runtime with no model.
    // Mounting into nothing is not a smaller composition, it is a broken one.
    if (!base || !existsSync(base))
        return null;
    let baseYaml = readFileSync(base, "utf8");
    // MausCrew's local plugin is relative to the bundled composition. A
    // generated composition is written under the session root, so materialize
    // this one exact local entry before copying; custom Cordis entries retain
    // their own semantics. WSL receives a Linux-visible path.
    const approvalHostPath = join(dirname(base), "mauscrew-approval.mjs");
    const approvalRuntimePath = config.runtime.mode === "wsl"
        ? approvalHostPath.replace(/^([A-Za-z]):[\\/]/, (_all, drive) => `/mnt/${drive.toLowerCase()}/`).replace(/\\/g, "/")
        : approvalHostPath;
    baseYaml = baseYaml.replace("name: './mauscrew-approval.mjs'", `name: ${JSON.stringify(approvalRuntimePath)}`);
    return writeComposition(sessionRoot, renderComposition(baseYaml, mounts, features));
}
// ── a very small YAML emitter ────────────────────────────────────────────
//
// Only the shapes an McpMount config can hold: strings, numbers, booleans,
// string arrays, and one level of string maps. Bringing in a YAML dependency
// to serialize five known field types would be more surface, not less.
function toYaml(value) {
    const out = [];
    for (const [key, item] of Object.entries(value)) {
        if (Array.isArray(item)) {
            if (item.length === 0) {
                out.push(`${key}: []`);
                continue;
            }
            out.push(`${key}:`);
            for (const entry of item)
                out.push(`  - ${scalar(entry)}`);
            continue;
        }
        if (item && typeof item === "object") {
            const entries = Object.entries(item);
            if (entries.length === 0) {
                out.push(`${key}: {}`);
                continue;
            }
            out.push(`${key}:`);
            for (const [k, v] of entries)
                out.push(`  ${quoteKey(k)}: ${scalar(v)}`);
            continue;
        }
        out.push(`${key}: ${scalar(item)}`);
    }
    return out.join("\n");
}
/** Every scalar is emitted as a double-quoted JSON string (or a bare
 * number/boolean). Quoting unconditionally is what keeps a token that happens
 * to start with `*`, `&` or `!` from being read as YAML syntax, and JSON's
 * escaping rules are a subset of YAML's for double-quoted scalars. */
function scalar(value) {
    if (typeof value === "number" && Number.isFinite(value))
        return String(value);
    if (typeof value === "boolean")
        return String(value);
    return JSON.stringify(value === undefined || value === null ? "" : String(value));
}
function quoteKey(key) {
    return /^[A-Za-z_][A-Za-z0-9_-]*$/.test(key) ? key : JSON.stringify(key);
}
function indent(text, spaces) {
    const pad = " ".repeat(spaces);
    return text
        .split("\n")
        .map((line) => (line ? pad + line : line))
        .join("\n");
}
