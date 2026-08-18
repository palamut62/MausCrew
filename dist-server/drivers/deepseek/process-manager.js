// Bridge process lifecycle (spec §24, §25).
//
// Owns finding an interpreter, building the child environment, spawning
// without a shell, and reaping. It deliberately knows nothing about the
// protocol — bridge.ts drives the conversation, this only produces a live
// process or a typed failure.
//
// Two rules shape the whole file:
//
//   * argv arrays, never command strings. A cwd or a WSL distribution name
//     concatenated into a shell line is a command injection, and the user
//     controls both (spec §25, §81).
//   * an allowlisted environment, never a copy of process.env. The agent
//     runs shell tools; handing it the server's AWS keys, GITHUB_TOKEN or
//     DATABASE_URL because they happened to be in scope is how a coding
//     agent becomes a credential exfiltration path (spec §12).
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execCli, killCliTree, spawnCli } from "../../procs.js";
import { augmentedPath } from "../../env-path.js";
import { approvalsActive } from "./config.js";
import { MAILBOX_DIRNAME } from "./approval-mailbox.js";
import { DeepSeekBridgeError } from "./errors.js";
export const BRIDGE_SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "bridges", "deepseek", "bridge.py");
/** Data directory names the managed runtime may live under, current name
 * first. The app was renamed twice and a runtime provisioned before a rename
 * still sits in the old directory, so the old names stay probeable rather
 * than turning into "interpreter not found". Kept in step with
 * LEGACY_DATA_DIRS in server/config.ts — same names, same order — but
 * declared locally so this module does not pull in the config module. */
const RUNTIME_HOME_DIRNAMES = [".mauscrew", ".openmausbot", ".opengrokbot"];
/** Interpreter probe order (spec §25). A configured path wins outright —
 * if the user pointed us at an interpreter and it does not work, falling
 * back to a different one silently would install the SDK checks against a
 * Python they never chose. */
export function pythonCandidates(config) {
    if (config.runtime.mode === "wsl") {
        const distro = config.runtime.distribution;
        const prefix = distro ? ["wsl.exe", "-d", distro, "--"] : ["wsl.exe", "--"];
        if (config.runtime.strategy === "managed" || config.runtime.strategy === "bundled") {
            // WSL resolves `~` for --cd before exec, so the distro user's home does
            // not have to be guessed on Windows. Running the venv interpreter as a
            // direct executable also preserves every following argv item verbatim.
            return RUNTIME_HOME_DIRNAMES.map((dirname) => [
                ...(distro ? ["wsl.exe", "-d", distro] : ["wsl.exe"]),
                "--cd",
                "~",
                "--exec",
                `./${dirname}/runtimes/deepseek/venv/bin/python`,
            ]);
        }
        const interpreter = config.pythonPath || config.runtime.executable || "python3";
        return [[...prefix, interpreter]];
    }
    if (config.pythonPath)
        return [[config.pythonPath]];
    if (config.runtime.executable)
        return [[config.runtime.executable]];
    if (config.runtime.strategy === "managed" || config.runtime.strategy === "bundled") {
        return RUNTIME_HOME_DIRNAMES.map((dirname) => [
            process.platform === "win32"
                ? join(homedir(), dirname, "runtimes", "deepseek", "venv", "Scripts", "python.exe")
                : join(homedir(), dirname, "runtimes", "deepseek", "venv", "bin", "python3"),
        ]);
    }
    return process.platform === "win32"
        ? [["py", "-3"], ["python"], ["python3"]]
        : [["python3"], ["python"]];
}
/** The candidates worth actually spawning, in order.
 *
 * Off WSL a missing file is a spawn failure with a worse error message, so
 * candidates that are plainly not there are dropped first — but never all of
 * them: an empty list would turn "no runtime installed" into "nothing
 * configured". Under WSL the host cannot stat the distribution's filesystem,
 * so every candidate stays and the probe learns which one works by trying it. */
