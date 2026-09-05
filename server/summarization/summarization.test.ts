import { describe, expect, it } from "vitest";

import { buildDigestPrompt, digestSystemBlock, type DigestSourceMessage } from "./digest.ts";
import { FOLD_THRESHOLD_TOKENS, inlineHistory, MAX_INLINE_HISTORY_CHARS, partitionThread, truncateFairly } from "./partition.ts";
import { estimateTokens } from "./token-estimate.ts";

type Msg = DigestSourceMessage & { role: "bot" | "user"; kind: string };

const msg = (i: number, over: Partial<Msg> = {}): Msg => ({
  id: `m${i}`,
  role: i % 2 === 0 ? "user" : "bot",
  kind: "text",
  text: `message ${i}`,
  ...over,
});

/** A thread long enough to be worth folding. */
const longThread = (n: number, chars = 900) =>
  Array.from({ length: n }, (_, i) => msg(i, { text: "x".repeat(chars) }));

describe("token estimate", () => {
  it("charges for framing, not just characters", () => {
    // two empty messages still cost something — role markers are not free
    expect(estimateTokens([msg(0, { text: "" }), msg(1, { text: "" })])).toBeGreaterThan(0);
  });

  it("charges a tool call more than the same text alone", () => {
    const plain = estimateTokens([msg(0, { text: "abc" })]);
    const withTool = estimateTokens([msg(0, { text: "abc", tool: { name: "Bash" } })]);
    expect(withTool).toBeGreaterThan(plain);
  });
});

describe("partition", () => {
  it("leaves a short thread completely alone", () => {
    const p = partitionThread({ messages: [msg(0), msg(1), msg(2)] });
    expect(p.fold).toHaveLength(0);
    expect(p.keep).toHaveLength(3);
  });

  it("leaves a long-but-cheap thread alone", () => {
    // many messages, few characters: nothing to gain by folding
    const p = partitionThread({ messages: Array.from({ length: 200 }, (_, i) => msg(i, { text: "hi" })) });
    expect(p.fold).toHaveLength(0);
  });

  it("folds the old part once the thread is genuinely expensive", () => {
    const p = partitionThread({ messages: longThread(120) });
    expect(p.fold.length).toBeGreaterThan(0);
    expect(p.keep.length).toBeGreaterThan(0);
    expect(p.foldedTokens).toBeGreaterThan(FOLD_THRESHOLD_TOKENS / 4);
  });

  it("never splits the thread — every message lands on exactly one side", () => {
    const messages = longThread(120);
    const p = partitionThread({ messages });
    expect(p.fold.length + p.keep.length).toBe(messages.length);
    expect([...p.fold, ...p.keep].map((m) => m.id)).toEqual(messages.map((m) => m.id));
  });

  // A tail that opens on half an exchange is what makes a model re-answer
  // something already settled.
  it("opens the kept tail on a user message", () => {
    const p = partitionThread({ messages: longThread(120) });
    expect(p.keep[0]!.role).toBe("user");
    expect(p.keep[0]!.kind).toBe("text");
  });

  it("keeps the thread whole rather than cutting at a bad seam", () => {
    // no user text anywhere: there is no clean place to cut, so do not cut
    const messages = Array.from({ length: 120 }, (_, i) =>
      msg(i, { role: "bot", kind: "activity", text: "x".repeat(900) }),
    );
    const p = partitionThread({ messages });
    expect(p.fold).toHaveLength(0);
    expect(p.keep).toHaveLength(messages.length);
  });
});

