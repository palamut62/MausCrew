import { CaretRight, Check, Clock, WarningCircle, X } from "@phosphor-icons/react";

import { cn } from "@/lib/cn";
import { useStore, type Workflow } from "@/state/store";
import { Spin } from "./Spin";

const WORKFLOW_STATUS_LABEL: Record<Workflow["status"], string> = {
  active: "Active",
  blocked: "Blocked",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

function StepStatusIcon({ status }: { status: Workflow["steps"][number]["status"] }) {
  switch (status) {
    case "running":
      return <Spin size={14} className="text-accent" />;
    case "done":
      return <Check size={14} weight="bold" className="text-success" />;
    case "failed":
      return <X size={14} weight="bold" className="text-danger" />;
    case "blocked":
      return <WarningCircle size={14} weight="bold" className="text-warning" />;
    default:
      return <Clock size={14} className="text-ink-secondary" />;
  }
}

function WorkflowStatusBadge({ status }: { status: Workflow["status"] }) {
  return (
    <span
      className={cn(
        "rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wide",
        status === "completed" && "bg-success/15 text-success",
        status === "failed" && "bg-danger/15 text-danger",
        status === "cancelled" && "bg-inset text-ink-secondary",
        status === "blocked" && "bg-warning/15 text-warning",
        status === "active" && "bg-accent/15 text-accent",
      )}
    >
      {WORKFLOW_STATUS_LABEL[status]}
    </span>
  );
}

function WorkflowCard({ workflow }: { workflow: Workflow }) {
  const { state, dispatch } = useStore();
  const project = workflow.projectId ? state.projects.find((p) => p.id === workflow.projectId) : undefined;
  const owner = state.bots.find((b) => b.id === workflow.ownerBotId);
  const stepById = new Map(workflow.steps.map((step) => [step.id, step]));

  return (
    <article className="overflow-hidden rounded-xl border border-hairline bg-panel">
      <div className="flex items-start gap-3 border-b border-hairline px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-medium text-ink">{workflow.title}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-ink-secondary">
            {owner && <span>Chief: {owner.name}</span>}
            {project && <span>Project: {project.name}</span>}
          </div>
        </div>
        <WorkflowStatusBadge status={workflow.status} />
        {/* A plan the team has moved past still shows as live work and still
            accepts step updates. Cancelling closes it without pretending the
            unfinished stages were done. */}
        {(workflow.status === "active" || workflow.status === "blocked") && (
          <button
            onClick={() => dispatch({ type: "cancelWorkflow", workflowId: workflow.id })}
            className="shrink-0 rounded-lg border border-hairline px-2.5 py-1 text-[11.5px] font-medium text-ink-secondary hover:bg-raised hover:text-ink"
          >
            Cancel
          </button>
        )}
      </div>
      <div className="divide-y divide-hairline/70">
        {workflow.steps.map((step) => {
          const assignee = step.assigneeBotId ? state.bots.find((b) => b.id === step.assigneeBotId) : undefined;
          const deps = step.dependsOn.map((id) => stepById.get(id)?.title ?? id);
          return (
            <div key={step.id} className="flex items-start gap-3 px-4 py-3">
              <div className="mt-0.5">
                <StepStatusIcon status={step.status} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-[13px] font-medium text-ink">{step.title}</span>
                  {assignee && <span className="text-[11.5px] text-ink-secondary">→ {assignee.name}</span>}
                </div>
                {deps.length > 0 && (
                  <div className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-secondary">
                    <CaretRight size={10} weight="bold" />
                    <span>after {deps.join(", ")}</span>
                  </div>
                )}
                {step.output && (
                  <div className="mt-1 whitespace-pre-wrap rounded-lg bg-inset px-2.5 py-1.5 text-[12px] leading-relaxed text-ink-secondary">
                    {step.output}
                  </div>
                )}
              </div>
              <span className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-ink-secondary">{step.status}</span>
            </div>
          );
        })}
      </div>
    </article>
  );
}

export function WorkflowsPage() {
  const { state } = useStore();
  const active = state.workflows.filter((w) => w.status === "active" || w.status === "blocked");
  const history = state.workflows.filter((w) => w.status !== "active" && w.status !== "blocked");

  return (
    <main className="min-w-0 flex-1 overflow-y-auto bg-app px-5 py-6 md:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <h1 className="text-[22px] font-semibold tracking-tight text-ink">Workflows</h1>
          <p className="mt-1 text-[13px] text-ink-secondary">
            Multi-stage team plans a Chief of Staff bot set up to coordinate the rest of the team, with each step's
            dependency and status.
          </p>
        </div>
        {!active.length && !history.length ? (
          <div className="rounded-xl border border-hairline bg-panel px-5 py-10 text-center text-[13px] text-ink-secondary">
            No workflows yet. A Chief of Staff bot creates one when it plans multi-step work across the team.
          </div>
        ) : (
          <>
            {active.length > 0 && (
              <div className="space-y-3">
                {active.map((workflow) => (
                  <WorkflowCard key={workflow.id} workflow={workflow} />
                ))}
              </div>
            )}
            {history.length > 0 && (
              <section className={active.length > 0 ? "mt-8" : undefined}>
                <h2 className="mb-3 text-[12px] font-medium uppercase tracking-[0.12em] text-ink-secondary">History</h2>
                <div className="space-y-3">
                  {history.map((workflow) => (
                    <WorkflowCard key={workflow.id} workflow={workflow} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
