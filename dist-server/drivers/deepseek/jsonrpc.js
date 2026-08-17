// Newline-delimited JSON-RPC 2.0 over a child process's stdio (spec §88).
//
// This is the wire the DeepSeek Harness SDK runtime actually speaks. It was
// read out of the upstream reference rather than guessed at
// (`packages/sdk/protocol/src/transport.ts`), and the framing rules below are
// that file's rules, not a reinterpretation of them:
//
//   * one JSON object per line
//   * `id` + `method` = request · `id` alone = response · `method` alone = a
//     notification
//   * a line that does not parse is dropped, not fatal — the peer writing one
//     stray line must not take the connection down
//   * `params` that is not a plain object normalizes to `{}`
//
// There is no version in this protocol. The only identity on the wire is
// `initialize`'s `serverInfo.name`, which upstream documents as wire-stable
// (`deepseek-harness-sdk-runtime`), so that string is the handshake check the
// native path gets — see native-bridge.ts.
//
// We only ever act as the client half: we send requests and receive
// notifications. Incoming requests are answered with -32601 rather than
// ignored, because a runtime that asks us something and waits forever is a
// hang, and a hang is worse than a refusal.
import { randomUUID } from "node:crypto";
import { LineSplitter } from "./bridge-protocol.js";
/** An error *response* from the peer, carrying the wire code verbatim. This
 * is distinct from a transport failure: the peer answered, and said no. */
export class JsonRpcResponseError extends Error {
    code;
    data;
    // Fields assigned in the body rather than as constructor parameter
    // properties: the server runs under Node's strip-only TypeScript loader,
    // which rejects that syntax outright.
    constructor(code, message, data) {
        super(message);
        this.name = "JsonRpcResponseError";
        this.code = code;
        this.data = data;
    }
}
/** The client half of a line-delimited JSON-RPC connection.
 *
 * Owns neither stream: `close()` detaches listeners and fails everything
 * still waiting, but never destroys the pipes. Whoever spawned the process
 * is the one allowed to end it. */
export class JsonRpcConnection {
    input;
    output;
    splitter = new LineSplitter();
    pending = new Map();
    notificationHandler = null;
    started = false;
    closed = false;
    constructor(input, output) {
        this.input = input;
        this.output = output;
    }
    onNotification(handler) {
        this.notificationHandler = handler;
    }
    start() {
        if (this.started)
            return;
        this.started = true;
        this.input.setEncoding("utf8");
        this.input.on("data", this.onData);
        this.input.on("end", this.onEnd);
        this.input.on("error", this.onError);
    }
    /** Detach and fail every in-flight request. Idempotent, and safe before
     * `start()` — a spawn that never produced a process still has to release
     * whoever is awaiting its first request. */
    close(reason = "the DeepSeek runtime connection closed") {
        if (this.closed)
            return;
        this.closed = true;
        this.input.off("data", this.onData);
        this.input.off("end", this.onEnd);
        this.input.off("error", this.onError);
        this.failPending(new Error(reason));
    }
    /** Send a request and await its result.
     *
     * `signal` makes a timeout an *abandonment*: the pending entry is dropped
     * so a hung method leaves no per-call state behind. The work still runs on
     * the runtime side — this protocol has no cancel, which is exactly why the
     * driver's hard cancel is a process kill (spec §88, K7.3). */
    request(method, params = {}, signal) {
        if (this.closed) {
            return Promise.reject(new Error("the DeepSeek runtime connection is closed"));
        }
        const id = `omb_${randomUUID().replaceAll("-", "")}`;
        return new Promise((resolve, reject) => {
            let detach = () => { };
            if (signal) {
                if (signal.aborted) {
                    reject(abortError(signal.reason));
                    return;
                }
                const onAbort = () => {
                    this.pending.delete(id);
                    reject(abortError(signal.reason));
                };
                signal.addEventListener("abort", onAbort, { once: true });
                detach = () => signal.removeEventListener("abort", onAbort);
            }
            this.pending.set(id, {
                resolve: (value) => {
                    detach();
                    resolve(value);
                },
                reject: (error) => {
                    detach();
                    reject(error);
                },
            });
            try {
                this.write({ jsonrpc: "2.0", id, method, params });
            }
            catch (error) {
                this.pending.delete(id);
                detach();
                reject(error instanceof Error ? error : new Error(String(error)));
            }
        });
    }
    notify(method, params) {
        this.write(params === undefined ? { jsonrpc: "2.0", method } : { jsonrpc: "2.0", method, params });
    }
    onData = (chunk) => {
        for (const line of this.splitter.push(chunk))
            this.handleLine(line);
    };
    onEnd = () => {
        this.failPending(new Error("the DeepSeek runtime closed its output"));
    };
    onError = (error) => {
        this.failPending(error);
    };
    handleLine(line) {
        let decoded;
        try {
            decoded = JSON.parse(line);
        }
        catch {
            // A stray non-JSON line on stdout is somebody's debug print. Upstream
            // ignores it and so do we; taking the turn down over it would make an
            // unrelated log statement look like a runtime crash.
            return;
        }
        if (typeof decoded !== "object" || decoded === null)
            return;
        const frame = decoded;
        const id = frame.id;
        const method = frame.method;
        const hasId = typeof id === "string" || typeof id === "number";
        if (hasId && typeof method === "string") {
            // We are a client. Answering "method not found" is the honest reply and
            // it releases a peer that would otherwise wait on us forever.
            this.write({ jsonrpc: "2.0", id, error: { code: -32601, message: `method not found: ${method}` } });
            return;
        }
        if (hasId) {
            this.handleResponse(String(id), frame);
            return;
        }
        if (typeof method === "string") {
            this.notificationHandler?.({ method, params: objectParams(frame.params) });
        }
    }
    handleResponse(id, frame) {
        const pending = this.pending.get(id);
        if (!pending)
            return;
        this.pending.delete(id);
        const error = frame.error;
        if (error && typeof error === "object") {
            const e = error;
            pending.reject(new JsonRpcResponseError(typeof e.code === "number" ? e.code : undefined, typeof e.message === "string" ? e.message : "the DeepSeek runtime returned an error", e.data));
            return;
        }
        pending.resolve(frame.result);
    }
    write(message) {
        this.output.write(`${JSON.stringify(message)}\n`);
    }
    failPending(error) {
        const waiting = [...this.pending.values()];
        this.pending.clear();
        for (const p of waiting)
            p.reject(error);
    }
}
/** Normalize wire `params` to a plain object; arrays and scalars collapse to
 * `{}` exactly as upstream's transport does. */
function objectParams(params) {
    return params && typeof params === "object" && !Array.isArray(params)
        ? params
        : {};
}
function abortError(reason) {
    return reason instanceof Error ? reason : new Error(`the request was abandoned: ${String(reason)}`);
}
