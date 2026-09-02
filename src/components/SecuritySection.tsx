import { useCallback, useEffect, useState } from "react";
import { ArrowClockwise, Check, FloppyDisk, Plus, ShieldCheck, Trash, WarningCircle } from "@phosphor-icons/react";

import { Card } from "./SettingsPrimitives";
import { cn } from "@/lib/cn";
import { insertRule, isBuiltInRule, removeRule, ruleId, type PolicyRule } from "@/lib/policy-rules";

type Outcome = "allow" | "ask" | "deny";
type Policy = {
  version: 1;
  defaults: Record<string, Outcome>;
  rules: PolicyRule[];
};

/** Categories the engine knows. Kept in step with actionCategories on the
 * server; an unknown one is refused there, which is the real gate. */
const CATEGORIES = ["shell", "filesystem", "browser", "computer", "mcp", "composio", "network", "agent", "other"] as const;
type AuditRecord = {
  id: string;
  timestamp: string;
  agentId: string;
  engine: string;
  tool: string;
  policyDecision: Outcome;
  policyRuleId: string;
  policyReason: string;
  userDecision?: "allow" | "deny";
  result: string;
  action: { risk: string; tool: { category: string }; metadata?: { summary?: string } };
};

const outcomeClass: Record<Outcome, string> = {
  allow: "text-success",
  ask: "text-warning",
  deny: "text-danger",
};

async function jsonApi(path: string, init?: RequestInit) {
  const response = await fetch(path, { headers: { "content-type": "application/json" }, ...init });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? body.message ?? `${response.status} ${response.statusText}`);
  return body;
}

