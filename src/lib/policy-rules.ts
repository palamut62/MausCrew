// Where a rule the user wrote goes in the list.
//
// The engine is first-match-wins (server/governance/policy-engine.ts), so
// placement *is* precedence, and getting it wrong is the difference between
// "always allow git status" and "always allow everything, including the
// destructive command the safety rule was holding".
//
// Two invariants, both enforced here rather than left to whoever clicks Add:
//
//  1. The built-in `safety.*` rules keep the front of the list. They are the
//     ones that stop a high-risk command and hold external writes; a user
//     rule that outranked them would be a way to switch them off by accident.
//  2. Among user rules, ASK and DENY sit ahead of ALLOW. This is the same
//     precedence Grok Bot's Auto Review states — a Require Approval rule wins
//     when both match — reached by ordering rather than by changing how the
//     engine evaluates, so an existing policy file keeps behaving exactly as
//     it did.
export type PolicyOutcome = "allow" | "ask" | "deny";

export interface PolicyRule {
  id: string;
  description?: string;
  when?: { tools?: string[]; categories?: string[] };
  decision: PolicyOutcome;
}

/** Rules shipped with the app. Editable in the file, not removable here. */
export const isBuiltInRule = (rule: PolicyRule) => rule.id.startsWith("safety.") || rule.id.startsWith("safe.");

/** A stable, readable id — it appears in the audit log next to every decision
 * the rule made, so a random uuid would make that log unreadable. */
export function ruleId(existing: PolicyRule[], pattern: string, decision: PolicyOutcome): string {
  const slug = pattern.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "rule";
  const base = `user.${decision}.${slug}`;
  if (!existing.some((rule) => rule.id === base)) return base;
  let n = 2;
  while (existing.some((rule) => rule.id === `${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

export function insertRule(rules: PolicyRule[], rule: PolicyRule): PolicyRule[] {
  if (rule.decision === "allow") return [...rules, rule];
  // The stopping block is the run at the front of the list: built-ins, then
  // the ask/deny rules already written. A new stopping rule joins the end of
  // that run rather than jumping it, so two user rules keep the order they
  // were added in — and it still lands ahead of every user ALLOW.
  let index = 0;
  while (index < rules.length && (isBuiltInRule(rules[index]) || rules[index].decision !== "allow")) index += 1;
  return [...rules.slice(0, index), rule, ...rules.slice(index)];
}

export function removeRule(rules: PolicyRule[], id: string): PolicyRule[] {
  return rules.filter((rule) => rule.id !== id || isBuiltInRule(rule));
}