export function runnableCandidates(config) {
    const candidates = pythonCandidates(config);
    if (config.runtime.mode === "wsl" || candidates.length < 2)
        return candidates;
    const present = candidates.filter((argv) => argv.length === 1 && existsSync(argv[0]));
    return present.length ? present : [candidates[0]];
}
/** Candidate argv that last answered a probe, keyed by the first candidate of
 * its list. Under WSL nothing can be stat'ed, so the only way to know which
 * home directory holds the runtime is that a probe already ran one — and
 * probeSdk/resolveBundledRuntime run before any turn does. Absent that
 * knowledge the first (current-name) candidate is used, so a normally
 * installed runtime behaves exactly as before. */
const workingCandidates = new Map();
function rememberCandidate(candidates, chosen) {
    const key = candidates[0]?.join("\u0000");
    if (key)
        workingCandidates.set(key, chosen);
}
function preferredCandidate(candidates) {
    const key = candidates[0]?.join("\u0000");
    const remembered = key ? workingCandidates.get(key) : undefined;
    return remembered ?? candidates[0];
}
/** Resolve the single-file executable carried by the pinned runtime wheel.
 * Python is used only as the package lookup here; once resolved, the native
 * transport execs the returned argv and Python is not in the data path. */
export function resolveBundledRuntime(config, timeoutMs = 15_000) {
    if (config.runtime.executable)
        return Promise.resolve({ launchArgs: [config.runtime.executable] });
    const candidates = runnableCandidates(config);
    if (!candidates.length)
        return Promise.resolve({ launchArgs: [], reason: "no runtime lookup interpreter configured" });
    const probe = "import json\n" +
        "try:\n" +
        " from deepseek_harness_runtime import resolve_bundled_launch_args\n" +
        " print(json.dumps({'ok': True, 'argv': list(resolve_bundled_launch_args())}))\n" +
        "except Exception as e:\n" +
        " print(json.dumps({'ok': False, 'error': type(e).__name__ + ': ' + str(e)}))\n";
    // Candidates are tried in order and the first that answers wins. The reason
    // reported on total failure is the first one's, because that is the path a
    // correctly installed runtime would be at.
    const attempt = (index, firstReason) => {
        const candidate = candidates[index];
        if (!candidate?.length) {
            return Promise.resolve({ launchArgs: [], reason: firstReason ?? "bundled runtime was not found" });
        }
        const [command, ...prefixArgs] = candidate;
        return new Promise((resolve) => {
            execCli(command, [...prefixArgs, "-c", probe], { timeout: timeoutMs, env: { PATH: augmentedPath() } }, (err, stdout) => {
                const next = (reason) => resolve(attempt(index + 1, firstReason ?? reason));
                if (err)
                    return next(err.message);
                try {
                    const parsed = JSON.parse(stdout.trim().split("\n").pop() ?? "{}");
                    const launchArgs = Array.isArray(parsed.argv)
                        ? parsed.argv.filter((value) => typeof value === "string" && value.length > 0)
                        : [];
                    if (parsed.ok && launchArgs.length) {
                        rememberCandidate(candidates, candidate);
                        return resolve({ launchArgs });
                    }
                    return next(String(parsed.error ?? "bundled runtime was not found"));
                }
                catch {
                    return next("could not read the bundled runtime location");
                }
            });
        });
    };
    return attempt(0);
}
/** Windows paths mean nothing to a Linux interpreter, so a workspace handed
 * to a WSL bridge is translated. Done in JS rather than by shelling out to
 * `wslpath` because that would mean composing a command line out of a
 * user-supplied path — the thing this module exists to avoid. */
export function toWslPath(windowsPath) {
    const match = /^([A-Za-z]):[\\/](.*)$/.exec(windowsPath);
    if (!match)
        return windowsPath.replace(/\\/g, "/");
    const [, drive, rest] = match;
    return `/mnt/${drive.toLowerCase()}/${rest.replace(/\\/g, "/")}`;
}
/** Every path crossing into the runtime uses the same platform mapping.
 * Keeping turn cwd on this seam prevents a Windows path from being treated
 * as a relative Linux name by the SDK. */
