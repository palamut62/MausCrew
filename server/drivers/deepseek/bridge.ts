// The Node half of the bridge: one long-lived Python process per provider
// instance, started lazily on the first turn and reused after it (spec §13).
//
// Responsibilities stop at the transport. It starts the process, completes
// the versioned handshake, frames lines, hands parsed messages to a
// listener, and reports death. Turn semantics — correlation, settlement,
// event emission — belong to the driver.
//
// Crash policy is deliberate rather than eager (spec §46): a dead bridge is
// reported once, restarted at most a few times with growing backoff, and
// then left down. A bridge that fails because the SDK is missing will fail
// identically forever, and an unbounded restart loop turns that into a
// spinning process instead of a message the user can act on.
import type { BridgeChild, SpawnBridgeInput } from "./process-manager.ts";
import { spawnBridge, stopBridge } from "./process-manager.ts";
import type { BridgeCapabilities, BridgeCommand, BridgeMessage } from "./bridge-protocol.ts";
import { LineSplitter, checkHandshake, parseMessage, serializeCommand } from "./bridge-protocol.ts";
import { DeepSeekBridgeError } from "./errors.ts";

export const HANDSHAKE_TIMEOUT_MS = 10_000;
const MAX_RESTARTS = 3;
const RESTART_BACKOFF_MS = [1_000, 4_000, 16_000];

export interface BridgeHooks {
  onMessage: (message: BridgeMessage, raw: unknown) => void;
  /** The process died. `expected` is true for a shutdown we asked for. */
  onExit: (info: { expected: boolean; code: number | null; stderr: string }) => void;
}

export interface BridgeStatus {
  running: boolean;
  sdkVersion: string | null;
  capabilities: BridgeCapabilities | null;
  restarts: number;
}

export class DeepSeekBridge {
  private child: BridgeChild | null = null;
  private starting: Promise<void> | null = null;
  private splitter = new LineSplitter();
  private stderrTail = "";
  private stopping = false;
  private restarts = 0;
  private sdkVersion: string | null = null;
  private capabilities: BridgeCapabilities | null = null;
  /** Epoch ms before which a restart is refused. Without this the backoff
   * was only advisory — ensureStarted() would respawn immediately on the
   * next turn and the "growing delay" existed on paper only (spec §46). */
  private restartNotBefore = 0;

  // Fields assigned explicitly rather than as constructor parameter
  // properties: the server runs under Node's strip-only TypeScript loader,
  // which rejects that syntax outright.
  private readonly spawnInput: () => SpawnBridgeInput;
  private readonly hooks: BridgeHooks;

  constructor(spawnInput: () => SpawnBridgeInput, hooks: BridgeHooks) {
    this.spawnInput = spawnInput;
    this.hooks = hooks;
  }

  status(): BridgeStatus {
    return {
      running: this.child !== null,
      sdkVersion: this.sdkVersion,
      capabilities: this.capabilities,
      restarts: this.restarts,
    };
  }

  /** Start if needed. Concurrent callers share one attempt — two turns
   * arriving together must not race two processes into existence. */
  async ensureStarted(): Promise<void> {
    if (this.child) return;
    if (this.starting) return this.starting;
    if (this.restarts > MAX_RESTARTS) {
      throw new DeepSeekBridgeError(
        "bridge_crashed",
        `the bridge failed to stay running after ${MAX_RESTARTS} restarts`,
      );
    }
    this.starting = this.waitForBackoff()
      .then(() => this.start())
      .finally(() => {
        this.starting = null;
      });
    return this.starting;
  }