describe("inline history", () => {
  it("preserves short conversations verbatim", () => {
    expect(inlineHistory([{ role: "user", text: "Merhaba" }, { role: "assistant", text: "Selam" }]))
      .toBe("User: Merhaba\nAssistant: Selam");
    expect(inlineHistory([])).toBe("");
  });

  it("bounds a giant replay even below the message-count folding threshold", () => {
    const messages = [
      { role: "user", text: "Keep the existing design" },
      { role: "assistant", text: "START " + "x".repeat(526_891) + " END" },
      { role: "user", text: "Continue from the last decision" },
    ];
    const original = JSON.stringify(messages);
    const result = inlineHistory(messages);
    expect(result.length).toBeLessThanOrEqual(MAX_INLINE_HISTORY_CHARS);
    expect(result).toContain("Keep the existing design");
    expect(result).toContain("START ");
    expect(result).toContain(" END");
    expect(result).toContain("Continue from the last decision");
    expect(result).toContain("Full messages remain in MausCrew");
    expect(JSON.stringify(messages)).toBe(original);
  });

  it("counts labels and omission markers against the replay budget", () => {
    const result = inlineHistory(Array.from({ length: 40 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", text: "y".repeat(30_000) })));
    expect(result.length).toBeLessThanOrEqual(MAX_INLINE_HISTORY_CHARS);
    expect(result.match(/(?:User|Assistant):/g)).toHaveLength(40);
  });
});

describe("fair truncation", () => {
  it("saves the short messages from one enormous one", () => {
    const messages = [
      msg(0, { text: "short a" }),
      msg(1, { text: "short b" }),
      msg(2, { text: "x".repeat(100_000) }),
    ];
    const { kept, truncated } = truncateFairly({ messages, maxChars: 1000 });
    expect(kept[0]!.text).toBe("short a");
    expect(kept[1]!.text).toBe("short b");
    expect(truncated).toBe(1);
    expect(kept[2]!.text.length).toBeLessThan(1000);
  });

  it("respects the budget and keeps every message present", () => {
    const messages = Array.from({ length: 40 }, (_, i) => msg(i, { text: "y".repeat(5000) }));
    const { kept } = truncateFairly({ messages, maxChars: 10_000 });
    expect(kept).toHaveLength(40);
    const total = kept.reduce((n, k) => n + k.text.length, 0);
    expect(total).toBeLessThanOrEqual(10_000 + kept.length); // + the ellipses
  });

  it("preserves order", () => {
    const messages = [msg(0, { text: "a" }), msg(1, { text: "b".repeat(9000) }), msg(2, { text: "c" })];
    const { kept } = truncateFairly({ messages, maxChars: 100 });
    expect(kept.map((k) => k.message.id)).toEqual(["m0", "m1", "m2"]);
  });
});

describe("digest prompt", () => {
  it("returns nothing when there is nothing worth summarising", () => {
    expect(buildDigestPrompt([])).toBeNull();
    expect(buildDigestPrompt([msg(0, { text: "   " })])).toBeNull();
  });

  it("carries a previous digest forward instead of re-reading history", () => {
    const prompt = buildDigestPrompt([msg(0, { text: "new thing" })], {
      text: "the user prefers pnpm",
      throughMessageId: "m-old",
      messageCount: 10,
      at: 1,
    });
    expect(prompt!.text).toContain("the user prefers pnpm");
    expect(prompt!.text).toContain("new thing");
  });

  it("names the last message it covers, so the next fold resumes there", () => {
    const prompt = buildDigestPrompt([msg(0), msg(1), msg(2)]);
    expect(prompt!.throughMessageId).toBe("m2");
    expect(prompt!.messageCount).toBe(3);
  });

  it("stays inside one turn even against an absurd thread", () => {
    const huge = Array.from({ length: 500 }, (_, i) => msg(i, { text: "z".repeat(20_000) }));
    const prompt = buildDigestPrompt(huge)!;
    expect(prompt.text.length).toBeLessThanOrEqual(240_000);
    expect(prompt.truncatedMessages).toBeGreaterThan(0);
  });

  it("records a tool-only message as an action rather than dropping it", () => {
    const prompt = buildDigestPrompt([msg(0, { text: "", tool: { name: "Bash" } })])!;
    expect(prompt.text).toContain("ran Bash");
  });
});

describe("system block", () => {
  it("says nothing when there is no digest", () => {
    expect(digestSystemBlock(undefined)).toBe("");
    expect(digestSystemBlock({ text: "  ", throughMessageId: "m1", messageCount: 1, at: 1 })).toBe("");
  });

  it("tells the bot this is knowledge, not transcript", () => {
    const block = digestSystemBlock({
      text: "chose pnpm",
      throughMessageId: "m1",
      messageCount: 1,
      at: 1,
    });
    expect(block).toContain("chose pnpm");
    expect(block).toMatch(/already know/i);
  });
});
