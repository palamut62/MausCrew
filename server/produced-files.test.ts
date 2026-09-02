import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { containedBy, fileListItems, resolveProducedFile } from "./produced-files.ts";

let root: string;
let workspace: string;
let outside: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "mauscrew-produced-"));
  workspace = join(root, "workspace");
  outside = join(root, "secrets");
  mkdirSync(workspace, { recursive: true });
  mkdirSync(outside, { recursive: true });
  writeFileSync(join(workspace, "report.xlsx"), "spreadsheet bytes");
  writeFileSync(join(outside, "id_rsa"), "PRIVATE KEY");
  mkdirSync(join(workspace, "nested"), { recursive: true });
  writeFileSync(join(workspace, "nested", "deep.pdf"), "pdf");
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("produced files", () => {
  it("releases a file the bot wrote inside its workspace", () => {
    const file = resolveProducedFile(join(workspace, "report.xlsx"), [workspace]);
    expect(file).toMatchObject({ bytes: "spreadsheet bytes".length });
    expect(resolveProducedFile(join(workspace, "nested", "deep.pdf"), [workspace])).not.toBeNull();
  });

  it("refuses a path outside every workspace", () => {
    // The case that matters: a bot that read a hostile page and came back
    // calling someone's private key its "report".
    expect(resolveProducedFile(join(outside, "id_rsa"), [workspace])).toBeNull();
    expect(resolveProducedFile(join(workspace, "..", "secrets", "id_rsa"), [workspace])).toBeNull();
  });

  it("refuses a symlink that points out of the workspace", () => {
    // A string comparison on the announced path would pass this: the link
    // itself is inside. Resolving first is the whole point.
    const link = join(workspace, "innocent.txt");
    try {
      symlinkSync(join(outside, "id_rsa"), link);
    } catch {
      return; // Windows without developer mode cannot create symlinks.
    }
    expect(resolveProducedFile(link, [workspace])).toBeNull();
  });

  it("refuses directories, missing files and relative paths", () => {
    expect(resolveProducedFile(workspace, [workspace])).toBeNull();
    expect(resolveProducedFile(join(workspace, "nope.pdf"), [workspace])).toBeNull();
    expect(resolveProducedFile("report.xlsx", [workspace])).toBeNull();
    expect(resolveProducedFile("", [workspace])).toBeNull();
  });

  it("refuses a file bigger than the caller can carry", () => {
    expect(resolveProducedFile(join(workspace, "report.xlsx"), [workspace], { maxBytes: 4 })).toBeNull();
    expect(resolveProducedFile(join(workspace, "report.xlsx"), [workspace], { maxBytes: 4_096 })).not.toBeNull();
  });

  it("accepts any of several workspaces, and refuses when there are none", () => {
    expect(resolveProducedFile(join(workspace, "report.xlsx"), [outside, workspace])).not.toBeNull();
    expect(resolveProducedFile(join(workspace, "report.xlsx"), [])).toBeNull();
    // A blank or relative root must not become "everything".
    expect(resolveProducedFile(join(workspace, "report.xlsx"), ["", "  ", "relative"])).toBeNull();
  });

  it("treats the root itself as not a file", () => {
    expect(containedBy(workspace, workspace)).toBe(false);
    expect(containedBy(join(workspace, "report.xlsx"), workspace)).toBe(true);
  });

  it("reads the items out of a file-list block and ignores anything else", () => {
    expect(fileListItems({ component: "file-list", props: { items: [{ name: "a.pdf", path: "/tmp/a.pdf" }] } }))
      .toEqual([{ name: "a.pdf", path: "/tmp/a.pdf" }]);
    // A name is optional; the path's last segment stands in.
    expect(fileListItems({ component: "file-list", props: { items: [{ path: "/tmp/b.xlsx" }] } }))
      .toEqual([{ name: "b.xlsx", path: "/tmp/b.xlsx" }]);
    expect(fileListItems({ component: "table", props: { items: [{ path: "/tmp/a" }] } })).toEqual([]);
    expect(fileListItems(null)).toEqual([]);
    expect(fileListItems({ component: "file-list", props: { items: [{ name: "no path" }] } })).toEqual([]);
  });
});
