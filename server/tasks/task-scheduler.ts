import type { AgentIdentityStore } from "../storage/agent-identity-store.ts";
import type { TaskStore } from "../storage/task-store.ts";
import type { CrewTask } from "./task.ts";
import type { TaskService } from "./task-service.ts";

export interface SchedulableAgent { id: string; role: string }
export type AgentSelector = (task: CrewTask, agents: SchedulableAgent[]) => SchedulableAgent | undefined;

export class TaskScheduler {
  readonly maxConcurrentAgents: number;

  constructor(readonly tasks: TaskStore, readonly identities: AgentIdentityStore, readonly service: TaskService, options: { maxConcurrentAgents?: number; selectAgent?: AgentSelector } = {}) {
    this.maxConcurrentAgents = options.maxConcurrentAgents ?? 4;
    if (!Number.isInteger(this.maxConcurrentAgents) || this.maxConcurrentAgents < 1) throw new Error("maxConcurrentAgents must be at least 1");
    this.selectAgent = options.selectAgent ?? ((task, agents) => agents.find((agent) => agent.role.toLowerCase() === task.role.toLowerCase()));
  }

  readonly selectAgent: AgentSelector;

  schedule(projectId: string): CrewTask[] {
    this.tasks.refreshReady(projectId);
    const capacity = Math.max(0, this.maxConcurrentAgents - this.tasks.countActive(projectId));
    if (!capacity) return [];
    const busy = new Set(this.tasks.list(projectId).filter((task) => task.status === "assigned" || task.status === "running").map((task) => task.assigneeAgentId));
    const agents = this.#agents().filter((agent) => !busy.has(agent.id));
    const assigned: CrewTask[] = [];
    for (const task of this.tasks.ready(projectId, capacity)) {
      const agent = this.selectAgent(task, agents);
      if (!agent) continue;
      assigned.push(this.service.assign(task.id, agent.id, { type: "system", id: "supervisor" }));
      agents.splice(agents.indexOf(agent), 1);
    }
    return assigned;
  }

  #agents(): SchedulableAgent[] {
    const rows = this.identities.database.db.prepare("SELECT id, role FROM agents WHERE status IN ('idle', 'offline', 'completed') ORDER BY created_at, id").all() as Array<{ id: string; role: string }>;
    return rows.map((row) => ({ id: row.id, role: row.role }));
  }
}
