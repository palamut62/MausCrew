import { createCrewEvent } from "../crew-core/events.js";
import { CancellationScope } from "../runtime/cancellation.js";
import { parseWorkflowDefinition } from "./definition.js";
export class WorkflowEngine {
    database;
    store;
    approvals;
    events;
    audit;
    bus;
    executeAgentStep;
    maxConcurrency;
    #cancellations = new Map();
    #executions = new Map();
    constructor(database, store, approvals, events, audit, bus, executeAgentStep, options = {}) {
        this.database = database;
        this.store = store;
        this.approvals = approvals;
        this.events = events;
        this.audit = audit;
        this.bus = bus;
        this.executeAgentStep = executeAgentStep;
        this.maxConcurrency = options.maxConcurrency ?? 4;
        if (!Number.isInteger(this.maxConcurrency) || this.maxConcurrency < 1)
            throw new Error("Workflow maxConcurrency must be at least 1");
    }
    define(input) { const definition = parseWorkflowDefinition(input); this.store.saveDefinition(definition); return definition; }
    start(definitionId, ownerAgentId) { const definition = this.store.getDefinition(definitionId); if (!definition)
        throw new Error(`Unknown workflow definition: ${definitionId}`); return this.store.createRun(definition, ownerAgentId); }
    execute(runId) {
        const active = this.#executions.get(runId);
        if (active)
            return active;
        const execution = this.#execute(runId).finally(() => { if (this.#executions.get(runId) === execution)
            this.#executions.delete(runId); });
        this.#executions.set(runId, execution);
        return execution;
    }
    async #execute(runId) {
        let run = this.#required(runId);
        if (["completed", "failed", "cancelled"].includes(run.status))
            return run;
        const scope = this.#cancellations.get(runId) ?? new CancellationScope();
        this.#cancellations.set(runId, scope);
        if (run.status === "queued")
            run = this.#setRun(run, "running", "workflow.started");
        else {
            this.store.recoverInterrupted(runId);
            run = this.store.setRun(runId, "running");
        }
        try {
            while (!scope.signal.aborted) {
                const approvalResult = this.#settleApprovals(run);
                if (approvalResult)
                    return approvalResult;
                this.store.refreshReady(runId);
                const ready = this.store.ready(runId);
                if (!ready.length) {
                    const steps = this.store.steps(runId);
                    if (steps.every((step) => step.status === "completed"))
                        return this.#setRun(this.#required(runId), "completed", "workflow.completed");
                    if (steps.some((step) => step.status === "waiting_approval"))
                        return this.store.setRun(runId, "waiting_approval");
                    return this.#fail(this.#required(runId), "Workflow has no executable step");
                }
                for (let offset = 0; offset < ready.length && !scope.signal.aborted; offset += this.maxConcurrency)
                    await Promise.all(ready.slice(offset, offset + this.maxConcurrency).map((step) => this.#executeStep(this.#required(runId), step, scope)));
                run = this.#required(runId);
                if (run.status === "failed" || run.status === "cancelled")
                    return run;
            }
            return this.#required(runId);
        }
        finally {
            if (["completed", "failed", "cancelled"].includes(this.#required(runId).status)) {
                scope.dispose();
                this.#cancellations.delete(runId);
            }
        }
    }
    async resume(runId) { return this.execute(runId); }
    cancel(runId) {
        const run = this.#required(runId);
        if (["completed", "failed", "cancelled"].includes(run.status))
            return run;
        this.#cancellations.get(runId)?.cancel(new Error("Workflow cancelled"));
        for (const step of this.store.steps(runId))
            if (step.status === "waiting_approval" && step.approvalId && this.approvals.get(step.approvalId)?.status === "pending")
                this.approvals.cancelPending(step.approvalId, "Workflow cancelled");
        this.store.cancelSteps(runId);
        return this.#setRun(run, "cancelled", "workflow.cancelled");
    }
    async #executeStep(run, step, scope) {
        if (step.kind === "approval") {
            const approval = this.approvals.request({ projectId: run.projectId, agentId: run.ownerAgentId, taskId: step.id, action: "workflow.approval", arguments: { runId: run.id, stepKey: step.key }, reason: `Workflow ${run.definitionId} requires human approval` });
            this.store.setStep(step.id, ["ready"], "waiting_approval", { approvalId: approval.id });
            return;
        }
        this.store.setStep(step.id, ["ready"], "running");
        try {
            const output = await this.executeAgentStep(step, { run, signal: scope.signal });
            if (scope.signal.aborted || this.#required(run.id).status === "cancelled")
                return;
            this.store.setStep(step.id, ["running"], "completed", { output });
        }
        catch (error) {
            if (scope.signal.aborted || this.#required(run.id).status === "cancelled")
                return;
            const message = error instanceof Error ? error.message : String(error);
            this.store.setStep(step.id, ["running"], "failed", { error: message });
            this.#fail(this.#required(run.id), message);
        }
    }
    #settleApprovals(run) {
        for (const step of this.store.steps(run.id).filter((item) => item.status === "waiting_approval" && item.approvalId)) {
            const approval = this.approvals.get(step.approvalId);
            if (approval?.status === "approved")
                this.store.setStep(step.id, ["waiting_approval"], "completed", { output: { approvalId: approval.id, decidedBy: approval.decidedBy } });
            else if (approval && (approval.status === "rejected" || approval.status === "changes_requested")) {
                this.store.setStep(step.id, ["waiting_approval"], "failed", { error: approval.reason ?? approval.status });
                return this.#fail(run, approval.reason ?? approval.status);
            }
        }
        return undefined;
    }
    #fail(run, error) { const current = this.#required(run.id); return current.status === "failed" ? current : this.#setRun(current, "failed", "workflow.failed", error); }
    #setRun(run, status, type, error) {
        let updated;
        const event = createCrewEvent({ type, projectId: run.projectId, actor: { type: "system", id: "workflow-engine" }, payload: { workflowRunId: run.id, definitionId: run.definitionId, status, ...(error ? { error } : {}) }, correlationId: run.id });
        this.database.transaction(() => { updated = this.store.setRun(run.id, status, { error }); this.events.append(event); this.audit.append({ projectId: run.projectId, actorId: "workflow-engine", actorType: "system", action: type, target: run.id, metadata: event.payload, createdAt: event.createdAt }); });
        this.bus.publish(event);
        return updated;
    }
    #required(id) { const run = this.store.getRun(id); if (!run)
        throw new Error(`Unknown workflow run: ${id}`); return run; }
}
