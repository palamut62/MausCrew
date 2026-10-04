import { stringify } from "yaml";
export function legacyWorkflowToDefinition(workflow, projectId = workflow.projectId) {
    if (!projectId?.trim())
        throw new Error("Legacy workflow needs a project before migration");
    const createdAt = new Date(workflow.createdAt).toISOString();
    const source = { name: workflow.title, trigger: { type: "manual" }, legacyWorkflowId: workflow.id, steps: workflow.steps.map((step) => ({ id: step.id, agent: step.assigneeBotId ?? "supervisor", task: step.title, dependsOn: step.dependsOn })) };
    return {
        id: `legacy:${workflow.id}`,
        projectId,
        name: workflow.title,
        triggerType: "manual",
        yaml: stringify(source),
        steps: workflow.steps.map((step) => ({ key: step.id, kind: "agent", agent: step.assigneeBotId ?? "supervisor", task: step.title, dependsOn: [...step.dependsOn] })),
        createdAt,
        updatedAt: new Date(workflow.updatedAt).toISOString(),
    };
}
