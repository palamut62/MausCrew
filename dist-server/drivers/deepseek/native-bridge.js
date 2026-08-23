// The Python-free transport: one long-lived DeepSeek Harness SDK runtime
// process per provider instance, driven over JSON-RPC directly (spec §88).
//
// This class is deliberately shaped like DeepSeekBridge — same methods, same
// BridgeMessage stream, same crash policy — because the driver must not care
// which one it holds. That is not a stylistic choice: it is what makes the
// parity suite possible. If the two transports had different surfaces, "they
// behave the same" would be an assertion instead of something a test can run
// against both.
//
// What actually changed, and what did not:
//
//   * Python is gone. It was never in the data path — the Python SDK spawns
//     the same Node runtime this does and relays its notifications. Removing
//     it removes a language, an interpreter probe, and a packaging problem,
//     not a capability.
//   * The runtime process is NOT gone, and cannot be. WSL2 stays the only
//     Windows path, because upstream ships no Windows executable carrier.
//   * There is still no wire-level cancel. Upstream's whole request surface
//     is initialize / session/prompt / shutdown, so a hard cancel is still a
//     process kill, and it is still safe for the same reason: the session log
//     on disk is the model's context (spec §48).
//
// The one behaviour that had to be re-derived rather than copied is turn
// completion. bridge.py got it from the Python SDK's blocking `run()`; here
// the state machine in runtime-turn.ts owns it.
import { existsSync } from "node:fs";
import { isAbsolute } from "node:path";
import { runtimePath, spawnRuntime, stopBridge } from "./process-manager.js";
import { JsonRpcConnection } from "./jsonrpc.js";
import { RuntimeTurn } from "./runtime-turn.js";
import { DeepSeekBridgeError } from "./errors.js";
/** Upstream documents this string as wire-stable, and it is the only
 * identity the protocol carries — there is no version field to negotiate.
 * A runtime that answers `initialize` with a different name is some other
 * program listening on the same pipe, so we refuse it rather than drive it. */
export const RUNTIME_SERVER_NAME = "deepseek-harness-sdk-runtime";
/** The handshake budget.
 *
 * 20s was a stopwatch reading from a warm Linux host, and it is the wrong
 * number everywhere else: a first launch under WSL2 pays for the distribution
 * waking up, a cold single-file runtime pays for its own extraction, and a
 * Windows machine mid-scan pays for the antivirus reading every byte of it.
 * All three answer eventually, and all three used to present as "the runtime
 * did not respond in time" — which reads as a broken install and is not one.
 * The ceiling still exists, because a runtime that accepts stdin and never
 * answers must not hang the first turn forever; it is simply no longer tighter
 * than a legitimate cold start. Overridable for an unusually slow machine. */
export const INITIALIZE_TIMEOUT_MS = envTimeoutMs("MAUSCREW_DEEPSEEK_INIT_TIMEOUT_MS", 90_000);
function envTimeoutMs(name, fallback) {
    const raw = Number(process.env[name]);
    return Number.isFinite(raw) && raw >= 1_000 ? Math.floor(raw) : fallback;
}
const PROMPT_TIMEOUT_MS = 30_000;
const MAX_RESTARTS = 3;
const RESTART_BACKOFF_MS = [1_000, 4_000, 16_000];
/** What this transport can honestly promise.
 *
 * `cancel: false` is not an oversight. Soft cancel stops relaying and hard
 * cancel kills the process; neither is a cancel the runtime participates in,
 * and claiming otherwise would be exactly the kind of untrue capability §54
 * forbids. `approvals: true` because the broker is a Cordis plugin inside the
 * composition, which this transport loads the same way the Python one does. */