export function SecuritySection() {
  const [tab, setTab] = useState<"policy" | "audit">("policy");
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [toolFilter, setToolFilter] = useState("");
  const [decisionFilter, setDecisionFilter] = useState("");
  const [draftTool, setDraftTool] = useState("");
  const [draftCategory, setDraftCategory] = useState("");
  const [draftDecision, setDraftDecision] = useState<Outcome>("ask");
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "saved" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const loadPolicy = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const body = await jsonApi("/api/security/policy");
      setPolicy(body.policy);
      setStatus("idle");
    } catch (cause) {
      setStatus("error");
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  const loadAudit = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (toolFilter.trim()) params.set("tool", toolFilter.trim());
      if (decisionFilter) params.set("decision", decisionFilter);
      const body = await jsonApi(`/api/security/audit?${params}`);
      setRecords(body.records ?? []);
      setStatus("idle");
    } catch (cause) {
      setStatus("error");
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [decisionFilter, toolFilter]);

  useEffect(() => {
    if (tab === "policy") void loadPolicy();
    else void loadAudit();
  }, [tab, loadAudit, loadPolicy]);

  const save = async () => {
    if (!policy) return;
    setStatus("saving");
    setError(null);
    try {
      const body = await jsonApi("/api/security/policy", { method: "PUT", body: JSON.stringify(policy) });
      setPolicy(body.policy);
      setStatus("saved");
      window.setTimeout(() => setStatus("idle"), 1_500);
    } catch (cause) {
      setStatus("error");
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex rounded-lg border border-hairline bg-inset p-1">
        {(["policy", "audit"] as const).map((id) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn("flex-1 rounded-md px-3 py-2 text-[13px] capitalize", tab === id ? "bg-raised text-ink" : "text-ink-secondary hover:text-ink")}
          >
            {id === "policy" ? "Policies" : "Audit log"}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">
          <WarningCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}. Governance fails closed until this is fixed.</span>
        </div>
      )}

      {tab === "policy" && (
        <>
          <Card title="Policy engine" subtitle="Every provider permission is normalized and decided on the server. DENY wins; invalid policy files fail closed.">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {policy && Object.entries(policy.defaults).map(([category, outcome]) => (
                <label key={category} className="flex items-center justify-between gap-3 rounded-lg border border-hairline bg-inset px-3 py-2">
                  <span className="text-[12.5px] capitalize text-ink">{category}</span>
                  <select
                    value={outcome}
                    onChange={(event) => setPolicy({ ...policy, defaults: { ...policy.defaults, [category]: event.target.value as Outcome } })}
                    className={cn("rounded-md border border-hairline bg-panel px-2 py-1 text-[11px] font-semibold uppercase outline-none", outcomeClass[outcome])}
                  >
                    <option value="allow">ALLOW</option>
                    <option value="ask">ASK</option>
                    <option value="deny">DENY</option>
                  </select>
                </label>
              ))}
            </div>
            <button
              onClick={() => void save()}
              disabled={!policy || status === "saving" || status === "loading"}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-[12px] font-semibold text-black disabled:opacity-40"
            >
              {status === "saved" ? <Check size={15} weight="bold" /> : <FloppyDisk size={15} weight="bold" />}
              {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "Save policy"}
            </button>
          </Card>

          <Card title="Safety rules" subtitle="Rules run before category defaults and cannot be bypassed by Auto mode. The first match wins, so order is precedence: built-in rules stay in front, and your Require approval / Deny rules sit ahead of your Always allow rules.">
            <div className="space-y-2">
              {policy?.rules.map((rule) => (
                <div key={rule.id} className="flex items-start justify-between gap-3 rounded-lg border border-hairline px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate font-mono text-[11.5px] text-ink">{rule.id}</div>
                    <div className="mt-0.5 text-[11px] text-ink-secondary">
                      {rule.description ?? [
                        rule.when?.tools?.length ? `tools: ${rule.when.tools.join(", ")}` : "",
                        rule.when?.categories?.length ? `categories: ${rule.when.categories.join(", ")}` : "",
                      ].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {/* Built-in rules can be re-decided but not removed. A
                        rule that only ever denies, with no way to say "ask me
                        instead", is a dead end: the action is refused and the
                        app offers nowhere to approve it. */}
                    <select
                      value={rule.decision}
                      onChange={(event) => policy && setPolicy({
                        ...policy,
                        rules: policy.rules.map((candidate) =>
                          candidate.id === rule.id ? { ...candidate, decision: event.target.value as Outcome } : candidate,
                        ),
                      })}
                      className={cn(
                        "rounded-md border border-hairline bg-panel px-1.5 py-0.5 text-[10.5px] font-semibold uppercase outline-none",
                        outcomeClass[rule.decision],
                      )}
                      aria-label={`Decision for ${rule.id}`}
                    >
                      <option value="allow">ALLOW</option>
                      <option value="ask">ASK</option>
                      <option value="deny">DENY</option>
                    </select>
                    {policy && !isBuiltInRule(rule) && (
                      <button
                        onClick={() => setPolicy({ ...policy, rules: removeRule(policy.rules, rule.id) })}
                        className="rounded-md p-1 text-danger hover:bg-danger/10"
                        aria-label={`Remove rule ${rule.id}`}
                      >
                        <Trash size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 space-y-2 rounded-lg border border-dashed border-hairline p-3">
              <div className="text-[11px] text-ink-secondary">
                Add your own rule. A tool pattern may use <span className="font-mono">*</span> — <span className="font-mono">mcp__custom_*</span>, <span className="font-mono">Bash</span>, <span className="font-mono">browser_*</span>.
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  value={draftTool}
                  onChange={(event) => setDraftTool(event.target.value)}
                  placeholder="Tool pattern"
                  className="min-w-0 flex-1 rounded-lg border border-hairline bg-inset px-3 py-2 text-[12px] text-ink outline-none"
                />
                <select
                  value={draftCategory}
                  onChange={(event) => setDraftCategory(event.target.value)}
                  className="rounded-lg border border-hairline bg-inset px-2 py-2 text-[12px] text-ink outline-none"
                >
                  <option value="">Any category</option>
                  {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
                <select
                  value={draftDecision}
                  onChange={(event) => setDraftDecision(event.target.value as Outcome)}
                  className={cn("rounded-lg border border-hairline bg-inset px-2 py-2 text-[11px] font-semibold uppercase outline-none", outcomeClass[draftDecision])}
                >
                  <option value="ask">ASK</option>
                  <option value="deny">DENY</option>
                  <option value="allow">ALLOW</option>
                </select>
                <button
                  onClick={() => {
                    if (!policy || (!draftTool.trim() && !draftCategory)) return;
                    const pattern = draftTool.trim();
                    const rule: PolicyRule = {
                      id: ruleId(policy.rules, pattern || draftCategory, draftDecision),
                      description: `You added this: ${draftDecision} ${pattern || "any tool"}${draftCategory ? ` in ${draftCategory}` : ""}.`,
                      when: {
                        ...(pattern ? { tools: [pattern] } : {}),
                        ...(draftCategory ? { categories: [draftCategory] } : {}),
                      },
                      decision: draftDecision,
                    };
                    setPolicy({ ...policy, rules: insertRule(policy.rules, rule) });
                    setDraftTool("");
                    setDraftCategory("");
                  }}
                  disabled={!policy || (!draftTool.trim() && !draftCategory)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-2 text-[12px] text-ink hover:bg-raised disabled:opacity-40"
                >
                  <Plus size={13} weight="bold" /> Add
                </button>
              </div>
              <div className="text-[11px] text-ink-secondary">Rules are staged here; press Save policy above to apply them.</div>
            </div>
          </Card>
        </>
      )}

      {tab === "audit" && (
        <Card title="Audit log" subtitle="Redacted governance records stored locally in ~/.mauscrew/audit as daily NDJSON.">
          <div className="mb-3 flex flex-wrap gap-2">
            <input
              value={toolFilter}
              onChange={(event) => setToolFilter(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && void loadAudit()}
              placeholder="Filter tool"
              className="min-w-0 flex-1 rounded-lg border border-hairline bg-inset px-3 py-2 text-[12px] text-ink outline-none"
            />
            <select value={decisionFilter} onChange={(event) => setDecisionFilter(event.target.value)} className="rounded-lg border border-hairline bg-inset px-3 py-2 text-[12px] text-ink outline-none">
              <option value="">All decisions</option>
              <option value="allow">ALLOW</option>
              <option value="ask">ASK</option>
              <option value="deny">DENY</option>
            </select>
            <button onClick={() => void loadAudit()} className="rounded-lg border border-hairline p-2 text-ink-secondary hover:bg-raised hover:text-ink" aria-label="Refresh audit log">
              <ArrowClockwise size={16} />
            </button>
          </div>
          <div className="space-y-2">
            {records.length === 0 && status !== "loading" && <div className="py-8 text-center text-[12px] text-ink-secondary">No matching governance actions yet.</div>}
            {records.map((record) => (
              <div key={record.id} className="rounded-lg border border-hairline bg-inset px-3 py-2">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                  <span className="text-ink-secondary">{new Date(record.timestamp).toLocaleString()}</span>
                  <span className="font-medium text-ink">{record.engine}</span>
                  <span className="font-mono text-ink">{record.tool}</span>
                  <span className={cn("ml-auto font-semibold uppercase", outcomeClass[record.policyDecision])}>{record.policyDecision}</span>
                </div>
                <div className="mt-1 truncate text-[11.5px] text-ink-secondary" title={String(record.action.metadata?.summary ?? "")}>{String(record.action.metadata?.summary ?? record.policyReason)}</div>
                <div className="mt-1 flex items-center gap-2 text-[10.5px] text-ink-secondary">
                  <ShieldCheck size={13} /> {record.policyRuleId} · {record.action.risk} risk · {record.result}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
