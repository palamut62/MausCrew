import type { InboxPriority } from "../runtime/agent-inbox.ts";
import type { CrewTask } from "../tasks/task.ts";
import type { TaskScheduler } from "../tasks/task-scheduler.ts";
import type { TaskService } from "../tasks/task-service.ts";

export interface SupervisorPlanTask {
  key: string;
  title: string;
  description?: string;
  role: string;
  priority?: InboxPriority;
  dependsOn?: string[];
}

export interface SupervisorPlan { intent: string; tasks: SupervisorPlanTask[] }

export class SupervisorOrchestrator {
  constructor(readonly taskService: TaskService, readonly scheduler: TaskScheduler) {}

  materialize(projectId: string, plan: SupervisorPlan, actorId = "supervisor"): CrewTask[] {
    if (!plan.intent.trim()) throw new Error("Supervisor plan intent is required");
    const keys = new Set(plan.tasks.map((task) => task.key));
    if (keys.size !== plan.tasks.length || keys.has("")) throw new Error("Supervisor task keys must be unique and non-empty");
    for (const task of plan.tasks) {
      for (const dependency of task.dependsOn ?? []) if (!keys.has(dependency)) throw new Error(`Unknown supervisor dependency: ${dependency}`);
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

  dispatchReady(projectId: string): CrewTask[] { return this.scheduler.schedule(projectId); }

  recoverStalled(projectId: string, staleBefore: string): CrewTask[] {
    return this.taskService.tasks.list(projectId)
      .filter((task) => (task.status === "assigned" || task.status === "running") && task.updatedAt < staleBefore)
      .map((task) => this.taskService.block(task.id, "Agent progress stalled", { type: "system", id: "supervisor" }));
  }
}
