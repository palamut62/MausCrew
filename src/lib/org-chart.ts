// The crew, drawn as a structure rather than a list.
//
// The sidebar answers "who exists"; it cannot answer "who works for whom",
// which is the question you actually have once a Chief starts handing stages
// to specialists. The reporting lines are not configured anywhere — they are
// implied by work that already happened, so they are derived here rather than
// stored: a Chief of Staff at the root, everyone it has assigned a workflow
// stage to underneath, and the bots nobody has delegated to standing on their
// own.
import type { Bot, Workflow } from "@/state/store";

export interface OrgNode {
  bot: Bot;
  /** Live stages this bot owns right now, newest first. */
  assignments: Array<{ workflowId: string; workflowTitle: string; step: string; status: string; updatedAt: number }>;
  /** Bots this one has delegated to, sorted by name. */
  reports: OrgNode[];
}

export interface OrgChart {
  /** Chiefs and any bot that owns a workflow — the people work flows from. */
  roots: OrgNode[];
  /** Bots no live workflow touches. Not "unimportant": most crews are mostly
   * this, and hiding them would make the chart lie about the roster. */
  unassigned: Bot[];
}

const LIVE: ReadonlySet<Workflow["status"]> = new Set(["active", "blocked"]);

/**
 * @param includeFinished draw completed workflows too — the same chart, read
 * as a record of who did what rather than who is doing what.
 */
export function buildOrgChart(bots: Bot[], workflows: Workflow[], includeFinished = false): OrgChart {
  const visible = bots.filter((bot) => !bot.hidden);
  const byId = new Map(visible.map((bot) => [bot.id, bot]));
  const relevant = workflows.filter((workflow) => includeFinished || LIVE.has(workflow.status));

  const nodes = new Map<string, OrgNode>();
  const node = (bot: Bot) => {
    const existing = nodes.get(bot.id);
    if (existing) return existing;
    const created: OrgNode = { bot, assignments: [], reports: [] };
    nodes.set(bot.id, created);
    return created;
  };

  // A bot only reports to one owner in the chart even when two Chiefs used it,
  // because a second parent would draw it twice and neither copy would be the
  // whole truth. First owner by workflow order wins, which is the oldest live
  // workflow — the one that has been holding that specialist the longest.
  const parentOf = new Map<string, string>();
  // Two bots can end up delegating to each other — the usual route is a chief
  // handover that leaves the old chief's workflow live while the new one hands
  // work back. Left alone that pair is a cycle: neither is anybody's root, so
  // both drop out of the chart entirely and the roster silently shrinks.
  // Refusing the edge that closes the loop keeps the graph a forest and keeps
  // both bots on screen; the assignment itself is still listed on the card.
  const wouldCycle = (parent: string, child: string) => {
    let cursor: string | undefined = parent;
    while (cursor) {
      if (cursor === child) return true;
      cursor = parentOf.get(cursor);
    }
    return false;
  };
  for (const workflow of relevant) {
    const owner = byId.get(workflow.ownerBotId);
    if (!owner) continue;
    const ownerNode = node(owner);
    for (const step of workflow.steps) {
      const assignee = step.assigneeBotId ? byId.get(step.assigneeBotId) : undefined;
      if (!assignee) continue;
      const assigneeNode = node(assignee);
      assigneeNode.assignments.push({
        workflowId: workflow.id,
        workflowTitle: workflow.title,
        step: step.title,
        status: step.status,
        updatedAt: step.updatedAt,
      });
      if (assignee.id === owner.id) continue;
      if (!parentOf.has(assignee.id) && !wouldCycle(owner.id, assignee.id)) {
        parentOf.set(assignee.id, owner.id);
        ownerNode.reports.push(assigneeNode);
      }
    }
  }

  const byName = (a: OrgNode, b: OrgNode) => a.bot.name.localeCompare(b.bot.name);
  for (const entry of nodes.values()) {
    entry.reports.sort(byName);
    entry.assignments.sort((a, b) => b.updatedAt - a.updatedAt || a.step.localeCompare(b.step));
  }

  const roots = [...nodes.values()]
    .filter((entry) => !parentOf.has(entry.bot.id))
    // A Chief with no live workflow still belongs at the top of the chart:
    // it is the role, not the current workload, that makes it the root.
    .concat(visible.filter((bot) => bot.chiefOfStaff && !nodes.has(bot.id)).map((bot) => node(bot)))
    .sort((a, b) => Number(Boolean(b.bot.chiefOfStaff)) - Number(Boolean(a.bot.chiefOfStaff)) || byName(a, b));

  const placed = new Set(nodes.keys());
  return { roots, unassigned: visible.filter((bot) => !placed.has(bot.id)).sort((a, b) => a.name.localeCompare(b.name)) };
}
