// Packaging (spec §67, §68; P4-11).
//
// The failure this file exists to prevent has no other detector. `tsc` emits
// `.js` for `.ts` and silently ignores everything else, so a Python script, a
// YAML composition and a plain-`.mjs` Cordis plugin can all vanish from
// dist-server without one compile warning. Dev never notices — the server runs
// from source, and the files are sitting right next to the code that names
// them. Only the packaged app breaks, and it breaks as an upstream boot error
// from a runtime that could not read its composition.
//
// So the assertions here are about agreement between three places that have no
// other way to stay in sync: the asset list in the copy script, the files that
// actually exist in the bridge directory, and the paths the driver computes at
// runtime.
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { BUNDLED_CORDIS_CONFIG } from "./config.ts";

const here = dirname(fileURLToPath(import.meta.url));
const serverRoot = join(here, "..", "..");
const appRoot = join(serverRoot, "..");
const bridgeDir = join(serverRoot, "bridges", "deepseek");
const copyScript = join(appRoot, "scripts", "copy-deepseek-assets.mjs");

/** The asset list, read out of the script rather than duplicated here — a
 * copy of the list would pass while the script shipped nothing. */
function copiedAssets(): string[] {
  const source = readFileSync(copyScript, "utf8");
  const match = /const ASSETS = \[([^\]]*)\]/.exec(source);
  expect(match, "copy-deepseek-assets.mjs no longer declares an ASSETS array").toBeTruthy();
  return [...match![1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

/** Files that are documentation for whoever sets the bridge up, not inputs to
 * a running process. Shipping them would be harmless; the point of naming
 * them is that a NEW non-TypeScript file gets noticed instead of being
 * absorbed by a wildcard. */
const DOCS_ONLY = new Set([
  "README.md",
  "requirements-deepseek.txt",
  // Compliance artifacts (P4-12). No process reads them; they describe what
  // the bridge depends on and under which licences.
  "THIRD-PARTY-NOTICES.md",
  "sbom.json",
]);

describe("deepseek bridge assets reach dist-server", () => {
  it("is wired into build:server, not just present in the scripts directory", () => {
    const pkg = JSON.parse(readFileSync(join(appRoot, "package.json"), "utf8"));
    expect(pkg.scripts["build:server"]).toContain("copy-deepseek-assets.mjs");
  });

  it("copies every non-TypeScript file the runtime needs", () => {
    const assets = new Set(copiedAssets());
    const missed = readdirSync(bridgeDir).filter(
      (name) => !name.endsWith(".ts") && !DOCS_ONLY.has(name) && !assets.has(name),
    );
    expect(
      missed,
      `new non-TypeScript files in server/bridges/deepseek — add them to ASSETS in scripts/copy-deepseek-assets.mjs, or to DOCS_ONLY here if they are documentation`,
    ).toEqual([]);
  });

  it("copies nothing that is not there", () => {
    const present = new Set(readdirSync(bridgeDir));
    for (const asset of copiedAssets()) {
      expect(present.has(asset), `${asset} is in ASSETS but not in server/bridges/deepseek`).toBe(true);
    }
  });

  it("copies to the directory the driver will look in", () => {
    // config.ts computes the composition path from import.meta.url, so in
    // dist-server it resolves to <dist-server>/bridges/deepseek/…. The copy
    // script writes exactly there. If either side moves, the packaged app
    // points DSH_CORDIS_CONFIG at a file that was never written.
    const fromServerRoot = relative(serverRoot, BUNDLED_CORDIS_CONFIG).split(sep).join("/");
    expect(fromServerRoot).toBe("bridges/deepseek/mauscrew.cordis.yml");
    expect(readFileSync(copyScript, "utf8")).toContain('join(root, "dist-server", "bridges", "deepseek")');
  });

  it("ships the approval plugin the bundled composition names", () => {
    // The composition resolves './mauscrew-approval.mjs' beside itself. A
    // composition that ships without its plugin is worse than no gate: the
    // runtime refuses to boot, so the bot is simply broken.
    const composition = readFileSync(BUNDLED_CORDIS_CONFIG, "utf8");
    const referenced = [...composition.matchAll(/name:\s*'\.\/([^']+)'/g)].map((m) => m[1]);
    expect(referenced).toContain("mauscrew-approval.mjs");
    const assets = new Set(copiedAssets());
    for (const name of referenced) expect(assets.has(name), `${name} is composed but never copied`).toBe(true);
  });
});
