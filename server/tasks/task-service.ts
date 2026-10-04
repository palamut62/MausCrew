import type { SqliteAuditStore } from "../audit/sqlite-audit-store.ts";
import type { CrewEventBus } from "../crew-core/event-bus.ts";
import { createCrewEvent, type CrewActorType, type CrewEvent, type CrewEventType } from "../crew-core/events.ts";
import type { CrewDatabase } from "../storage/crew-database.ts";
import type { CrewEventStore } from "../storage/event-store.ts";
import type { TaskStore } from "../storage/task-store.ts";
import { createTask, type CrewTask, type TaskDraft, type TaskStatus } from "./task.ts";

export interface TaskActor { type: CrewActorType; id: string }
export interface TaskPlanItem extends TaskDraft { dependsOn?: string[] }

export class TaskService {
  constructor(
    readonly database: CrewDatabase,
    readonly tasks: TaskStore,
    readonly events: CrewEventStore,
    readonly audit: SqliteAuditStore,
    readonly bus: CrewEventBus,
  ) {}

  createGraph(items: TaskPlanItem[], actor: TaskActor): CrewTask[] {
    const created = items.map(createTask);
    const ids = new Set(created.map((task) => task.id));
    if (ids.size !== created.length) throw new Error("Task graph contains duplicate ids");
    const emitted: CrewEvent[] = [];
    this.database.transaction(() => {
      for (const task of created) {
        this.tasks.create(task);
        emitted.push(this.#record("task.created", task, actor, task.id, { task }));
      }
      items.forEach((item, index) => {
        for (const dependencyId of item.dependsOn ?? []) {
          if (!ids.has(dependencyId) && !this.tasks.get(dependencyId)) throw new Error(`Unknown task dependency: ${dependencyId}`);
          this.tasks.addDependency(created[index].projectId, created[index].id, dependencyId, created[index].createdAt);
          emitted.push(this.#record("task.dependency_added", created[index], actor, created[index].id, { taskId: created[index].id, dependsOnTaskId: dependencyId }));
        }
      });
      for (const projectId of new Set(created.map((task) => task.projectId))) this.tasks.refreshReady(projectId);
    });
    emitted.forEach((event) => this.bus.publish(event));
    return created.map((task) => this.tasks.get(task.id)!);
  }

  assign(taskId: string, agentId: string, actor: TaskActor): CrewTask {
    return this.#transition(taskId, ["ready"], "assigned", "task.assigned", actor, { assigneeAgentId: agentId });
  }

  start(taskId: string, actor: TaskActor): CrewTask {
    return this.#transition(taskId, ["assigned"], "running", "task.started", actor);
  }

  complete(taskId: string, actor: TaskActor): CrewTask {
    const task = this.#transition(taskId, ["running", "assigned"], "completed", "task.completed", actor);
    const emitted: CrewEvent[] = [];
    this.database.transaction(() => {
      this.tasks.refreshReady(task.projectId);
      emitted.push(this.#record("dependency.completed", task, actor, task.id, { taskId }));
    });
    emitted.forEach((event) => this.bus.publish(event));
    return task;
  }

  fail(taskId: string, error: string, actor: TaskActor): CrewTask {
    return this.#transition(taskId, ["assigned", "running", "blocked"], "failed", "task.failed", actor, { error });
  }

  block(taskId: string, reason: string, actor: TaskActor): CrewTask {
    return this.#transition(taskId, ["assigned", "running"], "blocked", "task.blocked", actor, { error: reason });
  }

  cancel(taskId: string, actor: TaskActor): CrewTask {
    return this.#transition(taskId, ["pending", "ready", "assigned", "running", "blocked"], "cancelled", "task.cancelled", actor);
  }

  #transition(taskId: string, from: TaskStatus[], to: TaskStatus, type: CrewEventType, actor: TaskActor, extra: { assigneeAgentId?: string; error?: string } = {}): CrewTask {
    const before = this.tasks.get(taskId);
    if (!before) throw new Error(`Unknown task: ${taskId}`);
    let task!: CrewTask;
    let event!: CrewEvent;
    this.database.transaction(() => {
      task = this.tasks.transition(taskId, from, to, extra);
      event = this.#record(type, task, actor, taskId, { taskId, status: to, ...(extra.assigneeAgentId ? { agentId: extra.assigneeAgentId, assigneeAgentId: extra.assigneeAgentId } : {}), ...(extra.error ? { error: extra.error } : {}) });
    });
    this.bus.publish(event);
    return task;
  }

  #record(type: CrewEventType, task: CrewTask, actor: TaskActor, correlationId: string, payload: unknown): CrewEvent {
    const event = createCrewEvent({ type, projectId: task.projectId, actor, payload, correlationId });
    this.events.append(event);
    this.audit.append({ projectId: task.projectId, actorId: actor.id, actorType: actor.type, action: type, target: task.id, metadata: payload as Record<string, unknown>, createdAt: event.createdAt });
    return event;
  }
}
