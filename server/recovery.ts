import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, copyFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { writeFileAtomic } from "./atomic.ts";

export interface RecoveryIssue { id: string; file: string; detectedAt: number; backupAvailable: boolean }
export function validRecords(value: unknown): boolean {
  return Array.isArray(value) && value.every((row) => row && typeof row === "object" && typeof row.id === "string" && row.id.length > 0);
}
const issues = new Map<string, RecoveryIssue>();
export function recoveryIssues(): RecoveryIssue[] { return [...issues.values()]; }
export function needsRecovery(file: string): boolean { return issues.has(resolve(file)); }
export function assertWritable(file: string): void {
  if (needsRecovery(file)) throw Object.assign(new Error(`${basename(file)} okunamadı. Kurtarma merkezinden son sağlam kopyayı geri yükleyin.`), { status: 423 });
}
export function readManagedJson<T>(file: string, fallback: T, valid: (value: unknown) => boolean = () => true): T {
  try {
    const value: unknown = JSON.parse(readFileSync(file, "utf8"));
    if (!valid(value)) throw new Error("Invalid stored data");
    return value as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    const key = resolve(file);
    const id = createHash("sha256").update(key).digest("hex").slice(0, 20);
    const quarantine = join(dirname(file), ".recovery");
    let backupAvailable = false;
    try { backupAvailable = valid(JSON.parse(readFileSync(`${file}.lastgood`, "utf8"))); } catch { /* no usable backup */ }
    issues.set(key, { id, file: basename(file), detectedAt: Date.now(), backupAvailable });
    try {
      mkdirSync(quarantine, { recursive: true });
      const preserved = join(quarantine, `${basename(file)}.${id}.damaged`);
      if (existsSync(file) && !existsSync(preserved)) copyFileSync(file, preserved);
    } catch { /* The original remains protected even when its copy cannot be written. */ }
    return fallback;
  }
}
export function writeManagedJson(file: string, value: unknown): void {
  assertWritable(file);
  mkdirSync(dirname(file), { recursive: true });
  const data = JSON.stringify(value, null, 2);
  if (existsSync(file)) {
    // Validate the previous version even if it became damaged after loading.
    readManagedJson(file, null);
    assertWritable(file);
    writeFileAtomic(`${file}.lastgood`, readFileSync(file, "utf8"), { mode: 0o600 });
  } else writeFileAtomic(`${file}.lastgood`, data, { mode: 0o600 });
  writeFileAtomic(file, data, { mode: 0o600 });
}
export function restoreLastGood(id: string): void {
  const entry = [...issues].find(([, issue]) => issue.id === id);
  if (!entry?.[1].backupAvailable) throw Object.assign(new Error("Sağlam kopya bulunamadı."), { status: 404 });
  const [file] = entry;
  const data = readFileSync(`${file}.lastgood`, "utf8");
  JSON.parse(data);
  writeFileAtomic(file, data, { mode: 0o600 });
  // Keep the write lock until restart reloads the recovered state.
}
