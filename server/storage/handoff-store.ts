import { randomUUID } from "node:crypto";

import type { AgentHandoff, HandoffEvidence, HandoffEvidenceType, HandoffStatus } from "../collaboration/handoff.ts";
import type { CrewDatabase } from "./crew-database.ts";

type HandoffRow = { id: string; project_id: string; from_agent_id: string; to_agent_id: string; task_id: string; status: HandoffStatus; summary: string; next_actions_json: string; blockers_json: string; created_at: string; updated_at: string };

export class HandoffStore {
  constructor(readonly database: CrewDatabase) {}

  create(handoff: AgentHandoff): void {
    const task = this.database.db.prepare("SELECT project_id FROM tasks WHERE id = ?").get(handoff.taskId) as { project_id: string } | undefined;
    if (!task || task.project_id !== handoff.projectId) throw new Error("Handoff task must belong to the same project");
    this.database.db.prepare(`INSERT INTO handoffs
      (id, project_id, from_agent_id, to_agent_id, task_id, status, summary, next_actions_json, blockers_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(handoff.id, handoff.projectId, handoff.fromAgentId, handoff.toAgentId, handoff.taskId, handoff.status, handoff.summary, JSON.stringify(handoff.nextActions), JSON.stringify(handoff.blockers ?? []), handoff.createdAt, handoff.updatedAt);
    this.#appendEvidence(handoff.id, handoff.evidence, 0);
  }

  get(id: string): AgentHandoff | undefined {
    const row = this.database.db.prepare("SELECT * FROM handoffs WHERE id = ?").get(id) as unknown as HandoffRow | undefined;
    if (!row) return undefined;
    const evidence = this.database.db.prepare("SELECT evidence_type, value FROM handoff_evidence WHERE handoff_id = ? ORDER BY ordinal").all(id) as Array<{ evidence_type: HandoffEvidenceType; value: string }>;
    const blockers = JSON.parse(row.blockers_json) as string[];
    return {
      id: row.id, projectId: row.project_id, fromAgentId: row.from_agent_id, toAgentId: row.to_agent_id,
      taskId: row.task_id, status: row.status, summary: row.summary,
      evidence: evidence.map((item) => ({ type: item.evidence_type, value: item.value })),
      nextActions: JSON.parse(row.next_actions_json) as string[], ...(blockers.length ? { blockers } : {}),
      createdAt: row.created_at, updatedAt: row.updated_at,
    };
  }

  transition(id: string, from: HandoffStatus, to: HandoffStatus, evidence: HandoffEvidence[] = [], updatedAt = new Date().toISOString()): AgentHandoff {
    const current = this.get(id);
    if (!current || current.status !== from) throw new Error(`Invalid handoff transition ${from} -> ${to}: ${id}`);
    if (to === "completed" && current.evidence.length + evidence.length === 0) throw new Error("Completed handoff requires evidence");
    const result = this.database.db.prepare("UPDATE handoffs SET status = ?, updated_at = ? WHERE id = ? AND status = ?").run(to, updatedAt, id, from);
    if (Number(result.changes) !== 1) throw new Error(`Concurrent handoff transition: ${id}`);
    this.#appendEvidence(id, evidence, current.evidence.length);
    return this.get(id)!;
  }

  #appendEvidence(handoffId: string, evidence: HandoffEvidence[], offset: number): void {
    const statement = this.database.db.prepare("INSERT INTO handoff_evidence(id, handoff_id, evidence_type, value, ordinal) VALUES (?, ?, ?, ?, ?)");
    evidence.forEach((item, index) => statement.run(randomUUID(), handoffId, item.type, item.value.trim(), offset + index));
  }
}
