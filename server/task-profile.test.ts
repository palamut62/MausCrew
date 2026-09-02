import { describe, expect, it } from "vitest";

import { taskProfile } from "./task-profile.ts";

describe("taskProfile", () => {
  it("derives a unique role and visual identity from the first task", () => {
    const profile = taskProfile("Research competitors and cite sources", ["Scout"]);
    expect(profile).toMatchObject({ name: "Scout 2", title: "Research Specialist" });
    expect(profile.color).toBeTruthy();
    expect(profile.shape).toBeTruthy();
  });
});
