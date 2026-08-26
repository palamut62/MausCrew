// Pending approval, ported from the upstream pattern: an approval does
// not sit in the transcript waiting to be noticed — it takes over the
// composer. The prompt is disabled, a strip above it says exactly what
// is being asked, and the send row is replaced by the decisions.
//
// Faithful details worth keeping: one at a time with an "n of N" counter,
// the detail printed raw in a monospace block that is NEVER truncated
// (it scrolls instead), and the buttons ordered least-destructive-last so
// the primary action sits under your thumb.
import { memo } from "react";
import { useStore, type Bot, type Message } from "@/state/store";
import { cn } from "@/lib/cn";

export interface Pending {
  message: Message;
  requestId: string;
  tool: string;
  /** the narrow grant "always allow" writes, computed server-side */
  allowKey?: string;
  detail: string;
  held?: string;
}

/** Open approvals on a thread, oldest first — answered/dismissed drop out. */
/**
 * A plain question the bot is blocked on: it has a request waiting for a reply
 * but no tool, so there is nothing to allow or deny — only something to answer.
 *
 * These were invisible to the composer, which only ever looked for permission
 * cards. A question would render its options, the composer stayed open, and an
 * answer typed there went out as an ordinary message while the bot went on
 * waiting for a reply that never came.
 */
export function pendingQuestion(messages: Message[]): Message | undefined {
  return messages
    .filter(
      (m) =>
        m.kind === "options" && m.card?.requestId && !m.card.tool && !m.card.answered && !m.card.dismissed,
    )
    .at(-1);
}

export function pendingApprovals(messages: Message[]): Pending[] {
  return messages
    .filter((m) => m.kind === "options" && m.card?.requestId && m.card.tool && !m.card.answered && !m.card.dismissed)
    .map((m) => ({
      message: m,
      requestId: m.card!.requestId!,
      tool: m.card!.tool!,
      allowKey: m.card!.allowKey,
      detail: m.card!.subtitle,
      held: m.card!.held,
    }));
}

function label(tool: string): string {
  const nice: Record<string, string> = {
    Bash: "Command approval requested",
    shell: "Command approval requested",
    Read: "File-read approval requested",
    Write: "File-change approval requested",
    Edit: "File-change approval requested",
    edit: "File-change approval requested",
    cordis_run: "Dynamic plugin approval requested",
  };
  return nice[tool] ?? "Approval requested";
}

export const PendingApprovalPanel = memo(function PendingApprovalPanel({
  pending,
  count,
  index,
}: {
  pending: Pending;
  count: number;
  index: number;
}) {
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="rounded-t-2xl border-b border-hairline bg-raised/40 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-secondary">Pending approval</span>
        {count > 1 && (
          <span className="rounded-md bg-raised px-1.5 py-0.5 font-mono text-[11px] tabular-nums tracking-tight text-ink-secondary">
            {index + 1} of {count}
          </span>
        )}
        <span className="text-[13px] text-ink">{label(pending.tool)}</span>
        <span className="font-mono text-[11px] text-ink-secondary">{pending.tool}</span>
      </div>
      {/* never truncated — long commands wrap and scroll */}
      <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-ink">
        {pending.detail}
      </pre>
      {pending.held && <div className="mt-2 text-[12px] text-warning">{pending.held}</div>}
    </div>
  );
});

export function PendingApprovalActions({
  pending,
  threadId,
  bot,
  onCancelTurn,
}: {
  pending: Pending;
  threadId: string;
  /** who asked — "always allow" is remembered against them */
  bot?: Bot;
  onCancelTurn: () => void;
}) {
  const { state, dispatch } = useStore();
  const submitting = state.pendingDecisions[`${threadId}:${pending.requestId}`];
  const decide = (behavior: "allow" | "deny", always = false) => {
    if (submitting) return;
    dispatch({
      type: "decideRequest",
      threadId,
      requestId: pending.requestId,
      behavior,
      message: behavior === "deny" ? "Denied by the user." : undefined,
      alwaysAllow: always && bot && pending.allowKey ? { botId: bot.id, key: pending.allowKey } : undefined,
    });
  };

  const base = "rounded-md px-3.5 py-1.5 text-[13.5px] transition-colors disabled:cursor-wait disabled:opacity-55";
  return (
    <div role="group" aria-label={`Decide ${pending.tool} approval`} className="flex flex-wrap items-center justify-end gap-2 px-2 py-2">
      <button disabled={Boolean(submitting)} onClick={onCancelTurn} className={cn(base, "text-ink-secondary hover:bg-raised hover:text-ink")}>
        Cancel turn
      </button>
      <button
        disabled={Boolean(submitting)}
        onClick={() => decide("deny")}
        className={cn(base, "border border-danger/40 text-danger hover:bg-danger/10")}
      >
        {submitting === "deny" ? "Denying…" : "Deny"}
      </button>
      {bot && pending.allowKey && (
        <button
          disabled={Boolean(submitting)}
          onClick={() => decide("allow", true)}
          title={`Stop asking ${bot.name} about ${pending.allowKey}`}
          className={cn(base, "border border-hairline text-ink hover:bg-raised")}
        >
          {submitting === "always-allow" ? "Saving & allowing…" : "Always allow"}
        </button>
      )}
      <button
        disabled={Boolean(submitting)}
        onClick={() => decide("allow")}
        className={cn(base, "bg-accent font-medium text-app hover:brightness-110")}
      >
        {submitting === "allow" ? "Allowing…" : "Allow once"}
      </button>
    </div>
  );
}
