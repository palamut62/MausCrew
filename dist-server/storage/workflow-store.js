import { randomUUID } from "node:crypto";
export class WorkflowStore {
    database;
    constructor(database) {
        this.database = database;
    }
    saveDefinition(definition) {
        this.database.db.prepare(`INSERT INTO workflow_definitions(id, project_id, name, trigger_type, yaml, definition_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(definition.id, definition.projectId, definition.name, definition.triggerType, definition.yaml, JSON.stringify(definition), definition.createdAt, definition.updatedAt);
    }
    getDefinition(id) { const row = this.database.db.prepare("SELECT definition_json FROM workflow_definitions WHERE id = ?").get(id); return row ? JSON.parse(row.definition_json) : undefined; }
    createRun(definition, ownerAgentId, createdAt = new Date().toISOString()) {
        const run = { id: randomUUID(), definitionId: definition.id, projectId: definition.projectId, ownerAgentId, status: "queued", createdAt, updatedAt: createdAt };
        this.database.transaction(() => {
            this.database.db.prepare("INSERT INTO workflow_runs(id, definition_id, project_id, owner_agent_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'queued', ?, ?)").run(run.id, run.definitionId, run.projectId, ownerAgentId, createdAt, createdAt);
            const insert = this.database.db.prepare(`INSERT INTO workflow_steps(id, run_id, step_key, kind, agent_role, task, status, depends_on_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`);
            for (const step of definition.steps)
                insert.run(randomUUID(), run.id, step.key, step.kind, step.kind === "agent" ? step.agent : null, step.kind === "agent" ? step.task : null, JSON.stringify(step.dependsOn), createdAt, createdAt);
            this.refreshReady(run.id, createdAt);
        });
        return this.getRun(run.id);
    }
    getRun(id) { const row = this.database.db.prepare("SELECT * FROM workflow_runs WHERE id = ?").get(id); return row ? this.#run(row) : undefined; }
    steps(runId) { return this.database.db.prepare("SELECT * FROM workflow_steps WHERE run_id = ? ORDER BY created_at, rowid").all(runId).map((row) => this.#step(row)); }
    ready(runId) { return this.database.db.prepare("SELECT * FROM workflow_steps WHERE run_id = ? AND status = 'ready' ORDER BY created_at, rowid").all(runId).map((row) => this.#step(row)); }
    refreshReady(runId, updatedAt = new Date().toISOString()) {
        const completed = new Set(this.steps(runId).filter((step) => step.status === "completed").map((step) => step.key));
        for (const step of this.steps(runId).filter((item) => item.status === "pending" && item.dependsOn.every((key) => completed.has(key))))
            this.setStep(step.id, ["pending"], "ready", { updatedAt });
    }
    setRun(id, status, input = {}) {
        const now = input.updatedAt ?? new Date().toISOString();
        const terminal = ["completed", "failed", "cancelled"].includes(status);
        const result = this.database.db.prepare("UPDATE workflow_runs SET status = ?, error = ?, updated_at = ?, completed_at = CASE WHEN ? THEN ? ELSE completed_at END WHERE id = ?").run(status, input.error ?? null, now, terminal ? 1 : 0, now, id);
        if (Number(result.changes) !== 1)
            throw new Error(`Unknown workflow run: ${id}`);
        return this.getRun(id);
    }
    setStep(id, from, status, input = {}) {
        const now = input.updatedAt ?? new Date().toISOString();
        const marks = from.map(() => "?").join(",");
        const result = this.database.db.prepare(`UPDATE workflow_steps SET status = ?, approval_id = COALESCE(?, approval_id), output_json = ?, error = ?, updated_at = ? WHERE id = ? AND status IN (${marks})`)
            .run(status, input.approvalId ?? null, input.output === undefined ? null : JSON.stringify(input.output), input.error ?? null, now, id, ...from);
        if (Number(result.changes) !== 1)
            throw new Error(`Invalid workflow step transition: ${id} -> ${status}`);
        return this.#step(this.database.db.prepare("SELECT * FROM workflow_steps WHERE id = ?").get(id));
    }
    recoverInterrupted(runId) { return Number(this.database.db.prepare("UPDATE workflow_steps SET status = 'ready', updated_at = ? WHERE run_id = ? AND status = 'running'").run(new Date().toISOString(), runId).changes); }
    cancelSteps(runId) { this.database.db.prepare("UPDATE workflow_steps SET status = 'cancelled', updated_at = ? WHERE run_id = ? AND status IN ('pending','ready','running','waiting_approval')").run(new Date().toISOString(), runId); }
    #run(row) { return { id: row.id, definitionId: row.definition_id, projectId: row.project_id, ownerAgentId: row.owner_agent_id, status: row.status, ...(row.error ? { error: row.error } : {}), createdAt: row.created_at, updatedAt: row.updated_at, ...(row.completed_at ? { completedAt: row.completed_at } : {}) }; }
    #step(row) { return { id: row.id, runId: row.run_id, key: row.step_key, kind: row.kind, ...(row.agent_role ? { agentRole: row.agent_role } : {}), ...(row.task ? { task: row.task } : {}), status: row.status, dependsOn: JSON.parse(row.depends_on_json), ...(row.approval_id ? { approvalId: row.approval_id } : {}), ...(row.output_json ? { output: JSON.parse(row.output_json) } : {}), ...(row.error ? { error: row.error } : {}), createdAt: row.created_at, updatedAt: row.updated_at }; }
}
