import { ArrowClockwise, Check, Clock, PaperPlaneTilt, Trash, X } from "@phosphor-icons/react";

import { cn } from "@/lib/cn";
import { useStore } from "@/state/store";
import { Spin } from "./Spin";

export function ReviewQueuePage() {
  const { state, dispatch } = useStore();
  const pending = state.reviews.filter((item) => item.status === "pending" || item.status === "sending");
  const history = state.reviews.filter((item) => item.status !== "pending" && item.status !== "sending");

  return (
    <main className="min-w-0 flex-1 overflow-y-auto bg-app px-5 py-6 md:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <h1 className="text-[22px] font-semibold tracking-tight text-ink">Review queue</h1>
          <p className="mt-1 text-[13px] text-ink-secondary">Inspect Chief MAUS's outbound drafts and selectively approve only what should be sent.</p>
        </div>
        {!pending.length ? (
          <div className="rounded-xl border border-hairline bg-panel px-5 py-10 text-center text-[13px] text-ink-secondary">
            No outbound work is waiting for review.
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((item) => (
              <article key={item.id} className="overflow-hidden rounded-xl border border-hairline bg-panel">
                <div className="flex items-start gap-3 border-b border-hairline px-4 py-3">
                  {item.status === "sending" ? <Spin size={16} className="mt-0.5 text-accent" /> : <Clock size={16} className="mt-0.5 text-warning" />}
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-medium text-ink">{item.title}</div>
                    <div className="mt-0.5 text-[11.5px] text-ink-secondary">To {item.target}</div>
                  </div>
                  <span className="rounded-md bg-inset px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-ink-secondary">{item.status}</span>
                </div>
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap px-4 py-3 font-sans text-[13px] leading-relaxed text-ink">{item.content}</pre>
                {item.status === "pending" && (
                  <div className="flex justify-end gap-2 border-t border-hairline px-4 py-3">
                    <button onClick={() => dispatch({ type: "reviewAction", itemId: item.id, action: "dismiss" })} className="rounded-lg border border-hairline px-3 py-2 text-[12px] font-medium text-ink-secondary hover:bg-raised hover:text-ink">
                      Dismiss
                    </button>
                    <button onClick={() => dispatch({ type: "reviewAction", itemId: item.id, action: "approve" })} className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-[12px] font-semibold text-app hover:brightness-110">
                      <PaperPlaneTilt size={14} weight="fill" /> Approve and send
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
        {history.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-[12px] font-medium uppercase tracking-[0.12em] text-ink-secondary">History</h2>
            <div className="space-y-2">
              {history.map((item) => (
                <div key={item.id} className="flex items-start gap-3 rounded-xl border border-hairline bg-panel px-4 py-3">
                  {item.status === "sent" ? <Check size={16} className="mt-0.5 text-success" /> : <X size={16} className={cn("mt-0.5", item.status === "failed" ? "text-danger" : "text-ink-secondary")} />}
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium text-ink">{item.title}</div>
                    <div className="mt-0.5 whitespace-pre-wrap text-[11.5px] text-ink-secondary">{item.target}{item.result ? ` - ${item.result}` : ""}</div>
                  </div>
                  {/* A send that never happened is still an approved draft, so the
                      way back is one click rather than writing it again. */}
                  {item.status === "failed" && (
                    <button
                      onClick={() => dispatch({ type: "reviewAction", itemId: item.id, action: "approve" })}
                      title="Send this again"
                      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-hairline px-2.5 py-1.5 text-[11.5px] font-medium text-ink hover:bg-raised"
                    >
                      <ArrowClockwise size={13} weight="bold" /> Retry
                    </button>
                  )}
                  <span className="mt-1 font-mono text-[10px] uppercase tracking-wide text-ink-secondary">{item.status}</span>
                  <button
                    onClick={() => dispatch({ type: "deleteReview", itemId: item.id })}
                    title="Remove from history"
                    className="mt-0.5 shrink-0 rounded-md p-1 text-ink-secondary hover:bg-raised hover:text-danger"
                  >
                    <Trash size={14} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
