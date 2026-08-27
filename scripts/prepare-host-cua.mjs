// Bundle the Windows Cua SDK bridge and stage its exact native runtime outside
// ASAR. The server process and every agent then launch this self-contained MCP
// adapter with Electron's Node runtime; no system-wide driver is required.
import { copyFile, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "dist-server", "host-cua");

await rm(output, { recursive: true, force: true });
if (process.platform !== "win32") {
  console.log("[prepare-host-cua] skipped: Windows-only native runtime");
  process.exit(0);
}

const nativePackage = await realpath(
  join(root, "node_modules", ".pnpm", "@trycua+cua-driver-win32-x64-msvc@0.20.0", "node_modules", "@trycua", "cua-driver-win32-x64-msvc"),
);
await mkdir(join(output, "native"), { recursive: true });
await Promise.all([
  copyFile(join(nativePackage, "cua_driver_sdk.dll"), join(output, "native", "cua_driver_sdk.dll")),
  copyFile(join(nativePackage, "cua_driver_node_runtime.node"), join(output, "native", "cua_driver_node_runtime.node")),
]);

const bundle = join(output, "host-computer-proxy.mjs");
await build({
  entryPoints: [join(root, "server", "host-computer-proxy.ts")],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  banner: {
    js: 'import { createRequire as __mauscrewCreateRequire } from "node:module"; const require = __mauscrewCreateRequire(import.meta.url);',
  },
  outfile: bundle,
  logLevel: "silent",
});

const source = await readFile(bundle, "utf8");
const resolverPattern = /function resolveLibPath\d*\(opts\) \{/g;
const resolvers = source.match(resolverPattern) ?? [];
if (resolvers.length !== 1) throw new Error(`expected one Cua native resolver, found ${resolvers.length}`);
await writeFile(
  bundle,
  source.replace(
    resolverPattern,
    `${resolvers[0]}\n      if (process.env.MAUSCREW_CUA_SDK_LIBRARY) return resolveOverride(opts.crateName, process.env.MAUSCREW_CUA_SDK_LIBRARY);`,
  ),
);

console.log("[prepare-host-cua] staged native Windows desktop control");
