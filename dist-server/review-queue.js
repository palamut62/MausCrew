import { readFileSync } from "node:fs";
import { join } from "node:path";
import { writeFileAtomic } from "./atomic.js";
import { DATA_DIR } from "./config.js";
import { newId } from "./contracts.js";
const REVIEW_FILE = join(DATA_DIR, "review-queue.json");
function clean(value, max) {
    return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function normalize(value) {
    const id = clean(value.id, 100);
    const title = clean(value.title, 160);
    const content = clean(value.content, 40_000);
    const target = clean(value.target, 200);
    const sourceBotId = clean(value.sourceBotId, 100);
    const sourceThreadId = clean(value.sourceThreadId, 100);
    if (!id || !title || !content || !target || !sourceBotId || !sourceThreadId)
        return null;
    const status = ["pending", "sending", "sent", "failed", "dismissed"].includes(String(value.status))
        ? value.status
        : "pending";
    const createdAt = Number(value.createdAt) || Date.now();
    return {
        id,
        title,
        content,
        target,
        sourceBotId,
        sourceThreadId,
        projectId: clean(value.projectId, 100) || undefined,
        status,
        deliveryThreadId: clean(value.deliveryThreadId, 100) || undefined,
        result: clean(value.result, 8_000) || undefined,
        createdAt,
        updatedAt: Number(value.updatedAt) || createdAt,
    };
}
/** The line the delivery turn is asked to end on. Anything decorative around
 * it — bold, a bullet, a quote marker — still counts; the verdict is what
 * matters, not the formatting the model reached for. */
const VERDICT = /^[\s*_`>-]*delivery\s*:\s*(sent|not sent)\b/i;
/**
 * What a finished delivery turn actually claims happened.
 *
 * A completed turn is not a delivered message: a bot with no mail tool ends
 * its turn perfectly successfully after saying it cannot send anything. Taking
 * `ok` as proof stamped those items "sent" and buried the truth in the result
 * text. So the turn has to say it in a line we can read, and silence counts
 * against it — an item wrongly marked failed can be retried and is visibly
 * wrong, while one wrongly marked sent is a lie the user acts on.
 */
export function deliveryOutcome(reply, turnOk) {
    const text = reply.trim();
    if (!turnOk)
        return { status: "failed", result: text || "The approved send did not complete." };
    let verdict = null;
    for (const line of text.split(/\r?\n/)) {
        const match = line.match(VERDICT);
        // last verdict wins: a bot that corrects itself mid-reply means the
        // correction, and a quoted earlier attempt is not the current one
        if (match)
            verdict = match[1].toLowerCase() === "sent" ? "sent" : "not sent";
    }
    if (verdict === "sent")
        return { status: "sent", result: text };
    if (verdict === "not sent")
        return { status: "failed", result: text };
    return {
        status: "failed",
        result: text
            ? `${text}\n\n(Marked not sent — the delivery turn never confirmed it.)`
            : "The delivery turn ended without confirming anything was sent.",
    };
}
export class ReviewQueue {
    items = [];
    file;
    constructor(file = REVIEW_FILE) {
        this.file = file;
        try {
            const rows = JSON.parse(readFileSync(file, "utf8"));
            this.items = Array.isArray(rows)
                ? rows.map((row) => normalize(row)).filter((row) => Boolean(row))
                : [];
        }
        catch {
            this.items = [];
        }
    }
    list() {
        return this.items.map((item) => structuredClone(item));
    }
    get(id) {
        const item = this.items.find((candidate) => candidate.id === id);
        return item ? structuredClone(item) : undefined;
    }
    create(input) {
        const title = clean(input.title, 160);
        const content = clean(input.content, 40_000);
        const target = clean(input.target, 200);
        if (!title || !content || !target)
            throw Object.assign(new Error("Review items need a title, content, and target"), { status: 400 });
        const now = Date.now();
        const item = {
            id: newId(),
            title,
            content,
            target,
            sourceBotId: input.sourceBotId,
            sourceThreadId: input.sourceThreadId,
            projectId: clean(input.projectId, 100) || undefined,
            status: "pending",
            createdAt: now,
            updatedAt: now,
        };
        this.items.unshift(item);
        this.save();
        return structuredClone(item);
    }
    update(id, patch) {
        const item = this.items.find((candidate) => candidate.id === id);
        if (!item)
            return null;
        if (patch.status)
            item.status = patch.status;
        if (patch.deliveryThreadId !== undefined)
            item.deliveryThreadId = clean(patch.deliveryThreadId, 100) || undefined;
        if (patch.result !== undefined)
            item.result = clean(patch.result, 8_000) || undefined;
        item.updatedAt = Date.now();
        this.save();
        return structuredClone(item);
    }
    /** Deliveries a dead process left mid-flight. The thread-to-item map lives
     * in memory, so a restart can never learn how those sends ended — and
     * "sending" shows no buttons and is not approvable, which made it a dead end
     * only a text editor could clear. Failing them is honest about the unknown
     * and, unlike the state they were stuck in, retryable. */
    recoverStuckDeliveries() {
        const stuck = this.items.filter((item) => item.status === "sending");
        for (const item of stuck) {
            item.status = "failed";
            item.result = "MausCrew restarted while this was being sent, so the outcome is unknown. Check the target before retrying.";
            item.updatedAt = Date.now();
        }
        if (stuck.length)
            this.save();
        return stuck.length;
    }
    remove(id) {
        const before = this.items.length;
        this.items = this.items.filter((item) => item.id !== id);
        if (this.items.length === before)
            return false;
        this.save();
        return true;
    }
    save() {
        writeFileAtomic(this.file, JSON.stringify(this.items, null, 2));
    }
}
