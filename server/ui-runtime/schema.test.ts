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

  it("bounds table shape and converts object cells to text", () => {
    const ui = validateStructuredUi({ component: "table", props: { columns: ["A"], rows: [[{ nested: true }]] } });
    expect(ui).toEqual({ component: "table", props: { columns: ["A"], rows: [["{\"nested\":true}"]] } });
  });
});
