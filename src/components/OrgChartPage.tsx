// Org chart — the crew as a structure, drawn from work that actually happened.
//
// Reporting lines are derived, never configured (see lib/org-chart.ts): a
// Chief of Staff sits at the root, the specialists it handed stages to sit
// under it, and every bot no live workflow touches keeps its place in a
// roster strip below. Clicking anyone opens their chat, so the chart is a way
// into the conversation rather than a diagram beside it.
import { useState } from "react";
import { Crown, UsersThree } from "@phosphor-icons/react";

import { cn } from "@/lib/cn";
import { buildOrgChart, type OrgNode } from "@/lib/org-chart";
import { useStore } from "@/state/store";
import { MausAvatar } from "./Avatar";

function StatusDot({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "size-1.5 shrink-0 rounded-full",
        status === "running" && "bg-accent",
        status === "done" && "bg-success",
        status === "failed" && "bg-danger",
        status === "blocked" && "bg-warning",
        status === "pending" && "bg-ink-secondary/40",
      )}
    />
  );
}

function OrgCard({ node, onOpen }: { node: OrgNode; onOpen: (botId: string) => void }) {
  const { bot, assignments } = node;
  return (
    <button
      onClick={() => onOpen(bot.id)}
      className="w-full max-w-[260px] rounded-xl border border-hairline bg-panel px-3 py-2.5 text-left transition-colors hover:border-accent/40"
    >
      <div className="flex items-center gap-2.5">
        <MausAvatar color={bot.color} name={bot.name} size={30} paused />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 truncate text-[13px] font-medium text-ink">
            {bot.chiefOfStaff && <Crown size={12} weight="fill" className="shrink-0 text-accent" />}
            {bot.name}
          </div>
          {bot.title && <div className="truncate text-[11px] text-ink-secondary">{bot.title}</div>}
        </div>
      </div>
      {assignments.length > 0 && (
        <div className="mt-2 space-y-1 border-t border-hairline/70 pt-2">
          {assignments.slice(0, 4).map((assignment) => (
            <div key={`${assignment.workflowId}:${assignment.step}`} className="flex items-center gap-1.5 text-[11px] text-ink-secondary">
              <StatusDot status={assignment.status} />
              <span className="truncate">{assignment.step}</span>
            </div>
          ))}
          {assignments.length > 4 && (
            <div className="text-[10.5px] text-ink-secondary">+{assignments.length - 4} more</div>
          )}
        </div>
      )}
    </button>
  );
}

function OrgBranch({ node, onOpen }: { node: OrgNode; onOpen: (botId: string) => void }) {
  return (
    <div className="flex flex-col items-start">
      <OrgCard node={node} onOpen={onOpen} />
      {node.reports.length > 0 && (
        // The rail is drawn on the container rather than per child so the
        // line stops at the last report instead of running past it.
        <div className="ml-[15px] flex flex-col gap-3 border-l border-hairline pl-5 pt-3">
          {node.reports.map((report) => (
            <div key={report.bot.id} className="relative">
              <span aria-hidden className="absolute -left-5 top-[22px] h-px w-5 bg-hairline" />
              <OrgBranch node={report} onOpen={onOpen} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function OrgChartPage() {
  const { state, dispatch } = useStore();
  const [includeFinished, setIncludeFinished] = useState(false);
  const chart = buildOrgChart(state.bots, state.workflows, includeFinished);
  const open = (botId: string) => dispatch({ type: "select", id: botId });

  return (
    <main className="min-w-0 flex-1 overflow-y-auto bg-app px-5 py-6 md:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-[22px] font-semibold tracking-tight text-ink">Org chart</h1>
            <p className="mt-1 text-[13px] text-ink-secondary">
              Who reports to whom, derived from the workflow stages a Chief of Staff actually assigned. Nothing here is
              configured — delegate a stage and the line appears.
            </p>
          </div>
          <button
            onClick={() => setIncludeFinished((current) => !current)}
            className={cn(
              "shrink-0 rounded-lg border px-2.5 py-1.5 text-[11.5px]",
              includeFinished ? "border-accent/40 bg-accent/10 text-accent" : "border-hairline text-ink-secondary hover:text-ink",
            )}
          >
            {includeFinished ? "Live and finished" : "Live only"}
          </button>
        </div>

        {chart.roots.length === 0 ? (
          <div className="rounded-xl border border-hairline bg-panel px-5 py-10 text-center text-[13px] text-ink-secondary">
            No reporting lines yet. Mark a bot as Chief of Staff in its settings and give it work that spans the team —
            the stages it assigns draw this chart.
          </div>
        ) : (
          <div className="space-y-6">
            {chart.roots.map((root) => (
              <OrgBranch key={root.bot.id} node={root} onOpen={open} />
            ))}
          </div>
        )}

        {chart.unassigned.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-[0.12em] text-ink-secondary">
              <UsersThree size={14} /> Not in a workflow
            </h2>
            <div className="flex flex-wrap gap-2">
              {chart.unassigned.map((bot) => (
                <button
                  key={bot.id}
                  onClick={() => open(bot.id)}
                  className="flex items-center gap-2 rounded-lg border border-hairline bg-panel px-2.5 py-1.5 text-[12px] text-ink hover:border-accent/40"
                >
                  <MausAvatar color={bot.color} name={bot.name} size={20} paused />
                  {bot.name}
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
