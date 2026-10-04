import { isAbsolute, relative, resolve } from "node:path";
export function validateBranchWorkspace(root, branch) {
    if (!isAbsolute(root))
        throw new Error("Branch workspace root must be absolute");
    const cleanBranch = branch.trim();
    if (!cleanBranch || cleanBranch.length > 255 || cleanBranch.startsWith("-") || cleanBranch.includes("..") || /[\s~^:?*[\\\]]/.test(cleanBranch))
        throw new Error("Invalid branch name");
    const resolved = resolve(root);
    if (relative(resolved, resolved) !== "")
        throw new Error("Invalid branch workspace root");
    return { root: resolved, branch: cleanBranch };
}
export class BranchWorkspaceProjection {
    tasks;
    timeline;
    git;
    constructor(tasks, timeline, git) {
        this.tasks = tasks;
        this.timeline = timeline;
        this.git = git;
    }
    async get(input) {
        const target = validateBranchWorkspace(input.root, input.branch);
        return { projectId: input.projectId, ...target, tasks: this.tasks.list(input.projectId), activity: this.timeline.list(input.projectId, input.activityLimit), git: await this.git.read(target.root, target.branch) };
    }
}
