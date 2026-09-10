export function delegationToHandoffDraft(input) {
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
