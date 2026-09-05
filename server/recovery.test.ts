import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { readManagedJson, writeManagedJson, needsRecovery, recoveryIssues, restoreLastGood, validRecords } from "./recovery.ts";
it("protects damaged originals and restores the last valid generation", () => {
  const file = join(mkdtempSync(join(tmpdir(), "recovery-")), "bots.json");
  writeManagedJson(file, [{ id: "old" }]);
  writeManagedJson(file, [{ id: "new" }]);
  writeFileSync(file, "{broken");
  expect(readManagedJson(file, [], validRecords)).toEqual([]);
  expect(needsRecovery(file)).toBe(true);
  expect(() => writeManagedJson(file, [])).toThrow();
  expect(readFileSync(file, "utf8")).toBe("{broken");
  const issue = recoveryIssues().find((r) => r.file === "bots.json")!;
  restoreLastGood(issue.id);
  expect(JSON.parse(readFileSync(file, "utf8"))).toEqual([{ id: "old" }]);
  expect(needsRecovery(file)).toBe(true);
});
it("locks syntactically valid but unusable records instead of overwriting them", () => {
  const file = join(mkdtempSync(join(tmpdir(), "recovery-")), "bad.json");
  writeFileSync(file, "[null]");
  expect(readManagedJson(file, [], validRecords)).toEqual([]);
  expect(() => writeManagedJson(file, [])).toThrow();
});
