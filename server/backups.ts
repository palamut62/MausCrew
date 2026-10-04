import { validRecords } from "./recovery.ts";
import { validBotRecords, validGroupRecords } from "./store.ts";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { DATA_DIR } from "./config.ts";
import { writeFileAtomic } from "./atomic.ts";

const MAX_BYTES = 64 * 1024 * 1024;
const core = /^(bots|groups|projects|workflows|review-queue|routines|usage-limits|telegram-conversations|telegram-inbox)\.json$/;
function allowed(path: string): boolean {
  if (path.includes("\\") || path.split("/").some((part) => !part || part === "." || part === ".." || part.includes(":"))) return false;
  return core.test(path) || /^messages-[\w-]+\.json$/.test(path) || /^memory\/[\w./-]+\.md$/.test(path);
}
interface Backup { format: "mauscrew-backup"; version: 1; createdAt: number; files: Array<{ path: string; text: string; sha256: string }> }
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const fail = () => Object.assign(new Error("Yedek geçersiz, değiştirilmiş veya desteklenen boyutu aşıyor."), { status: 400 });
export function validateBackup(value: unknown): Backup {
  if (!value || typeof value !== "object") throw fail();
  const b = value as Backup;
  if (b.format !== "mauscrew-backup" || b.version !== 1 || !Array.isArray(b.files) || b.files.length > 10000 || !b.files.length) throw fail();
  const names = new Set<string>();
  let bytes = 0;
  for (const f of b.files) {
    if (!f || typeof f.path !== "string" || !allowed(f.path) || typeof f.text !== "string" || names.has(f.path.toLowerCase()) || hash(f.text) !== f.sha256) throw fail();
    names.add(f.path.toLowerCase());
    bytes += Buffer.byteLength(f.text);
    if (bytes > MAX_BYTES) throw fail();
    if (f.path.endsWith(".json")) {
      let parsed: unknown;
      try { parsed = JSON.parse(f.text); } catch { throw fail(); }
      if (!parsed || typeof parsed !== "object") throw fail();
      if (/^(projects|workflows|review-queue)\.json$/.test(f.path) && !validRecords(parsed)) throw fail();
      if (f.path === "bots.json" && !validBotRecords(parsed)) throw fail();
      if (f.path === "groups.json" && !validGroupRecords(parsed)) throw fail();
      if (f.path.startsWith("messages-") && !validRecords(parsed) && !validRecords((parsed as { messages?: unknown }).messages)) throw fail();
    }
  }
  if (!names.has("bots.json") || !names.has("groups.json")) throw fail();
  return b;
}
export function backupPreview(value: unknown) {
  const b = validateBackup(value);
  return { createdAt: b.createdAt, fileCount: b.files.length, bytes: b.files.reduce((n, f) => n + Buffer.byteLength(f.text), 0), files: b.files.map((f) => f.path) };
}
export function createBackup(root = DATA_DIR): Backup {
  const files: Backup["files"] = [];
  const walk = (dir: string, prefix = "") => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const path = prefix + entry.name;
      if (entry.isDirectory() && (path === "memory" || path.startsWith("memory/"))) walk(join(dir, entry.name), path + "/");
      if (entry.isFile() && allowed(path)) {
        const text = readFileSync(join(root, path), "utf8");
        files.push({ path, text, sha256: hash(text) });
      }
    }
  };
  walk(root);
  for (const path of ["bots.json", "groups.json"]) if (!files.some((f) => f.path === path)) files.push({ path, text: "[]", sha256: hash("[]") });
  return validateBackup({ format: "mauscrew-backup", version: 1, createdAt: Date.now(), files });
}
export function saveBackup(root = DATA_DIR) {
  const backup = createBackup(root);
  const id = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  mkdirSync(join(root, "backups"), { recursive: true });
  writeFileAtomic(join(root, "backups", `${id}.json`), JSON.stringify(backup), { mode: 0o600 });
  return { id, ...backupPreview(backup) };
}
export function listBackups(root = DATA_DIR) {
  const dir = join(root, "backups");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => /^\d+-[\w-]+\.json$/.test(name)).sort().reverse().map((name) => {
    try { return { id: name.slice(0, -5), ...backupPreview(JSON.parse(readFileSync(join(dir, name), "utf8"))) }; }
    catch { return null; }
  }).filter((b) => b !== null);
}
export function readBackup(id: string, root = DATA_DIR): Backup {
  if (!/^\d+-[\w-]+$/.test(id)) throw fail();
  return validateBackup(JSON.parse(readFileSync(join(root, "backups", `${id}.json`), "utf8")));
}
export function stageRestore(value: unknown, root = DATA_DIR) {
  const backup = validateBackup(value);
  // A checkpoint is mandatory before a user-approved restore, even if the
  // application is closed immediately afterwards. Damaged data is preserved
  // separately by recovery.ts and is never overwritten here.
  let checkpoint: string | undefined;
  try { checkpoint = saveBackup(root).id; } catch { /* damaged originals stay in the rollback directory below */ }
  writeFileAtomic(join(root, "pending-restore.json"), JSON.stringify(backup), { mode: 0o600 });
  return { ...backupPreview(backup), checkpoint, restartRequired: true };
}
export function restorePending(root = DATA_DIR): boolean {
  const pending = join(root, "pending-restore.json");
  if (!existsSync(pending)) return false;
  const backup = validateBackup(JSON.parse(readFileSync(pending, "utf8")));
  const rollback = join(root, "restore-originals", String(Date.now()));
  for (const f of backup.files) {
    const target = join(root, f.path);
    // Never follow a junction or link supplied by a local workspace.
    for (let dir = dirname(target); dir !== root; dir = dirname(dir)) {
      if (existsSync(dir) && lstatSync(dir).isSymbolicLink()) throw fail();
    }
    if (existsSync(target) && lstatSync(target).isSymbolicLink()) throw fail();
    if (existsSync(target)) {
      mkdirSync(dirname(join(rollback, f.path)), { recursive: true });
      writeFileAtomic(join(rollback, f.path), readFileSync(target, "utf8"), { mode: 0o600 });
    }
  }
  // pending remains until every replace succeeds. Interrupted restores replay
  // the same validated snapshot on the next startup.
  for (const f of backup.files) {
    const target = join(root, f.path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileAtomic(target, f.text, { mode: 0o600 });
    if (f.path.endsWith(".json")) writeFileAtomic(`${target}.lastgood`, f.text, { mode: 0o600 });
  }
  unlinkSync(pending);
  return true;
}
