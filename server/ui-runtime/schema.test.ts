import { describe, expect, it } from "vitest";

import { extractStructuredUi, validateStructuredUi } from "./schema.ts";

describe("structured UI schema", () => {
  it("extracts a registered component and keeps fallback prose", () => {
    expect(extractStructuredUi('Build finished.\n```mauscrew-ui\n{"component":"progress","props":{"title":"Tests","value":140}}\n```'))
      .toEqual({ text: "Build finished.", ui: { component: "progress", props: { title: "Tests", value: 100 } } });
  });

  it("keeps invalid or arbitrary components as inert markdown", () => {
    const reply = '```mauscrew-ui\n{"component":"script","props":{"code":"alert(1)"}}\n```';
    expect(extractStructuredUi(reply)).toEqual({ text: reply });
  });

  it("accepts a file list and fills a missing name from the path", () => {
    const ui = validateStructuredUi({
      component: "file-list",
      props: {
        title: "Produced",
        items: [
          { path: "/home/u/reports/q3.xlsx", kind: "xlsx", bytes: 20_480, note: "Quarterly totals" },
          { name: "notes.md" },
        ],
      },
    });
    expect(ui).toEqual({
      component: "file-list",
      props: {
        title: "Produced",
        items: [
          { name: "q3.xlsx", path: "/home/u/reports/q3.xlsx", kind: "xlsx", bytes: 20_480, note: "Quarterly totals" },
          { name: "notes.md" },
        ],
      },
    });
  });

  it("rejects a file list with nothing nameable in it", () => {
    expect(() => validateStructuredUi({ component: "file-list", props: { items: [{ note: "no name, no path" }] } }))
      .toThrow("file-list needs at least one named item");
  });

  it("bounds table shape and converts object cells to text", () => {
    const ui = validateStructuredUi({ component: "table", props: { columns: ["A"], rows: [[{ nested: true }]] } });
    expect(ui).toEqual({ component: "table", props: { columns: ["A"], rows: [["{\"nested\":true}"]] } });
  });
});