export function runtimePath(config, path) {
    return config.runtime.mode === "wsl" ? toWslPath(path) : path;
}
/** The child's entire environment. Built from nothing, not filtered from
 * process.env: an allowlist that starts empty cannot leak a variable
 * somebody adds later. PATH and the platform loader variables are the only
 * inherited ones, because a process cannot start without them. */
export function buildBridgeEnv(input) {
    const { config, apiKey, sessionRoot, instanceEnv } = input;
    // Under WSL the interpreter is Linux, so every path we hand it has to be
    // one it can open. Missing this is not a cosmetic bug: a Windows session
    // root reaches the runtime as a relative-looking name and the session log
    // — the model's whole context (spec §48) — lands somewhere unintended.
    const p = config.runtime.mode === "wsl" ? toWslPath : (value) => value;
    // Only when the gate is actually composed and set to ask. Under `never`
    // the plugin refuses without a round trip, so handing it a directory would
    // suggest a channel that nothing is listening on.
    const approvalDir = sessionRoot && (input.approvalChannelActive ?? approvalsActive(config)) && config.approval.policy === "ask"
        ? join(sessionRoot, MAILBOX_DIRNAME)
        : "";
    const env = {
        PATH: augmentedPath(),
        // unbuffered stdio: a buffered bridge would hold streaming deltas until
        // its pipe filled, which reads to the user as a frozen turn
        PYTHONUNBUFFERED: "1",
        PYTHONIOENCODING: "utf-8",
    };
    // Windows needs these to load system DLLs at all; POSIX needs HOME for
    // anything that resolves ~ (the SDK's default session root does).
    for (const key of ["SystemRoot", "SYSTEMROOT", "TEMP", "TMP", "COMSPEC", "HOME", "USERPROFILE", "LANG", "TZ"]) {
        const value = process.env[key];
        if (value)
            env[key] = value;
    }
    if (apiKey)
        env.DEEPSEEK_API_KEY = apiKey;
    if (config.baseUrl)
        env.DEEPSEEK_BASE_URL = config.baseUrl;
    env.DSH_BRIDGE_PROVIDER = config.provider;
    env.DSH_BRIDGE_MODEL = config.defaultModel;
    if (sessionRoot)
        env.DSH_SESSION_ROOT = p(sessionRoot);
    if (config.cordis.configPath)
        env.DSH_CORDIS_CONFIG = p(config.cordis.configPath);
    // The bundled composition mounts the fail-closed local sandbox provider
    // and reads this policy. It is process-global, so changing it reloads the
    // provider instance just like changing the composition itself.
    env.DSH_SANDBOX_MODE = config.sandbox.mode;
    // Generated integration compositions live under the session root, not
    // beside the two MausCrew plugins. Absolute, runtime-native paths keep
    // those plugins resolvable after the composition is copied there.
    // The approval mailbox (spec §37). Same translation as the session root
    // and for the same reason: the plugin writing these files is a Linux
    // process under WSL, and the driver reading them is not. A directory the
    // two do not agree on is an approval nobody ever sees — which the plugin
    // resolves as a denial, so the failure is loud rather than permissive.
    if (approvalDir) {
        env.DSH_MAUSCREW_APPROVAL_DIR = p(approvalDir);
        env.DSH_MAUSCREW_APPROVAL_TIMEOUT_MS = String(config.approval.timeoutMs);
    }
    // Session Log sharing (spec §57). Off is the default and is enforced with
    // upstream's authoritative pre-load switch, not just by leaving the mode
    // unset — any non-empty DSH_TELEMETRY_DISABLED overrides every configured
    // mode, so an opted-out user stays opted out even if a composition file
    // sets one. Opting in removes that switch and names the mode explicitly.
    if (config.telemetry === "off")
        env.DSH_TELEMETRY_DISABLED = "1";
    else
        env.DSH_TELEMETRY_MODE = config.telemetry === "full" ? "FULL" : "FEEDBACK_ONLY";
    // Explicit per-instance overrides come last and are trusted: the user set
    // them for this bot on purpose. Three keys are excluded. The API key
    // travels in the dedicated slot above so it cannot be shadowed by a stale
    // entry; the two telemetry switches are the user's answer to a privacy
    // question asked in Settings, and an environment entry quietly reversing
    // it would make that answer a suggestion (spec §57).
    for (const [key, value] of Object.entries(instanceEnv)) {
        if (key === config.apiKeyEnv)
            continue;
        if (key === "DSH_TELEMETRY_DISABLED" || key === "DSH_TELEMETRY_MODE")
            continue;
        // Redirecting the approval channel is redirecting who gets to say yes.
        // The driver owns both of these (spec §95).
        if (key === "DSH_MAUSCREW_APPROVAL_DIR" || key === "DSH_MAUSCREW_APPROVAL_TIMEOUT_MS")
            continue;
        // A per-instance free-form env entry must not widen the explicit sandbox
        // choice made in Settings/config.json.
        if (key === "DSH_SANDBOX_MODE")
            continue;
        if (typeof value === "string" && !/[\0\r\n]/.test(value))
            env[key] = value;
    }
    return env;
}
/** WSL does not inherit arbitrary Windows environment variables unless their
 * names are listed in WSLENV. Pass only the already-allowlisted bridge
 * environment and leave host bootstrap variables (especially Windows PATH
 * and HOME) to WSL's own Linux environment. Values — including credentials —
 * remain in the child environment and never appear in argv/process listings. */
