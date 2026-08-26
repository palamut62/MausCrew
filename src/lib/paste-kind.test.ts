// A wrong label is worse than no label — telling the model a log is a diff
// sends it looking for hunks that do not exist. So these tests care as much
// about what is NOT detected as what is.
import { describe, expect, it } from "vitest";

import { analysePaste, pasteGuidance } from "./paste-kind";

describe("recognising what was pasted", () => {
  it("reads a stack trace, not just the code in it", () => {
    const node = `TypeError: Cannot read properties of undefined (reading 'id')
    at resolveBot (C:/app/server/store.ts:412:19)
    at handleTurn (C:/app/server/index.ts:1108:7)`;
    expect(analysePaste(node).kind).toBe("stack-trace");

    const python = `Traceback (most recent call last):
  File "main.py", line 22, in <module>
    run()
ValueError: bad input`;
    expect(analysePaste(python).kind).toBe("stack-trace");
  });

  it("reads a diff", () => {
    const diff = `diff --git a/server/store.ts b/server/store.ts
@@ -10,7 +10,7 @@
-  const old = 1;
+  const next = 2;`;
    expect(analysePaste(diff).kind).toBe("diff");
  });

  it("reads JSON only when it actually parses", () => {
    expect(analysePaste('{"ok":true,"items":[1,2,3]}').kind).toBe("json");
    // shaped like JSON, is not JSON — mislabelling this sends the model
    // looking for fields that are not there
    expect(analysePaste('{ok: true, trailing,}').kind).not.toBe("json");
  });

  it("reads separated values only when the shape repeats", () => {
    expect(analysePaste("name,count,city\nada,3,izmir\nbo,5,ankara").kind).toBe("csv");
    // one comma in a sentence is prose
    expect(analysePaste("Hello, world").kind).toBe("text");
    expect(analysePaste("Ada said this, and then left").kind).toBe("text");
  });

  it("reads logs", () => {
    const log = `2026-08-26T09:01:02Z INFO  server started
2026-08-26T09:01:03Z WARN  slow query
2026-08-26T09:01:04Z ERROR timeout`;
    expect(analysePaste(log).kind).toBe("log");
  });

  it("reads a markdown table and a list of links", () => {
    expect(analysePaste("| a | b |\n| --- | --- |\n| 1 | 2 |").kind).toBe("markdown-table");
    expect(analysePaste("https://one.example\nhttps://two.example").kind).toBe("urls");
    // a link inside a sentence is not a link list
    expect(analysePaste("see https://one.example for details").kind).toBe("text");
  });

  it("names a language only when the guess is unambiguous", () => {
    const ts = analysePaste("export interface Bot {\n  id: string;\n}");
    expect(ts.kind).toBe("code");
    expect(ts.language).toBe("typescript");

    const py = analysePaste("def run(items):\n    return [i for i in items]");
    expect(py.language).toBe("python");

    // matches both shell and javascript hints: say nothing rather than guess
    const mixed = analysePaste("npm install\nconst x = require('y');");
    expect(mixed.language).toBeUndefined();
  });

  it("falls back to plain text, which is where it started", () => {
    expect(analysePaste("Just a paragraph of ordinary writing.").kind).toBe("text");
    expect(analysePaste("").kind).toBe("text");
    expect(analysePaste("   \n  \n").kind).toBe("text");
  });

  it("prefers the most specific reading when kinds overlap", () => {
    // a stack trace is also code; a diff of JSON is still a diff
    const traceWithCode = `Error: boom
    at run (app.ts:3:1)
export const x = 1;`;
    expect(analysePaste(traceWithCode).kind).toBe("stack-trace");
    const jsonDiff = `diff --git a/a.json b/a.json
@@ -1 +1 @@
-{"a":1}
+{"a":2}`;
    expect(analysePaste(jsonDiff).kind).toBe("diff");
  });

  it("only explains the kinds where explaining helps", () => {
    expect(pasteGuidance("diff")).toMatch(/removed/);
    expect(pasteGuidance("stack-trace")).toMatch(/top frame/i);
    // a language-tagged code block speaks for itself
    expect(pasteGuidance("code")).toBeUndefined();
    expect(pasteGuidance("text")).toBeUndefined();
  });
});
