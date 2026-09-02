import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ProjectManager } from "./projects.ts";

describe("ProjectManager", () => {
  it("persists isolated project context and room membership", () => {
    const file = join(mkdtempSync(join(tmpdir(), "mauscrew-projects-")), "projects.json");
    const manager = new ProjectManager(file);
    const project = manager.create({
      name: "MausCrew",
      workspacePath: "C:\\work\\mauscrew",
      instructions: "Keep release work inside this project.",
      resources: [{ label: "Repository", value: "https://example.test/mauscrew" }],
    });
    manager.attachRoom(project.id, "room-1");

    const reloaded = new ProjectManager(file);
    expect(reloaded.get(project.id)).toMatchObject({ roomIds: ["room-1"], workspacePath: "C:\\work\\mauscrew" });
    expect(reloaded.systemBlock(project.id)).toContain("Project resources");
  });

  it("detaches deleted rooms without removing the project", () => {
    const file = join(mkdtempSync(join(tmpdir(), "mauscrew-projects-")), "projects.json");
    const manager = new ProjectManager(file);
    const project = manager.create({ name: "Browser", roomIds: ["room-1", "room-2"] });
    manager.detachRoom("room-1");
    expect(manager.get(project.id)?.roomIds).toEqual(["room-2"]);
  });
});