  private waitForBackoff(): Promise<void> {
    const wait = this.restartNotBefore - Date.now();
    if (wait <= 0) return Promise.resolve();
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, wait);
      timer.unref?.();
    });
  }

  private async start(): Promise<void> {
    this.stopping = false;
    this.splitter.reset();
    this.stderrTail = "";

    const { child } = spawnBridge(this.spawnInput());
    this.child = child;

    const ready = new Promise<void>((resolve, reject) => {
      // A bridge that accepts stdin and never greets us would otherwise hang
      // the first turn forever, leaving the bot busy with no way out.
      const timer = setTimeout(() => {
        settle(
          new DeepSeekBridgeError(
            "timeout",
            `the bridge did not complete its handshake within ${HANDSHAKE_TIMEOUT_MS}ms`,
          ),
        );
      }, HANDSHAKE_TIMEOUT_MS);
      timer.unref?.();

      let settled = false;
      const settle = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (error) {
          this.teardown();
          reject(error);
        } else {
          resolve();
        }
      };
      this.onReady = settle;
    });

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => this.consume(chunk));

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      this.stderrTail = (this.stderrTail + chunk).slice(-8192);
    });

    child.on("error", (error) => {
      this.onReady?.(error instanceof Error ? error : new Error(String(error)));
      this.handleExit(null);
    });
    child.on("close", (code) => {
      this.onReady?.(
        new DeepSeekBridgeError(
          "bridge_crashed",
          `the bridge exited (${code}) before its handshake${this.stderrTail ? `: ${this.stderrTail.trim().slice(-300)}` : ""}`,
        ),
      );
      this.handleExit(code);
    });

    await ready;
  }

  private onReady: ((error?: Error) => void) | null = null;

  private consume(chunk: string): void {
    for (const line of this.splitter.push(chunk)) {
      let decoded: unknown;
      try {
        decoded = JSON.parse(line);
      } catch {
        // A non-JSON line means something wrote to stdout that should have
        // gone to stderr. Skipping it keeps the stream usable rather than
        // tearing down a turn over a stray print.
        continue;
      }
      const message = parseMessage(decoded);
      if (!message) continue;

      if (message.type === "bridge.ready") {
        const check = checkHandshake(message);
        if (!check.ok) {
          this.onReady?.(new DeepSeekBridgeError("protocol_mismatch", check.reason ?? "unsupported bridge protocol"));
          this.onReady = null;
          continue;
        }
        this.sdkVersion = message.sdkVersion;
        this.capabilities = message.capabilities;
        // a clean start clears the restart budget for the next crash
        this.restarts = 0;
        this.restartNotBefore = 0;
        this.onReady?.();
        this.onReady = null;
        continue;
      }

      // An error before the handshake is the bridge telling us why it cannot
      // run — surface it as the start failure instead of a stray event.
      if (message.type === "error" && this.onReady) {
        this.onReady(new DeepSeekBridgeError("sdk_missing", message.message || message.code));
        this.onReady = null;
        continue;
      }

      this.hooks.onMessage(message, decoded);
    }
  }

  private handleExit(code: number | null): void {
    if (!this.child) return;
    const expected = this.stopping;
    this.child = null;
    this.capabilities = null;
    if (!expected) {
      this.restarts += 1;
      this.restartNotBefore = Date.now() + (this.restartDelayMs() ?? 0);
    }
    this.hooks.onExit({ expected, code, stderr: this.stderrTail });
  }

  /** Delay before the next restart is worth attempting. The driver decides
   * whether to retry; the bridge only says how long to wait. */
  restartDelayMs(): number | null {
    if (this.restarts === 0 || this.restarts > MAX_RESTARTS) return null;
    return RESTART_BACKOFF_MS[Math.min(this.restarts - 1, RESTART_BACKOFF_MS.length - 1)];
  }

  send(command: BridgeCommand): void {
    const child = this.child;
    if (!child) throw new DeepSeekBridgeError("bridge_crashed", "the bridge is not running");
    try {
      child.stdin.write(serializeCommand(command));
    } catch (error) {
      throw new DeepSeekBridgeError("bridge_crashed", "could not write to the bridge", { cause: error });
    }
  }

  /** Ask the bridge to exit, then reap it. Graceful first so the runtime can
   * flush its session log — that log is the model's context (spec §48). */
  async stop(graceMs = 2_000): Promise<void> {
    const child = this.child;
    if (!child) return;
    this.stopping = true;
    try {
      child.stdin.write(serializeCommand({ type: "shutdown" }));
      child.stdin.end();
    } catch {
      // already gone; the kill below is the fallback
    }
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, graceMs);
      timer.unref?.();
      child.once("close", () => {
        clearTimeout(timer);
        resolve();
      });
    });
    this.teardown();
  }

  /** Kill the process now, without the shutdown handshake.
   *
   * This is the only mechanism that actually stops a model call in flight.
   * The SDK runtime's JSON-RPC surface is exactly three methods —
   * `initialize`, `session/prompt`, `shutdown` (verified against
   * `packages/sdk/server/src/server.ts` `handleRequest`) — so there is no
   * per-session cancel to send. The runtime's own turn log does have an
   * `aborted` end reason, but nothing exposes it out of process.
   *
   * Killing is safe here in a way it would not be for most agents: the
   * DeepSeek session log on disk is the model's context (spec §48), it is
   * written as events happen, and the next turn reattaches by deterministic
   * session id. The turn is lost; the conversation is not.
   *
   * The kill is deliberately not counted as a crash — we asked for it, so
   * the restart budget and its backoff stay untouched. */
  async cancelHard(): Promise<void> {
    if (!this.child) return;
    this.stopping = true;
    this.teardown();
    // let the exit event drain before anyone calls ensureStarted() again
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 0);
      timer.unref?.();
    });
  }

  private teardown(): void {
    const child = this.child;
    this.child = null;
    this.capabilities = null;
    if (child) {
      try {
        stopBridge(child);
      } catch {
        // best effort — the process may already be gone
      }
    }
  }
}
