import { describe, expect, it } from "vitest";

import { createAgentIdentity } from "./identity.ts";

describe("agent identity", () => {
  it("creates a stable identity without a signing key", () => {
    const identity = createAgentIdentity({ id: "agent-architect", name: " Architect ", role: " System design " });
    expect(identity).toMatchObject({ id: "agent-architect", name: "Architect", role: "System design" });
    expect(Date.parse(identity.createdAt)).not.toBeNaN();
    expect(identity).not.toHaveProperty("privateKey");
  });

  it("rejects blank and oversized identity fields", () => {
    expect(() => createAgentIdentity({ name: " ", role: "review" })).toThrow("Agent name is required");
    expect(() => createAgentIdentity({ name: "a", role: "r".repeat(241) })).toThrow("Agent role must be at most 240 characters");
  });
});
