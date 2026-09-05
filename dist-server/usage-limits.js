import { join } from "node:path";
import { DATA_DIR } from "./config.js";
import { readManagedJson, writeManagedJson } from "./recovery.js";
const EMPTY = { dailyTokens: 0, dailyTurns: 0, taskTokens: 0, taskTurns: 0 };
const dayKey = (at) => `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`;
// The ledger is rewritten on every token event, so it cannot grow forever.
// Days are kept for a season; per-task and per-session counters are held as
// bounded recency maps — a deleted task simply ages out of them.
const MAX_DAYS = 90;
const MAX_TASKS = 500;
const MAX_TOTALS = 500;
/** Re-inserts the key so object insertion order doubles as recency, then drops
 * whatever fell off the far end. */
function touch(map, key, value, max) {
    delete map[key];
    map[key] = value;
    const keys = Object.keys(map);
    for (const stale of keys.slice(0, Math.max(0, keys.length - max)))
        delete map[stale];
}
export class UsageLimiter {
    data;
    file;
    now;
    constructor(file = join(DATA_DIR, "usage-limits.json"), now = () => new Date()) {
        this.file = file;
        this.now = now;
        this.data = readManagedJson(file, { limits: { ...EMPTY }, days: {}, tasks: {}, totals: {}, events: [] }, (v) => Boolean(v && typeof v === "object" && "limits" in v && v.limits && "totals" in v && v.totals && "tasks" in v && v.tasks && "days" in v && v.days && "events" in v && Array.isArray(v.events)));
    }
    snapshot() {
        const day = dayKey(this.now());
        return { limits: this.data.limits, day, today: this.data.days[day] ?? { tokens: 0, turns: 0 }, tasks: this.data.tasks };
    }
    configure(input) {
        const limits = { ...EMPTY };
        for (const key of Object.keys(limits)) {
            const n = input[key];
            if (!Number.isSafeInteger(n) || n < 0 || n > 1_000_000_000)
                throw Object.assign(new Error("Sınırlar 0 veya pozitif tam sayı olmalıdır."), { status: 400 });
            limits[key] = n;
        }
        this.data.limits = limits;
        this.save();
        return this.snapshot();
    }
    reason(threadId) {
        const { limits, today, tasks } = this.snapshot();
        const task = tasks[threadId] ?? { tokens: 0, turns: 0 };
        if (limits.dailyTokens && today.tokens >= limits.dailyTokens)
            return "Günlük token sınırına ulaşıldı.";
        if (limits.dailyTurns && today.turns >= limits.dailyTurns)
            return "Günlük tur sınırına ulaşıldı.";
        if (limits.taskTokens && task.tokens >= limits.taskTokens)
            return "Bu görevin token sınırına ulaşıldı.";
        if (limits.taskTurns && task.turns >= limits.taskTurns)
            return "Bu görevin tur sınırına ulaşıldı.";
        return null;
    }
    begin(threadId) {
        const reason = this.reason(threadId);
        if (reason)
            throw Object.assign(new Error(`${reason} Ayarlar > Kullanım sınırları bölümünü kontrol edin.`), { status: 429 });
        const day = dayKey(this.now());
        (this.data.days[day] ??= { tokens: 0, turns: 0 }).turns++;
        const task = this.data.tasks[threadId] ?? { tokens: 0, turns: 0 };
        task.turns++;
        touch(this.data.tasks, threadId, task, MAX_TASKS);
        this.prune();
        this.save();
    }
    record(event) {
        if (this.data.events.includes(event.eventId))
            return { input: 0, output: 0, exceeded: false };
        this.data.events.push(event.eventId);
        this.data.events = this.data.events.slice(-5000);
        const input = Math.max(0, Math.round(Number(event.input) || 0));
        const output = Math.max(0, Math.round(Number(event.output) || 0));
        let delta = { input, output };
        if (event.cumulative) {
            const key = `${event.providerInstanceId ?? event.provider}:${event.usageSessionId ?? event.threadId}`;
            const last = this.data.totals[key] ?? { input: 0, output: 0 };
            delta = { input: Math.max(0, input - last.input), output: Math.max(0, output - last.output) };
            touch(this.data.totals, key, { input: Math.max(input, last.input), output: Math.max(output, last.output) }, MAX_TOTALS);
        }
        const day = dayKey(this.now());
        (this.data.days[day] ??= { tokens: 0, turns: 0 }).tokens += delta.input + delta.output;
        const task = this.data.tasks[event.threadId] ?? { tokens: 0, turns: 0 };
        task.tokens += delta.input + delta.output;
        touch(this.data.tasks, event.threadId, task, MAX_TASKS);
        this.prune();
        this.save();
        const { limits, today, tasks } = this.snapshot();
        const exceeded = Boolean((limits.dailyTokens && today.tokens >= limits.dailyTokens) || (limits.taskTokens && tasks[event.threadId].tokens >= limits.taskTokens));
        return { ...delta, exceeded };
    }
    /** Days sort lexically, so the oldest keys are the ones to drop. */
    prune() {
        const days = Object.keys(this.data.days).sort();
        for (const stale of days.slice(0, Math.max(0, days.length - MAX_DAYS)))
            delete this.data.days[stale];
    }
    save() { writeManagedJson(this.file, this.data); }
}