export function withWslForwarding(env) {
    const hostOnly = new Set([
        "PATH",
        "SystemRoot",
        "SYSTEMROOT",
        "TEMP",
        "TMP",
        "COMSPEC",
        "HOME",
        "USERPROFILE",
    ]);
    const names = Object.keys(env).filter((key) => !hostOnly.has(key) && key !== "WSLENV" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(key));
    return { ...env, WSLENV: names.join(":") };
}
export function spawnBridge(input) {
    const { config } = input;
    const script = input.scriptPath ?? BRIDGE_SCRIPT;
    if (!existsSync(script)) {
        throw new DeepSeekBridgeError("bridge_crashed", `bridge script missing at ${script}`);
    }
    // One process, so one candidate: the interpreter a probe already reached if
    // there is one, otherwise the first that exists (off WSL) or simply the
    // first (under WSL, where nothing here can be stat'ed).
    const candidate = preferredCandidate(runnableCandidates(config));
    if (!candidate || candidate.length === 0) {
        throw new DeepSeekBridgeError("python_missing", "no Python interpreter configured");
    }
    checkCordisConfig(config);
    const wsl = config.runtime.mode === "wsl";
    const [command, ...prefixArgs] = candidate;
    const scriptArg = wsl ? toWslPath(script) : script;
    const cwd = wsl ? toWslPath(input.cwd) : input.cwd;
    const env = buildBridgeEnv({ ...input, sessionRoot: input.sessionRoot });
    const childEnv = { ...env, DSH_CWD: cwd };
    const child = spawnCli(command, [...prefixArgs, scriptArg], {
        // WSL cannot chdir to a Windows path; the bridge receives its workspace
        // through DSH_CWD/turn cwd instead, so the host process just starts
        // somewhere valid.
        ...(wsl ? {} : { cwd: input.cwd }),
        env: wsl ? withWslForwarding(childEnv) : childEnv,
        stdio: ["pipe", "pipe", "pipe"],
    });
    return { child, describe: [command, ...prefixArgs, scriptArg].join(" ") };
}
/** Spawn the SDK runtime directly, for the native transport (spec §88).
 *
 * The same environment, the same composition check, the same no-shell rule.
 * The only differences from spawnBridge are that there is no interpreter to
 * find and no script to hand it: `runtime.launchArgs` IS the program, given
 * as an argv array by the user, and it is spawned exactly as written. That is
 * why decodeConfig rejects control characters in it — this list becomes a
 * process. */
