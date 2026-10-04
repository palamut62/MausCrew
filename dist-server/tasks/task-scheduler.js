export class TaskScheduler {
    tasks;
    identities;
    service;
    maxConcurrentAgents;
    constructor(tasks, identities, service, options = {}) {
        this.tasks = tasks;
        this.identities = identities;
        this.service = service;
        this.maxConcurrentAgents = options.maxConcurrentAgents ?? 4;
        if (!Number.isInteger(this.maxConcurrentAgents) || this.maxConcurrentAgents < 1)
            throw new Error("maxConcurrentAgents must be at least 1");
        this.selectAgent = options.selectAgent ?? ((task, agents) => agents.find((agent) => agent.role.toLowerCase() === task.role.toLowerCase()));
    }
    selectAgent;
    schedule(projectId) {
        this.tasks.refreshReady(projectId);
        const capacity = Math.max(0, this.maxConcurrentAgents - this.tasks.countActive(projectId));
        if (!capacity)
            return [];
        const busy = new Set(this.tasks.list(projectId).filter((task) => task.status === "assigned" || task.status === "running").map((task) => task.assigneeAgentId));
        const agents = this.#agents().filter((agent) => !busy.has(agent.id));
        const assigned = [];
        for (const task of this.tasks.ready(projectId, capacity)) {
            const agent = this.selectAgent(task, agents);
            if (!agent)
                continue;
            assigned.push(this.service.assign(task.id, agent.id, { type: "system", id: "supervisor" }));
            agents.splice(agents.indexOf(agent), 1);
        }
        return assigned;
    }
    #agents() {
        const rows = this.identities.database.db.prepare("SELECT id, role FROM agents WHERE status IN ('idle', 'offline', 'completed') ORDER BY created_at, id").all();
        return rows.map((row) => ({ id: row.id, role: row.role }));
    }
}
