import { appendFile, mkdir, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { DATA_DIR } from "../config.js";
export const AUDIT_DIR = join(DATA_DIR, "audit");
const SENSITIVE_KEYS = new Set([
    "authorization",
    "password",
    "secret",
    "token",
    "access_token",
    "refresh_token",
    "api_key",
    "apikey",
    "content",
    "prompt",
    "raw",
]);
function normalizedKey(key) {
    return key.replaceAll(/[^a-zA-Z0-9]/g, "").toLowerCase();
}
export function redactAuditValue(value) {
    if (Array.isArray(value))
        return value.map(redactAuditValue);
    if (typeof value === "string") {
        return value
            .replace(/\b(authorization\s*:\s*(?:bearer|basic)\s+)[^\s"']+/gi, "$1[REDACTED]")
            .replace(/\b(api[_-]?key|token|password|secret)\s*[=:]\s*[^\s"']+/gi, "$1=[REDACTED]")
            .replace(/\b(sk|xai|ghp|github_pat|ak)_[A-Za-z0-9_-]{12,}\b/g, "$1_[REDACTED]");
    }
    if (!value || typeof value !== "object")
        return value;
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [
        key,
        SENSITIVE_KEYS.has(key.toLowerCase()) || SENSITIVE_KEYS.has(normalizedKey(key))
            ? "[REDACTED]"
            : redactAuditValue(nested),
    ]));
}
export class AuditStore {
    directory;
    constructor(directory = AUDIT_DIR) {
        this.directory = directory;
    }
    async append(record) {
        await mkdir(this.directory, { recursive: true });
        const day = record.timestamp.slice(0, 10);
        const safe = redactAuditValue(record);
        await appendFile(join(this.directory, `${day}.ndjson`), `${JSON.stringify(safe)}\n`, { encoding: "utf8", mode: 0o600 });
    }
    async list(input = {}) {
        await mkdir(this.directory, { recursive: true });
        const files = (await readdir(this.directory)).filter((file) => /^\d{4}-\d{2}-\d{2}\.ndjson$/.test(file)).sort().reverse();
        const requested = Math.min(Math.max(input.limit ?? 100, 1), 500);
        const records = [];
        for (const file of files) {
            const lines = (await readFile(join(this.directory, file), "utf8")).split(/\r?\n/).filter(Boolean).reverse();
            for (const line of lines) {
                try {
                    const record = JSON.parse(line);
                    if (input.agentId && record.agentId !== input.agentId)
                        continue;
                    if (input.engine && record.engine !== input.engine)
                        continue;
                    if (input.tool && !record.tool.toLowerCase().includes(input.tool.toLowerCase()))
                        continue;
                    if (input.decision && record.policyDecision !== input.decision)
                        continue;
                    if (input.result && record.result !== input.result)
                        continue;
                    records.push(record);
                    if (records.length >= requested)
                        return records;
                }
                catch {
                    // One interrupted final line must not hide older valid records.
                }
            }
        }
        return records;
    }
}
