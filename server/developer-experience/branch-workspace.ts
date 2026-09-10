import { isAbsolute, relative, resolve } from "node:path";

import type { ActivityTimeline, ActivityTimelineItem } from "./activity-timeline.ts";
import type { TaskStore } from "../storage/task-store.ts";

export interface BranchSnapshot { status: string; diff: string; commits: Array<{ hash: string; subject: string; createdAt?: string }> }
export interface BranchReader { read(root: string, branch: string): Promise<BranchSnapshot> }
export interface BranchWorkspace {
  projectId: string; branch: string; root: string; tasks: ReturnType<TaskStore["list"]>;
  activity: ActivityTimelineItem[]; git: BranchSnapshot;
}

export function validateBranchWorkspace(root: string, branch: string): { root: string; branch: string } {
  if (!isAbsolute(root)) throw new Error("Branch workspace root must be absolute");
  const cleanBranch = branch.trim();
  if (!cleanBranch || cleanBranch.length > 255 || cleanBranch.startsWith("-") || cleanBranch.includes("..") || /[\s~^:?*[\\\]]/.test(cleanBranch)) throw new Error("Invalid branch name");
  const resolved = resolve(root);
  if (relative(resolved, resolved) !== "") throw new Error("Invalid branch workspace root");
  return { root: resolved, branch: cleanBranch };
}

export class BranchWorkspaceProjection {
  constructor(readonly tasks: TaskStore, readonly timeline: ActivityTimeline, readonly git: BranchReader) {}
  async get(input: { projectId: string; root: string; branch: string; activityLimit?: number }): Promise<BranchWorkspace> {
    const target = validateBranchWorkspace(input.root, input.branch);
    return { projectId: input.projectId, ...target, tasks: this.tasks.list(input.projectId), activity: this.timeline.list(input.projectId, input.activityLimit), git: await this.git.read(target.root, target.branch) };
  }
}
