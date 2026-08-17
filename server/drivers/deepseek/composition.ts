// Per-instance Cordis composition: mounting OpenMausBot's integrations as
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
//     a Linux process and OpenMausBot's proxies are Windows executables, so
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

import { computerProxyEnv } from "../../container-computer.ts";
import type { SendTurnInput } from "../../contracts.ts";
import type { DeepSeekHarnessConfig } from "./config.ts";

export type TurnIntegrations = NonNullable<SendTurnInput["integrations"]>;

/** Proxy entry files live beside the drivers as .ts in dev (Node's type
 * stripping) and .js in the compiled dist-server. Same resolution the Claude
 * driver uses, for the same two-shape reason. */
const proxyPath = (relative: string): string => {
  const ts = join(dirname(fileURLToPath(import.meta.url)), "..", "..", `${relative}.ts`);
  return existsSync(ts) ? ts : ts.replace(/\.ts$/, ".js");
};

// In the packaged app process.execPath is the Electron binary; this makes it
// behave as plain node for the spawned MCP proxies (harmless in dev).
const NODE_ENV_FLAG = { ELECTRON_RUN_AS_NODE: "1" };

const TOOL_CALL_TIMEOUT_MS = 60_000;

/** One MCP server, in the shape `@deepseek-ai/dsh-mcp-client` takes.
 * `serverName` becomes the tool prefix the model sees (`mcp__<name>__<tool>`),
 * so it is also what the approval gate classifies on. */
export interface McpMount {
  serverName: string;
  config: Record<string, unknown>;
}

/** What this driver can actually mount, given where its runtime runs.
 *
 * Reported as capabilities, so the harness only builds the integrations this
 * instance can use. Under WSL the two stdio mounts are absent — not disabled
 * behind a flag, absent, because the proxies are host binaries the Linux
 * runtime cannot execute. */
export interface MountSupport {
  computerMcp: boolean;
  agentsMcp: boolean;
  composioMcp: boolean;
}

export function mountSupport(config: DeepSeekHarnessConfig): MountSupport {
  const stdio = config.runtime.mode !== "wsl";
  return { computerMcp: stdio, agentsMcp: stdio, composioMcp: true };
}

/** Translate a turn's integrations into MCP mounts.
 *
 * `support` is applied here rather than at the call site so an integration
 * the harness sent anyway — capabilities and config can disagree after a
 * settings change — is dropped instead of producing a server that cannot
 * start. */
export function mountsFor(integrations: TurnIntegrations | undefined, support: MountSupport): McpMount[] {
  if (!integrations) return [];
  const mounts: McpMount[] = [];

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
      mounts.push(
        stdioMount("computer", process.execPath, [proxyPath("computer-proxy")], {
          ...NODE_ENV_FLAG,
          ...computerProxyEnv(integrations.computer),
        }),
      );
    } else if (integrations.localComputer) {
      mounts.push(
        stdioMount(
          "computer",
          integrations.localComputer.command,
          integrations.localComputer.args,
          integrations.localComputer.env,
        ),
      );
    }
  }

  if (integrations.agents && support.agentsMcp) {
    mounts.push(stdioMount("agents", integrations.agents.command, integrations.agents.args, integrations.agents.env));
  }

  if (integrations.dweb && support.composioMcp) {
    mounts.push(
      stdioMount("dweb", process.execPath, [proxyPath("drivers/dweb-proxy")], {
        ...NODE_ENV_FLAG,
        DWEB_URL: integrations.dweb.url,
      }),
    );
  }

  return mounts;
}

function stdioMount(
  serverName: string,
  command: string,
  args: string[],
  env: Record<string, string>,
): McpMount {
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
export function mountFingerprint(mounts: McpMount[]): string {
  if (mounts.length === 0) return "";
  return JSON.stringify([...mounts].sort((a, b) => a.serverName.localeCompare(b.serverName)));
}

/** Render the composition: the base file verbatim, then one plugin entry per
 * mount.
 *
 * The base is copied rather than parsed. It contains `!!js` tags that only the
 * runtime's loader understands, and a round trip through a YAML library here
 * would either drop them or need a custom schema to preserve them — for no
 * benefit, since everything appended is plain data. */
export function renderComposition(baseYaml: string, mounts: McpMount[]): string {
  const lines: string[] = [
    baseYaml.trimEnd(),
    "",
    "# ── generated by OpenMausBot ────────────────────────────────────────────",
    "# Integration mounts for one runtime process (spec §52, §53). Rewritten",
    "# whenever the mounted set changes; edits here are lost on the next turn.",
    "",
  ];
  for (const mount of mounts) {
    lines.push(`- id: openmaus-mcp-${mount.serverName}`);
    lines.push("  name: '@deepseek-ai/dsh-mcp-client'");
    lines.push("  config:");
    lines.push(indent(toYaml(mount.config), 4));
  }
  return lines.join("\n") + "\n";
}

/** Write the rendered composition for this instance and return its path.
 * Owner-only: this file holds the tokens the mounts authenticate with. */
export function writeComposition(sessionRoot: string, text: string): string {
  const dir = join(sessionRoot, "composition");
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const path = join(dir, "openmaus.generated.cordis.yml");
  writeFileSync(path, text, { mode: 0o600 });
  return path;
}

/** Build the composition for a turn, or `null` when nothing is mounted — in
 * which case the base file is used directly and no copy is written. */
export function composeFor(
  config: DeepSeekHarnessConfig,
  sessionRoot: string,
  mounts: McpMount[],
): string | null {
  if (mounts.length === 0) return null;
  const base = config.cordis.configPath;
  // Without a base there is no approval gate and no adapter list, and a file
  // containing only mcp-client entries would start a runtime with no model.
  // Mounting into nothing is not a smaller composition, it is a broken one.
  if (!base || !existsSync(base)) return null;
  return writeComposition(sessionRoot, renderComposition(readFileSync(base, "utf8"), mounts));
}

// ── a very small YAML emitter ────────────────────────────────────────────
//
// Only the shapes an McpMount config can hold: strings, numbers, booleans,
// string arrays, and one level of string maps. Bringing in a YAML dependency
// to serialize five known field types would be more surface, not less.

function toYaml(value: Record<string, unknown>): string {
  const out: string[] = [];
  for (const [key, item] of Object.entries(value)) {
    if (Array.isArray(item)) {
      if (item.length === 0) {
        out.push(`${key}: []`);
        continue;
      }
      out.push(`${key}:`);
      for (const entry of item) out.push(`  - ${scalar(entry)}`);
      continue;
    }
    if (item && typeof item === "object") {
      const entries = Object.entries(item as Record<string, unknown>);
      if (entries.length === 0) {
        out.push(`${key}: {}`);
        continue;
      }
      out.push(`${key}:`);
      for (const [k, v] of entries) out.push(`  ${quoteKey(k)}: ${scalar(v)}`);
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
function scalar(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return String(value);
  return JSON.stringify(value === undefined || value === null ? "" : String(value));
}

function quoteKey(key: string): string {
  return /^[A-Za-z_][A-Za-z0-9_-]*$/.test(key) ? key : JSON.stringify(key);
}

function indent(text: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return text
    .split("\n")
    .map((line) => (line ? pad + line : line))
    .join("\n");
}
