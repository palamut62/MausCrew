import { describe, expect, it } from "vitest";
import {
  extractGrokBotPreview,
  findDeepLinkUrl,
  parseDeepLinkBot,
  parseGrokBotTemplateId,
} from "./deep-link.mjs";

describe("findDeepLinkUrl", () => {
  it("picks the mauscrew:// entry out of argv", () => {
    expect(findDeepLinkUrl(["MausCrew.exe", "--flag", "mauscrew://bot/add?name=Otto"])).toBe(
      "mauscrew://bot/add?name=Otto",
    );
  });

  it("picks the grokbot:// entry out of argv", () => {
    expect(
      findDeepLinkUrl(["MausCrew.exe", "grokbot://app/v1/bot-template?id=abc123"]),
    ).toBe("grokbot://app/v1/bot-template?id=abc123");
  });

  it("returns null when argv carries no deep link", () => {
    expect(findDeepLinkUrl(["MausCrew.exe", "--flag"])).toBeNull();
  });

  it("ignores a bare mention that isn't the scheme prefix", () => {
    expect(findDeepLinkUrl(["--source=mauscrew://bot/add?name=Otto"])).toBeNull();
  });
});

describe("parseDeepLinkBot", () => {
  it("extracts name, title, and description", () => {
    expect(
      parseDeepLinkBot("mauscrew://bot/add?name=Otto&title=Developer&description=Writes+code"),
    ).toEqual({ name: "Otto", title: "Developer", description: "Writes code" });
  });

  it("defaults title and description to empty strings when absent", () => {
    expect(parseDeepLinkBot("mauscrew://bot/add?name=Otto")).toEqual({
      name: "Otto",
      title: "",
      description: "",
    });
  });

  it("rejects a missing name", () => {
    expect(parseDeepLinkBot("mauscrew://bot/add?title=Developer")).toBeNull();
  });

  it("rejects a blank name", () => {
    expect(parseDeepLinkBot("mauscrew://bot/add?name=+++")).toBeNull();
  });

  it("rejects the wrong scheme", () => {
    expect(parseDeepLinkBot("grokbot://bot/add?name=Otto")).toBeNull();
  });

  it("rejects a mauscrew:// link that isn't bot/add", () => {
    expect(parseDeepLinkBot("mauscrew://settings/open")).toBeNull();
  });

  it("rejects garbage input", () => {
    expect(parseDeepLinkBot("not a url")).toBeNull();
  });

  it("caps name, title, and description length", () => {
    const long = "x".repeat(5000);
    const result = parseDeepLinkBot(
      `mauscrew://bot/add?name=${long}&title=${long}&description=${long}`,
    );
    expect(result?.name.length).toBe(64);
    expect(result?.title.length).toBe(200);
    expect(result?.description.length).toBe(4000);
  });
});

describe("parseGrokBotTemplateId", () => {
  it("extracts the id from the official Add to Grok Bot link shape", () => {
    expect(parseGrokBotTemplateId("grokbot://app/v1/bot-template?id=aaqCOb-3SE48_7qAEAzAf")).toBe(
      "aaqCOb-3SE48_7qAEAzAf",
    );
  });

  it("rejects a missing id", () => {
    expect(parseGrokBotTemplateId("grokbot://app/v1/bot-template")).toBeNull();
  });

  it("rejects an id with characters outside the observed charset", () => {
    expect(parseGrokBotTemplateId("grokbot://app/v1/bot-template?id=..%2Fetc%2Fpasswd")).toBeNull();
  });

  it("rejects a grokbot:// link that isn't app/v1/bot-template", () => {
    expect(parseGrokBotTemplateId("grokbot://app/v2/bot-template?id=abc")).toBeNull();
  });

  it("rejects the wrong scheme", () => {
    expect(parseGrokBotTemplateId("mauscrew://app/v1/bot-template?id=abc")).toBeNull();
  });

  it("rejects garbage input", () => {
    expect(parseGrokBotTemplateId("not a url")).toBeNull();
  });
});

describe("extractGrokBotPreview", () => {
  // A trimmed slice of the real shape: x.ai renders the bot detail page as a
  // Next.js React Server Component stream, and the fetched props land in a
  // `self.__next_f.push([1, "...json-escaped..."])` call.
  const rscFixture = String.raw`<script>self.__next_f.push([1,"2b:{\"state\":{\"data\":{\"id\":\"aaqCOb-3SE48_7qAEAzAf\",\"sharerName\":\"Josh Kim\",\"botName\":\"overnight shipper\",\"description\":\"Night-shift coding bot for one SaaS.\",\"addHref\":\"grokbot://app/v1/bot-template?id=aaqCOb-3SE48_7qAEAzAf\"}}}"])</script>`;

  it("reads name, description, and sharer from the embedded RSC JSON", () => {
    expect(extractGrokBotPreview(rscFixture)).toEqual({
      name: "overnight shipper",
      description: "Night-shift coding bot for one SaaS.",
      sharerName: "Josh Kim",
    });
  });

  it("falls back to Open Graph meta tags when the RSC JSON is absent", () => {
    const html =
      '<meta property="og:title" content="overnight shipper by Josh"/>' +
      '<meta property="og:description" content="Night-shift coding bot for one SaaS."/>';
    expect(extractGrokBotPreview(html)).toEqual({
      name: "overnight shipper",
      description: "Night-shift coding bot for one SaaS.",
      sharerName: "Josh",
    });
  });

  it("keeps the whole og:title when there is no ' by ' separator", () => {
    const html = '<meta property="og:title" content="overnight shipper"/>';
    expect(extractGrokBotPreview(html)).toEqual({
      name: "overnight shipper",
      description: "",
      sharerName: "",
    });
  });

  it("decodes HTML entities in the Open Graph fallback", () => {
    const html = '<meta property="og:title" content="Alice &amp; Bob&#39;s bot by Alice"/>';
    expect(extractGrokBotPreview(html)).toEqual({
      name: "Alice & Bob's bot",
      description: "",
      sharerName: "Alice",
    });
  });

  it("returns null when neither source has a name", () => {
    expect(extractGrokBotPreview("<html><body>nothing here</body></html>")).toBeNull();
  });

  it("returns null for non-string input", () => {
    expect(extractGrokBotPreview(null)).toBeNull();
    expect(extractGrokBotPreview(undefined)).toBeNull();
  });
});
