import { describe, expect, it } from "vitest";

import { permissionQuestion } from "./permission-question.ts";

describe("permissionQuestion", () => {
  it("maps Claude Code AskUserQuestion options to a MausCrew question", () => {
    expect(permissionQuestion("approve", {
      tool_name: "AskUserQuestion",
      input: {
        questions: [{
          question: "Continue?",
          options: [{ label: "Yes" }, { label: "No" }],
        }],
      },
    })).toEqual({ question: "Continue?", choices: ["Yes", "No"], intercepted: true });
  });

  it("keeps the explicit MausCrew ask_user path", () => {
    expect(permissionQuestion("ask_user", { question: "Continue?", choices: ["Yes", "No"] }))
      .toEqual({ question: "Continue?", choices: ["Yes", "No"], intercepted: false });
  });

  it("does not reinterpret ordinary permission requests", () => {
    expect(permissionQuestion("approve", { tool_name: "Bash", input: { command: "echo ok" } })).toBeNull();
  });
});
