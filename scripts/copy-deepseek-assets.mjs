// Copy the DeepSeek Harness bridge's non-TypeScript assets into dist-server.
//
// `build:server` runs `tsc`, which only emits `.js` for `.ts` sources. Three
// files under server/bridges/deepseek/ are not TypeScript and tsc silently
// drops them:
//
//   bridge.py               — the Python bridge process-manager.ts spawns
//   mauscrew.cordis.yml     — the bundled Cordis composition config.ts points at
//   mauscrew-approval.mjs   — the Cordis pre-execute plugin the config references
//
// In dev this is invisible: server/index.ts runs from source, so the files
// are just sitting next to the .ts that reference them. In a packaged build
// only dist-server ships (see extraResources in electron-builder.yml), so
// without this step the driver starts, points DSH_CORDIS_CONFIG at a file
// that was never copied, and the runtime fails to boot with a confusing
// upstream error instead of ours.
//
// requirements-deepseek.txt and README.md are documentation for the person
// setting up the Python environment, not runtime dependencies — they stay in
// the source tree and are not copied.
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "server", "bridges", "deepseek");
const destDir = join(root, "dist-server", "bridges", "deepseek");

const ASSETS = ["bridge.py", "mauscrew.cordis.yml", "mauscrew-approval.mjs", "mauscrew-approval.d.mts"];

await mkdir(destDir, { recursive: true });
for (const name of ASSETS) {
  await copyFile(join(srcDir, name), join(destDir, name));
}

console.log(`[copy-deepseek-assets] copied ${ASSETS.length} file(s) to ${destDir}`);
