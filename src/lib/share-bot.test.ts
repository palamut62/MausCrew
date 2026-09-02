import { describe, expect, it } from "vitest";

import { botShareLink } from "./share-bot";
// The parser on the receiving side, imported rather than restated: a link
// this app emits that its own importer rejects is the failure worth catching.
// @ts-expect-error -- plain ESM shared with the Electron main process; no types
import { parseDeepLinkBot } from "../../electron/deep-link.mjs";

describe("bot share links", () => {
  it("round-trips through the import parser the receiving app uses", () => {
    const link = botShareLink({ name: "Reviewer", title: "Review", description: "Reads the diff & says no" });
    expect(link.startsWith("mauscrew://bot/add?")).toBe(true);
    expect(parseDeepLinkBot(link)).toEqual({
      name: "Reviewer",
      title: "Review",
      description: "Reads the diff & says no",
    });
  });

  it("omits empty fields rather than sending blanks", () => {
    expect(botShareLink({ name: "Solo" })).toBe("mauscrew://bot/add?name=Solo");
  });

  it("truncates a long description instead of producing an unusable link", () => {
    const link = botShareLink({ name: "Verbose", description: "x".repeat(5000) });
    const description = new URL(link).searchParams.get("description") ?? "";
    expect(description).toHaveLength(1200);
    expect(description.endsWith("…")).toBe(true);
  });

  it("carries nothing but the profile", () => {
    const link = botShareLink({ name: "Ada", title: "T", description: "D" });
    expect([...new URL(link).searchParams.keys()].sort()).toEqual(["description", "name", "title"]);
  });
});
