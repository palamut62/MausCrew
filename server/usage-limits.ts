import { join } from "node:path";
import { DATA_DIR } from "./config.ts";
import { readManagedJson, writeManagedJson } from "./recovery.ts";
import type { RuntimeEvent } from "./contracts.ts";

export interface UsageLimits { dailyTokens: number; dailyTurns: number; taskTokens: number; taskTurns: number }
interface Counter { tokens: number; turns: number }
interface Ledger {
  limits: UsageLimits; days: Record<string, Counter>; tasks: Record<string, Counter>;
  totals: Record<string, { input: number; output: number }>; events: string[];
}
const EMPTY = { dailyTokens: 0, dailyTurns: 0, taskTokens: 0, taskTurns: 0 };
const dayKey = (at: Date) => `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`;
export class UsageLimiter {
  private data: Ledger;
  private file: string;
  private now: () => Date;
  constructor(file = join(DATA_DIR, "usage-limits.json"), now = () => new Date()) {
    this.file = file;
    this.now = now;
    this.data = readManagedJson<Ledger>(file, { limits: { ...EMPTY }, days: {}, tasks: {}, totals: {}, events: [] }, (v) => Boolean(v && typeof v === "object" && "limits" in v && v.limits && "totals" in v && v.totals && "tasks" in v && v.tasks && "days" in v && v.days && "events" in v && Array.isArray(v.events)));
  }
  snapshot() {
    const day = dayKey(this.now());
    return { limits: this.data.limits, day, today: this.data.days[day] ?? { tokens: 0, turns: 0 }, tasks: this.data.tasks };
  }
  configure(input: UsageLimits) {
    const limits = { ...EMPTY };
    for (const key of Object.keys(limits) as Array<keyof UsageLimits>) {
      const n = input[key];
      if (!Number.isSafeInteger(n) || n < 0 || n > 1_000_000_000) throw Object.assign(new Error("Sınırlar 0 veya pozitif tam sayı olmalıdır."), { status: 400 });
      limits[key] = n;
    }
    this.data.limits = limits;
    this.save();
    return this.snapshot();
  }
  reason(threadId: string): string | null {
    const { limits, today, tasks } = this.snapshot();
    const task = tasks[threadId] ?? { tokens: 0, turns: 0 };
    if (limits.dailyTokens && today.tokens >= limits.dailyTokens) return "Günlük token sınırına ulaşıldı.";
    if (limits.dailyTurns && today.turns >= limits.dailyTurns) return "Günlük tur sınırına ulaşıldı.";
    if (limits.taskTokens && task.tokens >= limits.taskTokens) return "Bu görevin token sınırına ulaşıldı.";
    if (limits.taskTurns && task.turns >= limits.taskTurns) return "Bu görevin tur sınırına ulaşıldı.";
    return null;
  }
  begin(threadId: string) {
    const reason = this.reason(threadId);
    if (reason) throw Object.assign(new Error(`${reason} Ayarlar > Kullanım sınırları bölümünü kontrol edin.`), { status: 429 });
    const day = dayKey(this.now());
    (this.data.days[day] ??= { tokens: 0, turns: 0 }).turns++;
    (this.data.tasks[threadId] ??= { tokens: 0, turns: 0 }).turns++;
    this.save();
  }
  record(event: Extract<RuntimeEvent, { type: "thread.token-usage.updated" }>): { input: number; output: number; exceeded: boolean } {
    if (this.data.events.includes(event.eventId)) return { input: 0, output: 0, exceeded: false };
    this.data.events.push(event.eventId);
    this.data.events = this.data.events.slice(-5000);
    const input = Math.max(0, Math.round(Number(event.input) || 0));
    const output = Math.max(0, Math.round(Number(event.output) || 0));
    let delta = { input, output };
    if (event.cumulative) {
      const key = `${event.providerInstanceId ?? event.provider}:${event.usageSessionId ?? event.threadId}`;
      const last = this.data.totals[key] ?? { input: 0, output: 0 };
      delta = { input: Math.max(0, input - last.input), output: Math.max(0, output - last.output) };
      this.data.totals[key] = { input: Math.max(input, last.input), output: Math.max(output, last.output) };
    }
    const day = dayKey(this.now());
    (this.data.days[day] ??= { tokens: 0, turns: 0 }).tokens += delta.input + delta.output;
    (this.data.tasks[event.threadId] ??= { tokens: 0, turns: 0 }).tokens += delta.input + delta.output;
    this.save();
    const { limits, today, tasks } = this.snapshot();
    const exceeded = Boolean((limits.dailyTokens && today.tokens >= limits.dailyTokens) || (limits.taskTokens && tasks[event.threadId].tokens >= limits.taskTokens));
    return { ...delta, exceeded };
  }
  private save() { writeManagedJson(this.file, this.data); }
}
