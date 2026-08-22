import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createWorkspaceSkill,
  deleteWorkspaceSkill,
  listWorkspaceSkills,
  SkillStoreError,
  skillFileMode,
  skillIndexPrompt,
  skillRootForWorkspace,
  updateWorkspaceSkill,
  validateSkillInput,
} from "./skills.ts";

describe("workspace skill store", () => {
  let scratch: string;

  beforeEach(() => {
    scratch = mkdtempSync(join(tmpdir(), "mauscrew-skills-"));
  });

  afterEach(() => {
    rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  });

  it("creates, lists, updates and deletes one portable skill bundle", () => {
    const created = createWorkspaceSkill(scratch, {
      name: "code-review",
      description: "Review a change before shipping.",
      whenToUse: "Use after implementation.",
      instructions: "Inspect the diff and run focused tests.",
      userInvocable: true,
      modelInvocable: true,
    });
    expect(created).toMatchObject({ id: "code-review", valid: true, modelInvocable: true });

    const root = skillRootForWorkspace(scratch);
    const path = join(root, "code-review", "SKILL.md");
    expect(readFileSync(path, "utf8")).toContain('name: "code-review"');
    expect(listWorkspaceSkills(scratch).skills).toHaveLength(1);

    const updated = updateWorkspaceSkill(scratch, "code-review", {
      ...created,
      name: "code-review",
      description: "Review code and report concrete findings.",
      instructions: "Read the diff. Report findings in priority order.",
      modelInvocable: false,
    });
    expect(updated).toMatchObject({ description: "Review code and report concrete findings.", modelInvocable: false });
    expect(readFileSync(path, "utf8")).toContain("disable-model-invocation: true");

    deleteWorkspaceSkill(scratch, "code-review");
    expect(existsSync(join(root, "code-review"))).toBe(false);
  });

  it("preserves frontmatter owned by another tool when saving known fields", () => {
    const root = skillRootForWorkspace(scratch);
    const dir = join(root, "shared-skill");
    createWorkspaceSkill(scratch, {
      name: "shared-skill",
      description: "Original",
      instructions: "Original body",
    });
    const path = join(dir, "SKILL.md");
    writeFileSync(path, [
      "---",
      "name: shared-skill",
      "description: Original",
      "metadata:",
      "  owner: another-tool",
      "  tier: gold",
      "---",
      "",
      "Original body",
      "",
    ].join("\n"));

    updateWorkspaceSkill(scratch, "shared-skill", {
      name: "shared-skill",
      description: "Updated",
      instructions: "Updated body",
    });
    const saved = readFileSync(path, "utf8");
    expect(saved).toContain("metadata:\n  owner: another-tool\n  tier: gold");
    expect(saved).toContain('description: "Updated"');
  });

  it("rejects unsafe names and type-confused policy fields", () => {
    for (const name of ["../escape", "Bad Name", "under_score", "a/child", ""]) {
      expect(() => validateSkillInput({ name, description: "x", instructions: "y" })).toThrow(SkillStoreError);
    }
    expect(() => validateSkillInput({
      name: "safe-name",
      description: "x",
      instructions: "y",
      modelInvocable: "yes",
    })).toThrow(/modelInvocable/);
  });

  it("fails closed on invalid or legacy invocation frontmatter and repairs it on save", () => {
    createWorkspaceSkill(scratch, {
      name: "policy-check",
      description: "Check policy",
      instructions: "Original body",
    });
    const path = join(skillRootForWorkspace(scratch), "policy-check", "SKILL.md");
    writeFileSync(path, [
      "---",
      "name: policy-check",
      "description: Check policy",
      "disable-model-invocation: maybe",
      "userInvocable: true",
      "---",
      "Original body",
    ].join("\n"));

    expect(listWorkspaceSkills(scratch).skills[0]).toMatchObject({
      valid: false,
      modelInvocable: false,
      userInvocable: false,
    });
    expect(listWorkspaceSkills(scratch).skills[0].diagnostic).toContain("must be a boolean");
    expect(listWorkspaceSkills(scratch).skills[0].diagnostic).toContain("unsupported invocation field");

    updateWorkspaceSkill(scratch, "policy-check", {
      name: "policy-check",
      description: "Check repaired policy",
      instructions: "Repaired body",
      modelInvocable: true,
      userInvocable: true,
    });
    const saved = readFileSync(path, "utf8");
    expect(saved).not.toContain("userInvocable:");
    expect(listWorkspaceSkills(scratch).skills[0]).toMatchObject({ valid: true, modelInvocable: true, userInvocable: true });
  });

  it("refuses a symlinked skill bundle instead of reading outside the workspace", () => {
    const root = skillRootForWorkspace(scratch);
    const outside = mkdtempSync(join(tmpdir(), "mauscrew-skill-outside-"));
    writeFileSync(join(outside, "SKILL.md"), "---\nname: escaped\ndescription: escaped\n---\nOutside\n");
    try {
      try {
        symlinkSync(outside, join(root, "escaped"), process.platform === "win32" ? "junction" : "dir");
      } catch {
        return;
      }
      expect(listWorkspaceSkills(scratch).skills).toEqual([]);
      expect(() => updateWorkspaceSkill(scratch, "escaped", {
        name: "escaped",
        description: "No",
        instructions: "No",
      })).toThrow(/real directory/);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("writes owner-only files on platforms with POSIX mode bits", () => {
    createWorkspaceSkill(scratch, { name: "private-skill", description: "Private", instructions: "Do it." });
    if (process.platform !== "win32") expect(skillFileMode(scratch, "private-skill") & 0o077).toBe(0);
  });
});

// Skills only became reachable outside DeepSeek once the harness started
// handing every other engine this index. These pin the part that decides
// whether a saved skill is visible at all.
describe("skill index prompt", () => {
  let scratch: string;

  beforeEach(() => {
    scratch = mkdtempSync(join(tmpdir(), "mauscrew-skill-prompt-"));
  });

  afterEach(() => {
    rmSync(scratch, { recursive: true, force: true });
  });

  it("says nothing, and creates nothing, for a workspace with no skills", () => {
    expect(skillIndexPrompt(scratch)).toBe("");
    // The turn path runs this for every bot on every turn; it must not
    // scatter .agents/skills trees under bots that never use skills.
    expect(existsSync(join(scratch, ".agents"))).toBe(false);
  });

  it("names each skill, when to use it, and the absolute file to read", () => {
    createWorkspaceSkill(scratch, {
      name: "weekly-report",
      description: "Assemble the Monday status report.",
      whenToUse: "The user asks for the weekly status.",
      instructions: "1. Gather the week's commits.",
    });
    const prompt = skillIndexPrompt(scratch);
    expect(prompt).toContain("weekly-report");
    expect(prompt).toContain("Assemble the Monday status report.");
    expect(prompt).toContain("Use when: The user asks for the weekly status.");
    // Without the path the agent cannot open the file — cwd is not the
    // workspace for every engine.
    expect(prompt).toContain(join(scratch, ".agents", "skills", "weekly-report", "SKILL.md"));
  });

  it("withholds a skill the user marked as not model-invocable", () => {
    createWorkspaceSkill(scratch, {
      name: "manual-only",
      description: "Runs only when the user asks for it by name.",
      instructions: "Do the thing.",
      modelInvocable: false,
    });
    expect(skillIndexPrompt(scratch)).toBe("");
  });

  it("withholds a malformed bundle rather than sending the agent to read it", () => {
    const dir = join(skillRootForWorkspace(scratch), "broken");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "SKILL.md"), "no frontmatter here");
    expect(skillIndexPrompt(scratch)).toBe("");
  });

  it("survives an unreadable skills directory instead of taking the turn down", () => {
    const root = skillRootForWorkspace(scratch);
    rmSync(root, { recursive: true, force: true });
    symlinkSync(tmpdir(), root, "junction");
    expect(() => skillIndexPrompt(scratch)).not.toThrow();
    expect(skillIndexPrompt(scratch)).toBe("");
  });
});
