// Syntax-check every Electron-side script, found rather than listed.
//
// The old check named seven files by hand while electron/ held fourteen, and
// the list drifted: speech-win.mjs — the Windows dictation bridge — was never
// in it. A glob cannot drift. Written as a Node script rather than a shell
// loop because `pnpm check:electron` runs on the runner's native shell, and
// CI runs it on Windows too.
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ELECTRON_DIR = join(ROOT, "electron");
/** Bundled third-party, not ours to parse or fix. */
const SKIP_DIRS = new Set(["vendor", "resources"]);
const EXTENSIONS = [".mjs", ".cjs", ".js"];

function scripts(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIRS.has(entry)) found.push(...scripts(full));
    } else if (EXTENSIONS.some((ext) => entry.endsWith(ext))) {
      found.push(full);
    }
  }
  return found.sort();
}

const files = scripts(ELECTRON_DIR);
if (files.length === 0) {
  console.error("check-electron: found nothing to check — is electron/ missing?");
  process.exit(1);
}

let failed = 0;
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) {
    failed += 1;
    console.error(`FAIL ${relative(ROOT, file)}`);
    console.error(result.stderr.trim());
  }
}

console.log(`check-electron: ${files.length - failed}/${files.length} parsed`);
process.exit(failed === 0 ? 0 : 1);