const NATIVE_CAPABILITIES = {
    streaming: true,
    sessions: true,
    cancel: false,
    approvals: true,
};
export class NativeDeepSeekBridge {
    child = null;
    connection = null;
    starting = null;
    stderrTail = "";
    stopping = false;
    restarts = 0;
    restartNotBefore = 0;
    sdkVersion = null;
    capabilities = null;
    /** Turns in flight, keyed by our own requestId. */
    turns = new Map();
    /** Reverse index so a notification carrying only a sessionId finds its
     * turn without walking every entry. */
    turnBySession = new Map();
    spawnInput;
    hooks;
    constructor(spawnInput, hooks) {
        this.spawnInput = spawnInput;
        this.hooks = hooks;
    }
    status() {
        return {
            running: this.child !== null,
            sdkVersion: this.sdkVersion,
            capabilities: this.capabilities,
            restarts: this.restarts,
        };
    }
    async ensureStarted() {
        if (this.child)
            return;
        if (this.starting)
            return this.starting;
        if (this.restarts > MAX_RESTARTS) {
            throw new DeepSeekBridgeError("bridge_crashed", `the DeepSeek runtime failed to stay running after ${MAX_RESTARTS} restarts`);
        }
        this.starting = this.waitForBackoff()
            .then(() => this.start())
            .finally(() => {
            this.starting = null;
        });
        return this.starting;
    }
    waitForBackoff() {
        const wait = this.restartNotBefore - Date.now();
        if (wait <= 0)
            return Promise.resolve();
        return new Promise((resolve) => {
            const timer = setTimeout(resolve, wait);
            timer.unref?.();
        });
    }
    async start() {
        const input = this.spawnInput();
        this.stopping = false;
        this.stderrTail = "";
        const { child } = spawnRuntime(input);
        this.child = child;
        child.stderr.setEncoding("utf8");
        child.stderr.on("data", (chunk) => {
            this.stderrTail = (this.stderrTail + chunk).slice(-8192);
        });
        // The runtime dying mid-write EPIPEs stdin. The exit edge below is the
        // real signal; this only keeps the error from becoming an unhandled one.
        child.stdin.on("error", () => { });
        const connection = new JsonRpcConnection(child.stdout, child.stdin);
        connection.onNotification((notification) => this.route(notification));
        connection.start();
        this.connection = connection;
        child.on("error", (error) => {
            this.stderrTail = `${this.stderrTail}\n${error instanceof Error ? error.message : String(error)}`.slice(-8192);
            this.handleExit(null);
        });
        child.on("close", (code) => this.handleExit(code));
        // The handshake. A runtime that accepts stdin and never answers would
        // otherwise hang the first turn forever, so this is bounded.
        let result;
        try {
            result = await this.withTimeout(connection.request("initialize", {
                // initialize creates the durable session and freezes its cwd. A
                // Windows host path is not meaningful inside WSL; translating only
                // DSH_CWD would leave the actual session rooted at process.cwd().
                cwd: runtimePath(input.config, input.cwd),
                provider: input.config.provider,
                model: input.config.defaultModel,
                ...(input.config.maxTokens === null ? {} : { maxTokens: input.config.maxTokens }),
            }), INITIALIZE_TIMEOUT_MS, "initialize");
        }
        catch (error) {
            this.teardown();
            throw this.startupError(error);
        }
        const name = serverName(result);
        if (name !== RUNTIME_SERVER_NAME) {
            this.teardown();
            throw new DeepSeekBridgeError("protocol_mismatch", name
                ? `the process on this pipe identifies as "${name}", not the DeepSeek Harness runtime`
                : "the process on this pipe did not identify itself as the DeepSeek Harness runtime");
        }
        this.sdkVersion = serverVersion(result);
        this.capabilities = NATIVE_CAPABILITIES;
        // a clean start clears the restart budget for the next crash
        this.restarts = 0;
        this.restartNotBefore = 0;
    }
    startupError(error) {
        // A handshake timeout is the one failure that arrives with no reason at
        // all, because nothing crashed — the process is sitting right there.
        // Whatever it printed before going quiet is the only evidence, and it is
        // usually the whole answer: a distribution that is not running, a refused
        // mount, a runtime waiting on input. Carry it, and say what to check when
        // there is nothing to carry.
        if (error instanceof DeepSeekBridgeError && error.kind === "timeout") {
            const tail = this.stderrTail.trim().slice(-300);
            return new DeepSeekBridgeError("timeout", tail
                ? `${error.message}. It printed: ${tail}`
                : `${error.message} and printed nothing. Check the runtime in App Settings → DeepSeek Harness — on Windows it starts inside WSL, so a distribution that is not running answers nothing. Raise MAUSCREW_DEEPSEEK_INIT_TIMEOUT_MS if this machine is simply slow to start it.`, { cause: error });
        }
        if (error instanceof DeepSeekBridgeError)
            return error;
        const tail = this.stderrTail.trim().slice(-300);
        const message = error instanceof Error ? error.message : String(error);
        // A runtime that is not installed fails here, at initialize, with its
        // reason on stderr. Surfacing that tail is the difference between a
        // setup mistake the user can fix and "the bridge crashed".
        return new DeepSeekBridgeError("sdk_missing", tail ? `${message}: ${tail}` : message);
    }
    withTimeout(promise, ms, what) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new DeepSeekBridgeError("timeout", `the DeepSeek runtime did not answer ${what} within ${ms}ms`));
            }, ms);
            timer.unref?.();
            promise.then((value) => {
                clearTimeout(timer);
                resolve(value);
            }, (error) => {
                clearTimeout(timer);
                reject(error);
            });
        });
    }
    // ── notification routing ────────────────────────────────────────────────
    /** Deliver one runtime notification to the turn it belongs to.
     *
     * The runtime notifies for EVERY session in its context, not just ours, so
     * this is where a sibling bot's events would leak into this turn if the
     * scoping were sloppy. Subagent lineage is tracked inside each RuntimeTurn;
     * here we only need to find the right one. */
    route(notification) {
        const turn = this.turnFor(notification);
        if (!turn)
            return;
        const { messages, outcome } = turn.accept(notification);
        for (const message of messages)
            this.deliver(message);
        if (outcome) {
            this.forget(turn);
            this.deliver({
                type: "turn.completed",
                requestId: turn.requestId,
                finishReason: outcome.finishReason,
                finalResponse: outcome.finalResponse,
                sessionId: outcome.sessionId,
            });
        }
    }
    turnFor(notification) {
        const params = notification.params;
        // subagent.* is addressed by the parent, which for a nested delegation is
        // itself a child session. Ask every live turn; each one knows its own
        // descendants and the ones that do not own this lineage return nothing.
        if (notification.method === "subagent.started" || notification.method === "subagent.finished") {
            const parent = params.parentSessionId;
            if (typeof parent !== "string")
                return null;
            const direct = this.turnBySession.get(parent);
            if (direct)
                return this.turns.get(direct) ?? null;
            for (const turn of this.turns.values()) {
                const probe = turn.accept(notification);
                if (probe.messages.length > 0) {
                    for (const message of probe.messages)
                        this.deliver(message);
                    // already handled by the probe; route() must not process it twice
                    return null;
                }
            }
            return null;
        }
        const sessionId = params.sessionId;
        if (typeof sessionId !== "string")
            return null;
        const requestId = this.turnBySession.get(sessionId);
        return requestId ? this.turns.get(requestId) ?? null : null;
    }
    deliver(message) {
        this.hooks.onMessage(message, message);
    }
    forget(turn) {
        this.turns.delete(turn.requestId);
        if (this.turnBySession.get(turn.sessionId) === turn.requestId) {
            this.turnBySession.delete(turn.sessionId);
        }
    }
    // ── commands ────────────────────────────────────────────────────────────
    send(command) {
        switch (command.type) {
            case "turn.start":
                this.startTurn(command);
                return;
            case "turn.cancel":
                this.cancelTurn(command.requestId);
                return;
            case "approval.respond":
                // Same as the Python bridge, and for the same reason: approvals do
                // not travel this pipe. The gate is a Cordis plugin inside the
                // runtime and it answers through the file mailbox under
                // DSH_SESSION_ROOT (see approval-mailbox.ts). Saying so is better
                // than swallowing a decision that would never arrive (spec §37).
                this.deliver({
                    type: "error",
                    requestId: command.requestId,
                    code: "unsupported",
                    message: "approvals are brokered through the session mailbox, not the runtime connection",
                });
                return;
            case "shutdown":
                void this.stop();
                return;
        }
    }
    startTurn(command) {
        const connection = this.connection;
        if (!connection || !this.child) {
            throw new DeepSeekBridgeError("bridge_crashed", "the DeepSeek runtime is not running");
        }
        if (this.turns.has(command.requestId)) {
            this.deliver({
                type: "error",
                requestId: command.requestId,
                code: "bad_request",
                message: "that requestId is already running",
            });
            return;
        }
        const turn = new RuntimeTurn(command.requestId, command.sessionId);
        this.turns.set(command.requestId, turn);
        this.turnBySession.set(command.sessionId, command.requestId);
        // Deferred by a tick, not emitted inline. send() is called from inside
        // the driver's sendTurn, which is still registering the turn when it
        // returns; delivering synchronously would land these before that
        // bookkeeping and reorder the very first two events of every turn. The
        // Python transport gets this for free because a real pipe is async.
        setTimeout(() => {
            this.deliver({ type: "turn.started", requestId: command.requestId, sessionId: command.sessionId });
            this.deliver({
                type: "session.started",
                requestId: command.requestId,
                sessionId: command.sessionId,
                model: command.model ?? null,
            });
        }, 0);
        // The prompt request returns a receipt, not a result: the turn's work
        // arrives as notifications afterwards. The receipt still matters — it is
        // the message id the completion gate waits to see spliced into the inbox.
        this.withTimeout(connection.request("session/prompt", {
            sessionId: command.sessionId,
            contentBlocks: [{ type: "text", text: command.prompt }],
        }), PROMPT_TIMEOUT_MS, "session/prompt").then((result) => {
            const messageId = promptMessageId(result);
            if (!messageId) {
                this.failTurn(turn, "protocol_error", "the runtime accepted the prompt without returning a message id");
                return;
            }
            turn.setMessageId(messageId);
        }, (error) => {
            this.failTurn(turn, "runtime_error", error instanceof Error ? error.message : String(error));
        });
    }
    /** Settle a turn that will never settle itself, emitting both the error and
     * the completion — a turn left unsettled leaves the thread busy forever. */
    failTurn(turn, code, message) {
        if (turn.isFinished)
            return;
        const outcome = turn.abandon("error");
        this.forget(turn);
        this.deliver({ type: "error", requestId: turn.requestId, code, message });
        this.deliver({
            type: "turn.completed",
            requestId: turn.requestId,
            finishReason: outcome.finishReason,
            finalResponse: "",
            sessionId: outcome.sessionId,
        });
    }
    /** Soft cancel: stop relaying and settle. The runtime keeps working — it
     * has no cancel — so this is honest about what it is. The turn's output is
     * already in the session log, which is what the next turn reads. */
    cancelTurn(requestId) {
        const turn = this.turns.get(requestId);
        if (!turn)
            return;
        const outcome = turn.abandon("cancelled");
        this.forget(turn);
        this.deliver({
            type: "turn.completed",
            requestId,
            finishReason: outcome.finishReason,
            finalResponse: "",
            sessionId: outcome.sessionId,
        });
    }
    // ── lifecycle ───────────────────────────────────────────────────────────
    restartDelayMs() {
        if (this.restarts === 0 || this.restarts > MAX_RESTARTS)
            return null;
        return RESTART_BACKOFF_MS[Math.min(this.restarts - 1, RESTART_BACKOFF_MS.length - 1)];
    }
    /** Ask the runtime to shut down, then reap it. Graceful first so it can
     * flush its session log — that log is the model's context (spec §48). */
    async stop(graceMs = 2_000) {
        const child = this.child;
        const connection = this.connection;
        if (!child)
            return;
        this.stopping = true;
        if (connection) {
            // Best effort. A runtime that cannot answer shutdown anymore gets the
            // kill below; waiting on it forever would be the worse failure.
            try {
                await this.withTimeout(connection.request("shutdown", {}), 1_000, "shutdown").catch(() => undefined);
            }
            catch {
                // withTimeout rejects with our own error; the ladder continues
            }
        }
        try {
            child.stdin.end();
        }
        catch {
            // already gone
        }
        await new Promise((resolve) => {
            const timer = setTimeout(resolve, graceMs);
            timer.unref?.();
            child.once("close", () => {
                clearTimeout(timer);
                resolve();
            });
        });
        this.teardown();
    }
    /** Kill now. This is the only thing that actually stops a model call in
     * flight, for the reason documented at the top of this file. Not counted as
     * a crash — we asked for it, so the restart budget stays untouched. */
    async cancelHard() {
        if (!this.child)
            return;
        this.stopping = true;
        this.teardown();
        await new Promise((resolve) => {
            const timer = setTimeout(resolve, 0);
            timer.unref?.();
        });
    }
    handleExit(code) {
        if (!this.child)
            return;
        const expected = this.stopping;
        this.child = null;
        this.capabilities = null;
        this.connection?.close();
        this.connection = null;
        // Every turn the runtime was carrying died with it. Settling them here is
        // what keeps a crash from presenting as a permanently busy thread.
        for (const turn of [...this.turns.values()]) {
            this.failTurn(turn, "bridge_crashed", `the DeepSeek runtime exited (${code})`);
        }
        if (!expected) {
            this.restarts += 1;
            this.restartNotBefore = Date.now() + (this.restartDelayMs() ?? 0);
        }
        this.hooks.onExit({ expected, code, stderr: this.stderrTail });
    }
    teardown() {
        const child = this.child;
        this.child = null;
        this.capabilities = null;
        this.connection?.close();
        this.connection = null;
        if (child) {
            try {
                stopBridge(child);
            }
            catch {
                // best effort — the process may already be gone
            }
        }
    }
}
function serverName(result) {
    const info = serverInfo(result);
    return typeof info?.name === "string" ? info.name : "";
}
function serverVersion(result) {
    const info = serverInfo(result);
    return typeof info?.version === "string" ? info.version : null;
}
function serverInfo(result) {
    if (typeof result !== "object" || result === null)
        return null;
    const info = result.serverInfo;
    return typeof info === "object" && info !== null ? info : null;
}
function promptMessageId(result) {
    if (typeof result !== "object" || result === null)
        return "";
    const id = result.messageId;
    return typeof id === "string" ? id : "";
}
/** Whether a native launch is even possible for this config, without
 * spawning anything. Used by the driver's snapshot so an unconfigured native
 * instance reports why rather than failing on the first turn (spec §26). */
export function checkNativeLaunch(launchArgs, wsl) {
    if (launchArgs.length === 0) {
        return {
            ok: false,
            reason: "the native transport needs runtime.launchArgs — the argv that starts the DeepSeek Harness JSON-RPC runtime",
        };
    }
    // Under WSL the host cannot stat the distribution's filesystem, so the
    // existence check is skipped rather than guessed at — same rule the Cordis
    // composition check follows.
    // A bare name like "python3" is resolved through PATH and cannot be stat'ed
    // here, so only a path-shaped command is checked. isAbsolute covers
    // "C:\...\python.exe", which contains no forward slash at all — testing for
    // "/" alone silently skipped this check for every bundled Windows path and
    // turned "the runtime is not installed" into a 20s initialize timeout.
    const [command] = launchArgs;
    const pathShaped = isAbsolute(command) || command.includes("/") || command.includes("\\");
    if (!wsl && pathShaped && !existsSync(command)) {
        return { ok: false, reason: `the configured DeepSeek runtime is not at ${command}` };
    }
    return { ok: true };
}