export function spawnRuntime(input) {
    const { config } = input;
    const launchArgs = config.transport.launchArgs;
    if (launchArgs.length === 0) {
        throw new DeepSeekBridgeError("sdk_missing", "the native transport needs runtime.launchArgs — the argv that starts the DeepSeek Harness JSON-RPC runtime");
    }
    checkCordisConfig(config);
    const wsl = config.runtime.mode === "wsl";
    const prefix = wsl
        ? config.runtime.distribution
            ? ["wsl.exe", "-d", config.runtime.distribution, "--"]
            : ["wsl.exe", "--"]
        : [];
    const argv = [...prefix, ...launchArgs];
    const [command, ...args] = argv;
    const cwd = wsl ? toWslPath(input.cwd) : input.cwd;
    const env = buildBridgeEnv(input);
    const childEnv = { ...env, DSH_CWD: cwd };
    const child = spawnCli(command, args, {
        // WSL cannot chdir to a Windows path; the runtime receives its workspace
        // through DSH_CWD instead.
        ...(wsl ? {} : { cwd: input.cwd }),
        env: wsl ? withWslForwarding(childEnv) : childEnv,
        stdio: ["pipe", "pipe", "pipe"],
    });
    return { child, describe: argv.join(" ") };
}
/** A Cordis composition decides which tools the agent gets, so pointing at
 * a file that is not there must fail loudly (spec §61). The runtime would
 * otherwise fall back to its bundled default and run a composition the user
 * did not choose — with the tools they thought they had removed.
 *
 * Under WSL the host cannot see the distribution's filesystem, so the check
 * is skipped there rather than guessed at; absolute-path validation at
 * decode time is what the config gets in that case. */
export function checkCordisConfig(config) {
    const path = config.cordis.configPath;
    if (!path || config.runtime.mode === "wsl")
        return;
    if (!existsSync(path)) {
        throw new DeepSeekBridgeError("sdk_missing", `the Cordis composition configured for this bot is missing at ${path}`);
    }
}
export function stopBridge(child) {
    killCliTree(child);
}
/** Probe an interpreter for the SDK without starting a turn — the check
 * snapshot() needs (spec §26). Resolves to the SDK version, or null with a
 * reason. */
export function probeSdk(config, timeoutMs = 5000) {
    const candidates = runnableCandidates(config);
    if (!candidates.length) {
        return Promise.resolve({ version: null, reason: "no Python interpreter configured" });
    }
    // A single -c argument, passed as argv. Nothing user-controlled goes in it.
    const probe = "import json;\n" +
        "try:\n" +
        "    from importlib.metadata import version\n" +
        "    import deepseek_harness\n" +
        "    print(json.dumps({'ok': True, 'version': version('deepseek-harness-sdk')}))\n" +
        "except Exception as e:\n" +
        "    print(json.dumps({'ok': False, 'error': type(e).__name__ + ': ' + str(e)}))\n";
    // Same order-and-stop-at-the-first-answer walk as resolveBundledRuntime.
    const attempt = (index, firstReason) => {
        const candidate = candidates[index];
        if (!candidate?.length)
            return Promise.resolve({ version: null, reason: firstReason ?? "import failed" });
        const [command, ...prefixArgs] = candidate;
        return new Promise((resolve) => {
            execCli(command, [...prefixArgs, "-c", probe], { timeout: timeoutMs, env: { PATH: augmentedPath(), ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}) } }, (err, stdout) => {
                const next = (reason) => resolve(attempt(index + 1, firstReason ?? reason));
                if (err)
                    return next(err.message);
                try {
                    const parsed = JSON.parse(stdout.trim().split("\n").pop() ?? "{}");
                    if (parsed.ok) {
                        rememberCandidate(candidates, candidate);
                        return resolve({ version: typeof parsed.version === "string" ? parsed.version : null });
                    }
                    return next(String(parsed.error ?? "import failed"));
                }
                catch {
                    return next("could not read the interpreter's response");
                }
            });
        });
    };
    return attempt(0);
}
