import type { CrewTask, TaskStatus } from "../tasks/task.ts";
import type { CrewDatabase } from "./crew-database.ts";

type TaskRow = {
  id: string; project_id: string; title: string; description: string; role: string; status: TaskStatus;
  priority: CrewTask["priority"]; assignee_agent_id: string | null; created_by: string; created_at: string;
  updated_at: string; started_at: string | null; completed_at: string | null; error: string | null;
};

function mapTask(row: TaskRow): CrewTask {
  return {
    id: row.id, projectId: row.project_id, title: row.title, description: row.description, role: row.role,
    status: row.status, priority: row.priority, createdBy: row.created_by, createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.assignee_agent_id ? { assigneeAgentId: row.assignee_agent_id } : {}),
    ...(row.started_at ? { startedAt: row.started_at } : {}),
    ...(row.completed_at ? { completedAt: row.completed_at } : {}),
    ...(row.error ? { error: row.error } : {}),
  };
}

export class TaskStore {
  constructor(readonly database: CrewDatabase) {}

  create(task: CrewTask): void {
    this.database.db.prepare(`INSERT INTO tasks
      (id, project_id, title, description, role, status, priority, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(task.id, task.projectId, task.title, task.description, task.role, task.status, task.priority, task.createdBy, task.createdAt, task.updatedAt);
  }

  get(id: string): CrewTask | undefined {
    const row = this.database.db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as unknown as TaskRow | undefined;
    return row ? mapTask(row) : undefined;
  }

  list(projectId: string): CrewTask[] {
    return (this.database.db.prepare("SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at, id").all(projectId) as unknown as TaskRow[]).map(mapTask);
  }

  dependencies(taskId: string): string[] {
    return (this.database.db.prepare("SELECT depends_on_task_id FROM task_dependencies WHERE task_id = ? ORDER BY depends_on_task_id").all(taskId) as Array<{ depends_on_task_id: string }>).map((row) => row.depends_on_task_id);
  }

  addDependency(projectId: string, taskId: string, dependsOnTaskId: string, createdAt = new Date().toISOString()): void {
    const task = this.get(taskId);
    const dependency = this.get(dependsOnTaskId);
    if (!task || !dependency || task.projectId !== projectId || dependency.projectId !== projectId) throw new Error("Task dependency must stay inside one project");
    if (this.#reaches(dependsOnTaskId, taskId)) throw new Error(`Circular task dependency: ${taskId} -> ${dependsOnTaskId}`);
    this.database.db.prepare("INSERT INTO task_dependencies(project_id, task_id, depends_on_task_id, created_at) VALUES (?, ?, ?, ?)").run(projectId, taskId, dependsOnTaskId, createdAt);
  }

  refreshReady(projectId: string, updatedAt = new Date().toISOString()): number {
    const result = this.database.db.prepare(`UPDATE tasks SET status = 'ready', updated_at = ?
      WHERE project_id = ? AND status = 'pending' AND NOT EXISTS (
        SELECT 1 FROM task_dependencies d JOIN tasks upstream ON upstream.id = d.depends_on_task_id
        WHERE d.task_id = tasks.id AND upstream.status <> 'completed'
      )`).run(updatedAt, projectId);
    return Number(result.changes);
  }

  ready(projectId: string, limit = 100): CrewTask[] {
    return (this.database.db.prepare(`SELECT * FROM tasks WHERE project_id = ? AND status = 'ready'
      ORDER BY CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, created_at, id LIMIT ?`)
      .all(projectId, limit) as unknown as TaskRow[]).map(mapTask);
  }

  countActive(projectId: string): number {
    const row = this.database.db.prepare("SELECT COUNT(*) AS count FROM tasks WHERE project_id = ? AND status IN ('assigned', 'running')").get(projectId) as { count: number };
    return Number(row.count);
  }

  transition(id: string, from: TaskStatus[], to: TaskStatus, input: { updatedAt?: string; assigneeAgentId?: string; error?: string } = {}): CrewTask {
    const now = input.updatedAt ?? new Date().toISOString();
    const placeholders = from.map(() => "?").join(", ");
    const result = this.database.db.prepare(`UPDATE tasks SET status = ?, updated_at = ?,
      assignee_agent_id = COALESCE(?, assignee_agent_id), error = ?,
      started_at = CASE WHEN ? = 'running' THEN COALESCE(started_at, ?) ELSE started_at END,
      completed_at = CASE WHEN ? IN ('completed', 'failed', 'cancelled') THEN ? ELSE completed_at END
      WHERE id = ? AND status IN (${placeholders})`)
      .run(to, now, input.assigneeAgentId ?? null, input.error ?? null, to, now, to, now, id, ...from);
    if (Number(result.changes) !== 1) throw new Error(`Invalid task transition to ${to}: ${id}`);
    return this.get(id)!;
  }

  #reaches(fromId: string, targetId: string): boolean {
    const row = this.database.db.prepare(`WITH RECURSIVE reachable(id) AS (
      SELECT depends_on_task_id FROM task_dependencies WHERE task_id = ?
      UNION SELECT d.depends_on_task_id FROM task_dependencies d JOIN reachable r ON d.task_id = r.id
    ) SELECT 1 AS found FROM reachable WHERE id = ? LIMIT 1`).get(fromId, targetId);
    return Boolean(row) || fromId === targetId;
  }
}
