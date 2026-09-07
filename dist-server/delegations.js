import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { DATA_DIR } from "./config.js";
import { readManagedJson, writeManagedJson } from "./recovery.js";
import { getOrCreateChannel, mirrorExchange } from "./comms-visibility.js";
import { requestPeerApproval } from "./peer-approval.js";
const FILE = join(DATA_DIR, "delegations.json");
const states = ["pending", "ready", "approval", "dispatching", "sent", "interrupted", "failed", "cancelled"];
let records = readManagedJson(FILE, [], (value) => Array.isArray(value) && value.every((row) => row && typeof row.id === "string" && typeof row.sourceThreadId === "string" && typeof row.targetThreadId === "string"
    && typeof row.toBotId === "string" && typeof row.message === "string" && Number.isInteger(row.depth) && states.includes(row.state)));
const active = new Set();
const waitingNotices = new Set();
const pendingStates = new Set(["pending", "ready", "approval", "dispatching"]);
function save() { writeManagedJson(FILE, records); }
function note(bus, row, text, ok) {
    if (!bus.store.botByThread(row.sourceThreadId))
        return;
    const message = bus.store.appendMessage(row.sourceThreadId, { role: "bot", kind: "activity", tool: { name: text, ok } });
    bus.broadcast({ kind: "message", threadId: row.sourceThreadId, message });
}
function setState(row, state, error) {
    row.state = state;
    row.error = error;
    save();
}
export function delegationRecords() { return structuredClone(records); }
export function queueDelegation(bus, from, item, maxDepth, sourceThreadId = from.threadId) {
    if (item.toBotId === from.id)
        return "self";
    if (item.depth >= maxDepth)
        return "too_deep";
    const target = bus.store.bot(item.toBotId);
    if (!target || !bus.store.taskByThread(from.id, sourceThreadId))
        return "no_target";
    const sourceMessageId = bus.store.activePath(sourceThreadId).filter((m) => m.role === "user" && m.kind === "text").at(-1)?.id;
    // An identical call repeated by the same source turn must not dispatch twice.
    if (records.some((row) => row.sourceThreadId === sourceThreadId && row.sourceMessageId === sourceMessageId
        && row.toBotId === item.toBotId && row.message === item.message && !["cancelled", "failed", "interrupted"].includes(row.state)))
        return "ok";
    if (records.filter((row) => row.sourceThreadId === sourceThreadId && pendingStates.has(row.state)).length >= 4)
        return "too_many";
    const row = { ...item, id: randomUUID(), sourceThreadId, sourceMessageId, targetThreadId: target.threadId, queuedAt: Date.now(), state: "pending" };
    records.push(row);
    save();
    note(bus, row, `Delegated to @${target.name}${item.reason ? `: ${item.reason}` : ""}`, true);
    return "ok";
}
/** Source completion releases only that source's staged work. */
export function drainDelegations(bus, approvals, threadId, runTarget) {
    let changed = false;
    for (const row of records)
        if (row.sourceThreadId === threadId && row.state === "pending") {
            row.state = "ready";
            changed = true;
        }
    if (changed)
        save();
    drainReadyDelegations(bus, approvals, runTarget);
}
/** Target completion and startup retry ready work; they never release pending sources. */
export function drainReadyDelegations(bus, approvals, runTarget) {
    for (const row of records) {
        if (row.state !== "ready" || active.has(row.id))
            continue;
        active.add(row.id);
        void processOne(bus, approvals, row, runTarget).catch((error) => {
            if (row.state === "cancelled")
                return;
            const why = error instanceof Error ? error.message : String(error);
            try {
                setState(row, "failed", why);
                note(bus, row, `error: delegation failed - ${why.slice(0, 160)}`, false);
            }
            catch (reportError) {
                console.error("Could not persist delegation failure", reportError);
            }
        }).finally(() => active.delete(row.id));
    }
}
export function discardDelegations(bus, threadId) {
    const rows = records.filter((row) => row.sourceThreadId === threadId && ["pending", "ready", "approval"].includes(row.state));
    if (!rows.length)
        return;
    for (const row of rows)
        row.state = "cancelled";
    save();
    note(bus, rows[0], `${rows.length} queued delegation${rows.length > 1 ? "s" : ""} dropped - the turn did not finish`, false);
}
/** Dispatch is persisted before the side effect. An uncertain dispatch is never replayed automatically. */
export function recoverDelegations(bus) {
    const interrupted = [];
    for (const row of records) {
        if (row.state === "pending" || row.state === "dispatching") {
            row.error = row.state === "pending" ? "Source turn was interrupted before releasing the handoff." : "Dispatch was interrupted; inspect the target before retrying to avoid duplicate work.";
            row.state = "interrupted";
            interrupted.push(row);
        }
        else if (row.state === "approval")
            row.state = "ready";
    }
    if (records.length)
        save();
    for (const row of interrupted)
        note(bus, row, `Delegation interrupted: ${row.error}`, false);
}
export function retryDelegation(id) {
    const row = records.find((item) => item.id === id);
    if (!row || !["interrupted", "failed"].includes(row.state) || active.has(id))
        return false;
    setState(row, "ready");
    return true;
}
export function cancelDelegation(id) {
    const row = records.find((item) => item.id === id);
    if (!row || ["dispatching", "sent", "cancelled"].includes(row.state))
        return false;
    setState(row, "cancelled");
    return true;
}
async function processOne(bus, approvals, row, runTarget) {
    let sender = bus.store.botByThread(row.sourceThreadId);
    let target = bus.store.bot(row.toBotId);
    if (!sender || !bus.store.taskByThread(sender.id, row.sourceThreadId)) {
        setState(row, "cancelled");
        return;
    }
    if (!target || !bus.store.taskByThread(target.id, row.targetThreadId)) {
        setState(row, "failed", "no such bot or target task");
        note(bus, row, `error: delegation failed - no such bot or target task`, false);
        return;
    }
    const wait = () => {
        setState(row, "ready");
        if (waitingNotices.has(row.id))
            return;
        waitingNotices.add(row.id);
        note(bus, row, `Delegation to @${target.name} waiting - @${target.name} is busy`, true);
    };
    if (target.busy) {
        wait();
        return;
    }
    if (sender.approvePeerComms) {
        setState(row, "approval");
        const verdict = await requestPeerApproval(approvals, sender, target, row.message, "delegate_bot", row.sourceThreadId);
        if (row.state !== "approval")
            return;
        if (verdict !== "allow") {
            setState(row, "cancelled");
            note(bus, row, `Delegation to @${target.name} denied by user`, false);
            return;
        }
        sender = bus.store.botByThread(row.sourceThreadId);
        target = bus.store.bot(row.toBotId);
        if (!sender || !target || !bus.store.taskByThread(target.id, row.targetThreadId)) {
            setState(row, "cancelled");
            return;
        }
        if (target.busy) {
            wait();
            return;
        }
    }
    setState(row, "dispatching");
    const channel = getOrCreateChannel(bus.store, sender, target);
    mirrorExchange(bus, sender, target, row.message, channel, row.sourceThreadId);
    const reason = row.reason ? `\n\n[Reason: ${row.reason}]` : "";
    await runTarget(row.toBotId, `[Delegated by @${sender.name}, another bot in this MausCrew workspace. Do the work and reply directly.]\n\n${row.message}${reason}`, row.depth + 1, row.sourceThreadId, channel, row.targetThreadId);
    setState(row, "sent");
}
export function _pendingCount(threadId) { return records.filter((row) => row.sourceThreadId === threadId && pendingStates.has(row.state)).length; }
/** Reload only used by restart regression tests, with no live dispatches. */
export function _reloadDelegations() {
    records = readManagedJson(FILE, [], (value) => Array.isArray(value));
    active.clear();
    waitingNotices.clear();
}
