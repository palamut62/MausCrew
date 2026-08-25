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

  // The one record of what was actually run. Before this, an approved command
  // was dropped entirely and the step came back as its bare tool name, which
  // is a description of a session rather than a recipe.
  it("records the approved command, not just the tool that ran it", () => {
    const draft = teachDraftFromTask({
      title: "Cut a release",
      messages: [
        { id: "1", at: 1, role: "user", kind: "text", text: "Cut the release branch" },
        {
          id: "2",
          at: 2,
          role: "bot",
          kind: "options",
          card: {
            title: "Run a command?",
            subtitle: "git checkout -b release/0.2",
            options: ["Allow", "Deny"],
            answered: "Allow once",
            tool: "Bash",
          },
        },
      ],
    });
    expect(draft.instructions).toContain("git checkout -b release/0.2");
    expect(draft.instructions).toContain("Approvals this workflow needs");
    expect(draft.instructions).toContain("- Bash");
  });

  it("ignores a step the user refused", () => {
    const draft = teachDraftFromTask({
      title: "Careful task",
      messages: [
        { id: "1", at: 1, role: "user", kind: "text", text: "Tidy up" },
        {
          id: "2",
          at: 2,
          role: "bot",
          kind: "options",
          card: { title: "Run?", subtitle: "rm -rf /tmp/keep-me", options: ["Allow", "Deny"], answered: "Deny", tool: "Bash" },
        },
      ],
    });
    expect(draft.instructions).not.toContain("rm -rf");
    expect(draft.instructions).not.toContain("Approvals this workflow needs");
  });

  // A long demonstration keeps its head as well as its tail: the goal and the
  // setup are at the start, and a tail-only window threw exactly those away.
  it("keeps the beginning of a long demonstration and says what it skipped", () => {
    const messages: Parameters<typeof teachDraftFromTask>[0]["messages"] = [
      { id: "start", at: 0, role: "user", kind: "text", text: "THE ORIGINAL GOAL" },
      ...Array.from({ length: 120 }, (_, i) => ({
        id: `m${i}`,
        at: i + 1,
        role: "bot" as const,
        kind: "text" as const,
        text: `middle step ${i}`,
      })),
      { id: "end", at: 999, role: "bot", kind: "text", text: "FINAL RESULT" },
    ];
    const draft = teachDraftFromTask({ title: "Long job", messages });
    expect(draft.instructions).toContain("THE ORIGINAL GOAL");
    expect(draft.instructions).toContain("FINAL RESULT");
    expect(draft.instructions).toMatch(/omitted from the middle/);
    expect(draft.description).toContain("THE ORIGINAL GOAL");
  });

  it("redacts a private key block, not just inline tokens", () => {
    const draft = teachDraftFromTask({
      title: "Key handling",
      messages: [
        {
          id: "1",
          at: 1,
          role: "user",
          kind: "text",
          text: "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA\n-----END RSA PRIVATE KEY-----",
        },
      ],
    });
    expect(draft.instructions).not.toContain("MIIEowIBAAKCAQEA");
    expect(draft.instructions).toContain("REDACTED");
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
