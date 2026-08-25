// Fan-in event bus — port of upstream's ProviderService fan-in +
// EventNdjsonLogger tee, minus Effect. Every adapter's event stream merges
// into one bus; each event is stamped with its providerInstanceId, teed to
// a per-thread canonical NDJSON log (the debugging trick both upstream and
// agentcal lean on), and delivered to subscribers (the SSE endpoint and
// the server-side message folder).
import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { EVENTS_DIR } from "../config.js";
// The NDJSON tee used to be one appendFileSync per event, and `content.delta`
// is an event: a thousand-token reply meant a thousand synchronous
// open/write/close cycles on the single thread that also serves every client.
// Lines are now batched per thread and written with one append. The write
// stays synchronous on purpose — a WriteStream would move the cost off the
// hot path but buffer in memory, and process.exit() drops that buffer, which
// is how a crash log loses exactly the events worth reading.
const FLUSH_INTERVAL_MS = 50;
/** Characters, not bytes: a "do not sit on an unbounded buffer" guard rather
 * than an allocation budget. */
const FLUSH_CHARS = 64 * 1024;
export class EventBus {
    listeners = new Set();
    unsubscribes = [];
    /** threadId → NDJSON lines waiting for the next flush, in publish order */
    pending = new Map();
    pendingChars = 0;
    flushTimer = null;
    attach(instances) {
        for (const instance of instances) {
            const unsub = instance.adapter.onEvent((event) => {
                // hard invariant borrowed from correlateRuntimeEventWithInstance:
                // an adapter may only emit events for its own driver kind
                if (event.provider !== instance.driverKind) {
                    console.error(`bus: dropped cross-driver event from ${instance.instanceId}`);
                    return;
                }
                this.publish({ ...event, providerInstanceId: instance.instanceId });
            });
            this.unsubscribes.push(unsub);
        }
    }
    publish(event) {
        this.enqueue(event);
        for (const listener of [...this.listeners]) {
            try {
                listener(event);
            }
            catch (e) {
                console.error("bus: listener threw", e);
            }
        }
    }
    /** Buffer one line for its thread and make sure a flush is coming. */
    enqueue(event) {
        let line;
        try {
            line = JSON.stringify(event) + "\n";
        }
        catch {
            return; // an unserializable event must not take down the stream either
        }
        const lines = this.pending.get(event.threadId);
        if (lines)
            lines.push(line);
        else
            this.pending.set(event.threadId, [line]);
        this.pendingChars += line.length;
        if (this.pendingChars >= FLUSH_CHARS)
            return this.flush();
        if (this.flushTimer)
            return;
        this.flushTimer = setTimeout(() => this.flush(), FLUSH_INTERVAL_MS);
        // the log must never be the reason the process stays alive
        this.flushTimer.unref?.();
    }
    /** Write every buffered line out, now. Synchronous on purpose: callers use
     * it as the last thing before exiting, and readers expect the file to be
     * complete once it returns. Safe to call with nothing pending. */
    flush() {
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }
        if (this.pending.size === 0)
            return;
        const batches = [...this.pending];
        this.pending.clear();
        this.pendingChars = 0;
        for (const [threadId, lines] of batches) {
            try {
                appendFileSync(join(EVENTS_DIR, `${threadId}.ndjson`), lines.join(""));
            }
            catch {
                /* logging must never take down the stream */
            }
        }
    }
    /** Drop whatever is buffered for a thread whose log is being deleted, so a
     * pending flush cannot write the file back out after the unlink. */
    discard(threadId) {
        const lines = this.pending.get(threadId);
        if (!lines)
            return;
        this.pendingChars -= lines.reduce((total, line) => total + line.length, 0);
        this.pending.delete(threadId);
    }
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    detachAll() {
        for (const unsub of this.unsubscribes.splice(0))
            unsub();
    }
}
