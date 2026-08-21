import { actionCategories } from "./action.js";
export const defaultPolicy = {
    version: 1,
    defaults: {
        shell: "ask",
        filesystem: "ask",
        browser: "allow",
        computer: "ask",
        mcp: "ask",
        composio: "ask",
        network: "allow",
        agent: "ask",
        other: "ask",
    },
    rules: [
        {
            id: "safety.high-risk",
            description: "Block destructive commands and sensitive credential access.",
            when: { risks: ["high"] },
            decision: "deny",
        },
        {
            id: "safety.external-write",
            description: "External writes require a person at the approval card.",
            when: { externalWrite: true },
            decision: "ask",
        },
        {
            id: "safe.read-only",
            description: "Allow non-sensitive read-only actions.",
            when: { intents: ["read"] },
            decision: "allow",
        },
    ],
};
function globMatches(value, glob) {
    const expression = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*").replaceAll("?", ".");
    return new RegExp(`^${expression}$`, "i").test(value);
}
function matches(rule, action) {
    const when = rule.when;
    const summary = String(action.metadata?.summary ?? "");
    return ((!when.categories?.length || when.categories.includes(action.tool.category)) &&
        (!when.tools?.length || when.tools.some((tool) => globMatches(action.tool.name, tool))) &&
        (!when.intents?.length || (action.intent !== undefined && when.intents.includes(action.intent))) &&
        (!when.risks?.length || when.risks.includes(action.risk)) &&
        (when.externalWrite === undefined || when.externalWrite === action.externalWrite) &&
        (!when.summaryMatches?.length || when.summaryMatches.some((pattern) => globMatches(summary, pattern))));
}
export function validatePolicy(value) {
    if (!value || typeof value !== "object")
        throw new Error("policy must be an object");
    const policy = value;
    if (policy.version !== 1)
        throw new Error("policy version must be 1");
    if (!policy.defaults || typeof policy.defaults !== "object")
        throw new Error("policy defaults are required");
    for (const category of actionCategories) {
        if (!["allow", "ask", "deny"].includes(policy.defaults[category])) {
            throw new Error(`policy default for ${category} must be allow, ask, or deny`);
        }
    }
    if (!Array.isArray(policy.rules))
        throw new Error("policy rules must be an array");
    const ids = new Set();
    for (const rule of policy.rules) {
        if (!rule?.id || ids.has(rule.id))
            throw new Error("policy rule ids must be present and unique");
        ids.add(rule.id);
        if (!rule.when || typeof rule.when !== "object")
            throw new Error(`policy rule ${rule.id} needs a when object`);
        if (!["allow", "ask", "deny"].includes(rule.decision))
            throw new Error(`policy rule ${rule.id} has an invalid decision`);
        for (const pattern of rule.when.summaryMatches ?? []) {
            if (typeof pattern !== "string")
                throw new Error(`policy rule ${rule.id} contains a non-string pattern`);
            globMatches("validation", pattern);
        }
    }
    return policy;
}
export function evaluatePolicy(loaded, action) {
    if (!loaded.policy || loaded.error) {
        return {
            outcome: "deny",
            ruleId: "policy.invalid",
            reason: loaded.error ? `Policy could not be loaded: ${loaded.error}` : "No policy is loaded.",
            failClosed: true,
        };
    }
    for (const rule of loaded.policy.rules) {
        if (!matches(rule, action))
            continue;
        return {
            outcome: rule.decision,
            ruleId: rule.id,
            reason: rule.description ?? `Matched policy rule ${rule.id}.`,
            failClosed: false,
        };
    }
    return {
        outcome: loaded.policy.defaults[action.tool.category],
        ruleId: `defaults.${action.tool.category}`,
        reason: `The ${action.tool.category} default applies.`,
        failClosed: false,
    };
}
