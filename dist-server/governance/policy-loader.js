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
/**
 * Give an older policy file the rule that lets credential access be approved.
 *
 * A file written before `safety.sensitive` existed has one rule covering both
 * destructive commands and credential reads, and it denies. After the split,
 * a credential read is no longer "high", so without this it would fall
 * through to the category default — which on a permissive setup is `allow`.
 * Neither the old refusal nor a silent allow is right, so the rule is added
 * in memory, immediately after the destructive rule and ahead of any
 * read-only allow.
 *
 * Additive only, and never written back on load: the file is the user's, and
 * a loader that rewrites it turns every read into an edit.
 */
export function withSensitiveRule(policy) {
    if (policy.rules.some((rule) => rule.id === "safety.sensitive"))
        return policy;
    const sensitive = defaultPolicy.rules.find((rule) => rule.id === "safety.sensitive");
    if (!sensitive)
        return policy;
    const after = policy.rules.findIndex((rule) => rule.id === "safety.high-risk");
    const rules = [...policy.rules];
    rules.splice(after === -1 ? 0 : after + 1, 0, sensitive);
    return { ...policy, rules };
}
/** Keep older permissive policy files from silently bypassing the network
 * boundary introduced by the safer built-in defaults. The user's existing
 * rules remain intact; this additive rule only closes browser/network reads
 * that otherwise match the broad read-only allow rule. */
export function withNetworkRule(policy) {
    if (policy.rules.some((rule) => rule.id === "safety.network-boundary"))
        return policy;
    const network = defaultPolicy.rules.find((rule) => rule.id === "safety.network-boundary");
    if (!network)
        return policy;
    const rules = [...policy.rules];
    const beforeReadOnly = rules.findIndex((rule) => rule.id === "safe.read-only");
    rules.splice(beforeReadOnly === -1 ? rules.length : beforeReadOnly, 0, network);
    return { ...policy, rules };
}
export function loadPolicy() {
    try {
        if (!existsSync(POLICY_FILE))
            return { policy: defaultPolicy };
        return { policy: withNetworkRule(withSensitiveRule(validatePolicy(JSON.parse(readFileSync(POLICY_FILE, "utf8"))))) };
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
