export class SupervisorOrchestrator {
    taskService;
    scheduler;
    constructor(taskService, scheduler) {
        this.taskService = taskService;
        this.scheduler = scheduler;
    }
    materialize(projectId, plan, actorId = "supervisor") {
        if (!plan.intent.trim())
            throw new Error("Supervisor plan intent is required");
        const keys = new Set(plan.tasks.map((task) => task.key));
        if (keys.size !== plan.tasks.length || keys.has(""))
            throw new Error("Supervisor task keys must be unique and non-empty");
        for (const task of plan.tasks) {
            for (const dependency of task.dependsOn ?? [])
                if (!keys.has(dependency))
                    throw new Error(`Unknown supervisor dependency: ${dependency}`);
        }
        return this.taskService.createGraph(plan.tasks.map((task) => ({
            id: `${projectId}:${task.key}`,
            projectId,
            title: task.title,
            description: task.description,
            role: task.role,
            priority: task.priority,
            createdBy: actorId,
            dependsOn: task.dependsOn?.map((key) => `${projectId}:${key}`),
        })), { type: "system", id: actorId });
    }
    dispatchReady(projectId) { return this.scheduler.schedule(projectId); }
    recoverStalled(projectId, staleBefore) {
        return this.taskService.tasks.list(projectId)
            .filter((task) => (task.status === "assigned" || task.status === "running") && task.updatedAt < staleBefore)
            .map((task) => this.taskService.block(task.id, "Agent progress stalled", { type: "system", id: "supervisor" }));
    }
}
