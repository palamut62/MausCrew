import { existsSync, readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { writeFileAtomic } from "../atomic.js";
import { DATA_DIR } from "../config.js";
import { defaultPolicy, validatePolicy } from "./policy-engine.js";
export const POLICIES_DIR = join(DATA_DIR, "policies");
export const POLICY_FILE = join(POLICIES_DIR, "policy.json");
export async function ensureDefaultPolicy() {
    await mkdir(POLICIES_DIR, { recursive: true });
    if (!existsSync(POLICY_FILE))
        writeFileAtomic(POLICY_FILE, JSON.stringify(defaultPolicy, null, 2), { mode: 0o600 });
}
export function loadPolicy() {
    try {
        if (!existsSync(POLICY_FILE))
            return { policy: defaultPolicy };
        return { policy: validatePolicy(JSON.parse(readFileSync(POLICY_FILE, "utf8"))) };
    }
    catch (error) {
        return { policy: null, error: error instanceof Error ? error.message : String(error) };
    }
}
export async function savePolicy(policy) {
    const validated = validatePolicy(policy);
    await mkdir(POLICIES_DIR, { recursive: true });
    writeFileAtomic(POLICY_FILE, JSON.stringify(validated, null, 2), { mode: 0o600 });
    return validated;
}
