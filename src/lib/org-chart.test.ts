import { describe, expect, it } from "vitest";

import { buildOrgChart } from "./org-chart";
import type { Bot, Workflow } from "@/state/store";

function bot(id: string, name: string, overrides: Partial<Bot> = {}): Bot {
  return {
    id,
    name,
    threadId: `thread-${id}`,
    title: "",
    description: "",
    notifications: true,
    color: "blue",
    unread: false,
    messages: [],
    modelSelection: { instanceId: "claude", model: "sonnet" },
    ...overrides,
  } as Bot;
}

function workflow(id: string, ownerBotId: string, steps: Array<[string, string]>, status: Workflow["status"] = "active"): Workflow {
  return {
    id,
    title: `Workflow ${id}`,
    ownerBotId,
    threadId: `thread-${id}`,
    status,
    steps: steps.map(([stepId, assigneeBotId]) => ({
      id: stepId,
      title: `Step ${stepId}`,
      assigneeBotId,
      dependsOn: [],
      status: "pending" as const,
      updatedAt: 0,
    })),
    createdAt: 0,
    updatedAt: 0,
  };
}

describe("org chart", () => {
  it("puts the workflow owner over the bots it assigned stages to", () => {
    const bots = [bot("chief", "Chief", { chiefOfStaff: true }), bot("dev", "Dev"), bot("qa", "Qa")];
    const chart = buildOrgChart(bots, [workflow("w1", "chief", [["s1", "dev"], ["s2", "qa"]])]);
    expect(chart.roots.map((node) => node.bot.id)).toEqual(["chief"]);
    expect(chart.roots[0].reports.map((node) => node.bot.id)).toEqual(["dev", "qa"]);
    expect(chart.unassigned).toEqual([]);
  });

  it("leaves bots no live workflow touches in the roster instead of dropping them", () => {
    const bots = [bot("chief", "Chief"), bot("dev", "Dev"), bot("idle", "Idle"), bot("gone", "Gone", { hidden: true })];
    const chart = buildOrgChart(bots, [workflow("w1", "chief", [["s1", "dev"]])]);
    expect(chart.unassigned.map((entry) => entry.id)).toEqual(["idle"]);
  });

  it("ignores finished workflows unless asked for them", () => {
    const bots = [bot("chief", "Chief"), bot("dev", "Dev")];
    const done = [workflow("w1", "chief", [["s1", "dev"]], "completed")];
    expect(buildOrgChart(bots, done).roots).toEqual([]);
    expect(buildOrgChart(bots, done, true).roots[0].reports.map((node) => node.bot.id)).toEqual(["dev"]);
  });

  it("gives a bot delegated to by two chiefs a single parent", () => {
    const bots = [bot("a", "Ann"), bot("b", "Bob"), bot("dev", "Dev")];
    const chart = buildOrgChart(bots, [workflow("w1", "a", [["s1", "dev"]]), workflow("w2", "b", [["s2", "dev"]])]);
    const parents = chart.roots.filter((node) => node.reports.some((report) => report.bot.id === "dev"));
    expect(parents).toHaveLength(1);
    expect(parents[0].bot.id).toBe("a");
    // Both stages still show on the specialist's card — one parent, all work.
    expect(parents[0].reports[0].assignments).toHaveLength(2);
  });

  it("keeps both bots on the chart when two chiefs delegated to each other", () => {
    // The route to this is a handover: the old chief's workflow is still live
    // when the new one hands work back. Neither may vanish.
    const bots = [bot("a", "Ann"), bot("b", "Bob")];
    const chart = buildOrgChart(bots, [workflow("w1", "a", [["s1", "b"]]), workflow("w2", "b", [["s2", "a"]])]);
    expect(chart.roots.map((node) => node.bot.id)).toEqual(["a"]);
    expect(chart.roots[0].reports.map((node) => node.bot.id)).toEqual(["b"]);
    // The stage Bob handed back is still Ann's work, listed on her own card.
    expect(chart.roots[0].assignments.map((entry) => entry.step)).toEqual(["Step s2"]);
    expect(chart.unassigned).toEqual([]);
  });

  it("keeps a longer delegation loop on the chart", () => {
    const bots = [bot("a", "Ann"), bot("b", "Bob"), bot("c", "Cal")];
    const chart = buildOrgChart(bots, [
      workflow("w1", "a", [["s1", "b"]]),
      workflow("w2", "b", [["s2", "c"]]),
      workflow("w3", "c", [["s3", "a"]]),
    ]);
    expect(chart.roots.map((node) => node.bot.id)).toEqual(["a"]);
    expect(chart.roots[0].reports[0].bot.id).toBe("b");
    expect(chart.roots[0].reports[0].reports[0].bot.id).toBe("c");
    expect(chart.unassigned).toEqual([]);
  });

  it("lists a bot's stages newest first", () => {
    const older = workflow("w1", "chief", [["s1", "dev"]]);
    older.steps[0].updatedAt = 100;
    const newer = workflow("w2", "chief", [["s2", "dev"]]);
    newer.steps[0].updatedAt = 200;
    const chart = buildOrgChart([bot("chief", "Chief"), bot("dev", "Dev")], [older, newer]);
    expect(chart.roots[0].reports[0].assignments.map((entry) => entry.step)).toEqual(["Step s2", "Step s1"]);
  });

  it("keeps an idle Chief of Staff at the root", () => {
    const chart = buildOrgChart([bot("chief", "Chief", { chiefOfStaff: true }), bot("dev", "Dev")], []);
    expect(chart.roots.map((node) => node.bot.id)).toEqual(["chief"]);
    expect(chart.unassigned.map((entry) => entry.id)).toEqual(["dev"]);
  });
});
