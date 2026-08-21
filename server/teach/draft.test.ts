import { describe, expect, it } from "vitest";

import { teachDraftFromTask } from "./draft.ts";

describe("Teach draft", () => {
  it("creates a portable, review-only skill draft from a task", () => {
    const draft = teachDraftFromTask({
      title: "Deploy the app",
      messages: [
        { id: "1", at: 1, role: "user", kind: "text", text: "Build and deploy the app" },
        { id: "2", at: 2, role: "bot", kind: "activity", tool: { name: "Bash:npm run build", ok: true } },
        { id: "3", at: 3, role: "bot", kind: "text", text: "Deployment is ready" },
      ],
    });
    expect(draft.name).toBe("deploy-the-app");
    expect(draft.instructions).toContain("Tool action: Bash:npm run build");
    expect(draft.instructions).toContain("Ask before consequential external writes");
  });

  it("redacts common credentials from captured text", () => {
    const draft = teachDraftFromTask({
      title: "API workflow",
      messages: [{ id: "1", at: 1, role: "user", kind: "text", text: "Use API_TOKEN=super-secret-value and box_123456789abcdef" }],
    });
    expect(draft.instructions).not.toContain("super-secret-value");
    expect(draft.instructions).not.toContain("box_123456789abcdef");
    expect(draft.instructions).toContain("REDACTED");
  });
});
