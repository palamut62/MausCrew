import { describe, expect, it } from "vitest";

import { buildReplyQuote, replyQuotePrefix } from "./reply-quote.ts";

const thread = [
  { id: "m1", role: "user" as const, text: "Can you check the deploy?" },
  { id: "m2", role: "bot" as const, text: "  It failed on\n\n  the migration step.  " },
  { id: "m3", role: "bot" as const, text: "" },
];

describe("reply quotes", () => {
  it("flattens the quoted text and keeps who said it", () => {
    expect(buildReplyQuote(thread, "m2")).toEqual({
      id: "m2",
      role: "bot",
      excerpt: "It failed on the migration step.",
    });
  });

  it("quotes nothing for an unknown id, an empty message, or no id at all", () => {
    // An id from another thread lands here as "not found" — which is the
    // point of resolving against this thread's messages rather than the
    // client's word.
    expect(buildReplyQuote(thread, "from-another-thread")).toBeUndefined();
    expect(buildReplyQuote(thread, "m3")).toBeUndefined();
    expect(buildReplyQuote(thread, undefined)).toBeUndefined();
  });

  it("caps a long quote so it stays a pointer", () => {
    const long = [{ id: "m1", role: "user" as const, text: "x".repeat(600) }];
    expect(buildReplyQuote(long, "m1")?.excerpt).toHaveLength(280);
  });

  it("tells the model whose message is being answered, and nothing when there is none", () => {
    expect(replyQuotePrefix(buildReplyQuote(thread, "m2"))).toBe(
      '[Replying to your earlier message: "It failed on the migration step."]\n\n',
    );
    expect(replyQuotePrefix(buildReplyQuote(thread, "m1"))).toContain("their own earlier message");
    expect(replyQuotePrefix(undefined)).toBe("");
  });
});
