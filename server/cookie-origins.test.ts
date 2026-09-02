import { describe, expect, it } from "vitest";

import { originsFromCookies } from "./cookie-origins.ts";

describe("profile sign-in list", () => {
  it("folds a leading dot into the same site and sorts the result", () => {
    expect(originsFromCookies([
      { domain: ".github.com" },
      { domain: "github.com" },
      { domain: "accounts.google.com" },
    ])).toEqual(["accounts.google.com", "github.com"]);
  });

  it("reads nothing but the domain", () => {
    // A cookie's name and value are the session itself. Whatever else a
    // cookie object carries must not end up in a list the UI renders.
    const cookies = [{ domain: "example.com", name: "session", value: "super-secret", path: "/" }];
    expect(JSON.stringify(originsFromCookies(cookies))).not.toContain("super-secret");
    expect(originsFromCookies(cookies)).toEqual(["example.com"]);
  });

  it("drops entries with no domain rather than inventing one", () => {
    expect(originsFromCookies([{ domain: "" }, { domain: "   " }, {}])).toEqual([]);
  });

  it("normalizes case, so one site is one entry", () => {
    expect(originsFromCookies([{ domain: "GitHub.com" }, { domain: "github.com" }])).toEqual(["github.com"]);
  });
});
