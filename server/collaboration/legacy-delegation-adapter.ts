import type { DelegationRecord } from "../delegations.ts";
import type { AgentHandoffDraft } from "./handoff.ts";

export function delegationToHandoffDraft(input: { delegation: DelegationRecord; projectId: string; fromAgentId: string; taskId: string }): AgentHandoffDraft {
  const summary = input.delegation.reason?.trim() || `Legacy delegation ${input.delegation.id}`;
  return {
    projectId: input.projectId,
    fromAgentId: input.fromAgentId,
    toAgentId: input.delegation.toBotId,
    taskId: input.taskId,
    summary,
    evidence: [{ type: "message", value: input.delegation.message }],
    nextActions: [input.delegation.message],
    blockers: input.delegation.state === "failed" && input.delegation.error ? [input.delegation.error] : undefined,
  };
}
