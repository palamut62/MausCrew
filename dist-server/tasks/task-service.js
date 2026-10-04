import { createCrewEvent } from "../crew-core/events.js";
import { createTask } from "./task.js";
export class TaskService {
    database;
    tasks;
    events;
    audit;
    bus;
    constructor(database, tasks, events, audit, bus) {
        this.database = database;
        this.tasks = tasks;
        this.events = events;
        this.audit = audit;
        this.bus = bus;
    }
    createGraph(items, actor) {
        const created = items.map(createTask);
        const ids = new Set(created.map((task) => task.id));
        if (ids.size !== created.length)
            throw new Error("Task graph contains duplicate ids");
        const emitted = [];
        this.database.transaction(() => {
            for (const task of created) {
                this.tasks.create(task);
                emitted.push(this.#record("task.created", task, actor, task.id, { task }));
            }
            items.forEach((item, index) => {
                for (const dependencyId of item.dependsOn ?? []) {
                    if (!ids.has(dependencyId) && !this.tasks.get(dependencyId))
                        throw new Error(`Unknown task dependency: ${dependencyId}`);
                    this.tasks.addDependency(created[index].projectId, created[index].id, dependencyId, created[index].createdAt);
                    emitted.push(this.#record("task.dependency_added", created[index], actor, created[index].id, { taskId: created[index].id, dependsOnTaskId: dependencyId }));
                }
            });
            for (const projectId of new Set(created.map((task) => task.projectId)))
                this.tasks.refreshReady(projectId);
        });
        emitted.forEach((event) => this.bus.publish(event));
        return created.map((task) => this.tasks.get(task.id));
    }
    assign(taskId, agentId, actor) {
        return this.#transition(taskId, ["ready"], "assigned", "task.assigned", actor, { assigneeAgentId: agentId });
    }
    start(taskId, actor) {
        return this.#transition(taskId, ["assigned"], "running", "task.started", actor);
    }
    complete(taskId, actor) {
        const task = this.#transition(taskId, ["running", "assigned"], "completed", "task.completed", actor);
        const emitted = [];
        this.database.transaction(() => {
            this.tasks.refreshReady(task.projectId);
            emitted.push(this.#record("dependency.completed", task, actor, task.id, { taskId }));
        });
        emitted.forEach((event) => this.bus.publish(event));
        return task;
    }
    fail(taskId, error, actor) {
        return this.#transition(taskId, ["assigned", "running", "blocked"], "failed", "task.failed", actor, { error });
    }
    block(taskId, reason, actor) {
        return this.#transition(taskId, ["assigned", "running"], "blocked", "task.blocked", actor, { error: reason });
    }
    cancel(taskId, actor) {
        return this.#transition(taskId, ["pending", "ready", "assigned", "running", "blocked"], "cancelled", "task.cancelled", actor);
    }
    #transition(taskId, from, to, type, actor, extra = {}) {
        const before = this.tasks.get(taskId);
        if (!before)
            throw new Error(`Unknown task: ${taskId}`);
        let task;
        let event;
        this.database.transaction(() => {
            task = this.tasks.transition(taskId, from, to, extra);
            event = this.#record(type, task, actor, taskId, { taskId, status: to, ...(extra.assigneeAgentId ? { agentId: extra.assigneeAgentId, assigneeAgentId: extra.assigneeAgentId } : {}), ...(extra.error ? { error: extra.error } : {}) });
        });
        this.bus.publish(event);
        return task;
    }
    #record(type, task, actor, correlationId, payload) {
        const event = createCrewEvent({ type, projectId: task.projectId, actor, payload, correlationId });
        this.events.append(event);
        this.audit.append({ projectId: task.projectId, actorId: actor.id, actorType: actor.type, action: type, target: task.id, metadata: payload, createdAt: event.createdAt });
        return event;
    }
}
