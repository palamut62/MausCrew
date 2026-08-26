// A credential the user was asked for must not survive the turn it was asked
// in. The card is what the transcript keeps — a plain JSON file on disk for as
// long as the thread exists — so "not stored" has to be true of the card, not
// just of the input field.
import { describe, expect, it } from "vitest";

import { permissionQuestion } from "./permission-question.ts";

describe("recognising a credential request", () => {
  it("marks request_secret as secret and carries the reason through", () => {
    const question = permissionQuestion("request_secret", {
      reason: "I need an OpenRouter key to reach the model.",
      name: "OPENROUTER_API_KEY",
    });
    expect(question?.secret).toBe(true);
    expect(question?.question).toContain("OpenRouter key");
  });

  // A "Deny" button beside a field holding a real key invites tapping it with
  // the key still in the box.
  it("offers no one-tap choices for a credential", () => {
    expect(permissionQuestion("request_secret", { reason: "why" })?.choices).toEqual([]);
  });

  it("still says something when the agent gives no reason", () => {
    const question = permissionQuestion("request_secret", {});
    expect(question?.secret).toBe(true);
    expect(question?.question.length).toBeGreaterThan(0);
  });

  // The distinction the whole feature rests on: an ordinary question is
  // recorded verbatim, and must not be treated as a credential.
  it("leaves an ordinary question unmarked", () => {
    const question = permissionQuestion("ask_user", { question: "Which branch?", choices: ["main", "dev"] });
    expect(question?.secret).toBeFalsy();
    expect(question?.choices).toEqual(["main", "dev"]);
  });

  it("does not mistake a permission ask for a credential ask", () => {
    const question = permissionQuestion("approve", { tool_name: "Bash", input: { command: "ls" } });
    expect(question).toBeNull();
  });
});
