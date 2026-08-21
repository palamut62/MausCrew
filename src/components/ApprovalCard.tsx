// The approval box: what the bot wants to do, and three ways to answer.
//
// Deliberately not the lettered A/B/C list the onboarding card uses — an
// approval is a decision about one concrete action, so it shows the tool
// and the actual command/path in monospace, and the choices carry their
// own behavior instead of being matched by their label text.
import { Check, ShieldCheck, X } from "@phosphor-icons/react";
import { type Bot, type Message } from "@/state/store";
import { cn } from "@/lib/cn";

/** The tool's own name is noise to a human: mcp__mauscrew__computer_batch is
 * "computer batch", Bash is "run a command". */
function toolLabel(tool?: string): string {
  if (!tool) return "an action";
  const bare = tool.replace(/^mcp__[^_]+__/, "").replace(/_/g, " ");
  const nice: Record<string, string> = {
    Bash: "run a command",
    Read: "read a file",
    Write: "write a file",
    Edit: "edit a file",
    WebFetch: "fetch a web page",
    WebSearch: "search the web",
    cordis_run: "run a Dynamic Cordis plugin",
  };
  return nice[tool] ?? bare;
}

export function ApprovalCard({
  bot,
  message,
}: {
  /** who is asking, for the "Name wants to …" line */
  bot?: Bot;
  message: Message;
}) {
  const card = message.card;
  if (!card) return null;
  const settled = card.answered;

  return (
    <div
      className={cn(
        "w-full max-w-[840px] rounded-xl border bg-card p-4",
        settled ? "border-hairline opacity-70" : "border-accent/40",
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-[15px] font-semibold text-ink">
          {bot ? `${bot.name} wants to ` : "Wants to "}
          {toolLabel(card.tool)}
        </div>
        {card.tool && <span className="shrink-0 font-mono text-[11px] text-ink-secondary">{card.tool}</span>}
      </div>

      {/* what, exactly */}
      <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-inset px-3 py-2 font-mono text-[12.5px] leading-relaxed text-ink">
        {card.subtitle}
      </pre>

      {card.held && (
        <div className="mt-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-[12.5px] text-warning">
          {card.held}
        </div>
      )}

      {card.policy && (
        <div className="mt-2 grid grid-cols-3 gap-2 rounded-lg border border-hairline bg-inset px-3 py-2 text-[11px]">
          <div>
            <div className="uppercase tracking-wider text-ink-secondary">Risk</div>
            <div className="mt-0.5 capitalize text-ink">{card.policy.risk}</div>
          </div>
          <div>
            <div className="uppercase tracking-wider text-ink-secondary">Policy</div>
            <div className="mt-0.5 truncate font-mono text-ink" title={card.policy.ruleId}>{card.policy.ruleId}</div>
          </div>
          <div>
            <div className="uppercase tracking-wider text-ink-secondary">Decision</div>
            <div className="mt-0.5 font-semibold uppercase text-warning">{card.policy.decision}</div>
          </div>
        </div>
      )}

      {/* The decision lives in the composer (one place to answer, and it
          can't be scrolled past); here we only record what happened. */}
      <div className="mt-3 flex items-center gap-1.5 text-[13px] text-ink-secondary">
        {settled === "allow" ? (
          <>
            <Check size={14} weight="fill" className="text-success" /> Allowed
          </>
        ) : settled ? (
          <>
            <X size={14} weight="bold" /> Denied
          </>
        ) : (
          <>
            <ShieldCheck size={14} weight="bold" className="text-accent" /> Waiting for your answer below
          </>
        )}
      </div>
    </div>
  );
}
