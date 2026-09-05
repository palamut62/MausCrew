import { join } from "node:path";
import { validRecords, readManagedJson, writeManagedJson } from "./recovery.js";
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
    const status = ["pending", "sending", "sent", "failed", "unknown", "dismissed"].includes(String(value.status))
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
        revision: Number(value.revision) || 1,
        receipt: value.receipt,
        deliveryThreadId: clean(value.deliveryThreadId, 100) || undefined,
        result: clean(value.result, 8_000) || undefined,
        createdAt,
        updatedAt: Number(value.updatedAt) || createdAt,
    };
}
const VERDICT = /^DELIVERY: NOT SENT - .+/;
/** Model prose cannot prove delivery or non-delivery. Keep a dispatched
 * operation indeterminate until a connector receipt or target check exists. */
export function deliveryOutcome(reply, turnOk) {
    const text = reply.trim();
    // Model text is not a receipt, including a model's claim that it failed.
    // A dispatched turn is indeterminate until the target is checked.
    const explicitFailure = turnOk && VERDICT.test(text.split(/\r?\n/).at(-1) ?? "");
    return {
        status: "unknown",
        result: `${text || "Gönderim turu sona erdi."}\n\n${explicitFailure ? "Bot gönderemediğini bildirdi. " : ""}Teslim doğrulanmadı. Tekrar göndermeden önce hedefi kontrol edin.`,
    };
}
export class ReviewQueue {
    items = [];
    file;
    constructor(file = REVIEW_FILE) {
        this.file = file;
        try {
            const rows = readManagedJson(file, [], (v) => validRecords(v) && v.every((row) => normalize(row) !== null));
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
            revision: 1,
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
        if (patch.receipt)
            item.receipt = patch.receipt;
        item.updatedAt = Date.now();
        this.save();
        return structuredClone(item);
    }
    /** Interrupted sends require target verification before any retry. */
    recoverStuckDeliveries() {
        const stuck = this.items.filter((item) => item.status === "sending");
        for (const item of stuck) {
            item.status = "unknown";
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
    edit(id, patch) {
        const item = this.items.find((row) => row.id === id);
        if (!item)
            return null;
        if (!["pending", "failed"].includes(item.status) || patch.revision !== (item.revision ?? 1)) {
            throw Object.assign(new Error("Taslak değişti veya gönderim başladı. Listeyi yenileyin."), { status: 409 });
        }
        const title = clean(patch.title, 160), target = clean(patch.target, 200), content = clean(patch.content, 40_000);
        if (!title || !target || !content)
            throw Object.assign(new Error("Başlık, hedef ve içerik zorunludur."), { status: 400 });
        Object.assign(item, { title, target, content, revision: (item.revision ?? 1) + 1, updatedAt: Date.now() });
        this.save();
        return structuredClone(item);
    }
    save() {
        writeManagedJson(this.file, this.items);
    }
}
