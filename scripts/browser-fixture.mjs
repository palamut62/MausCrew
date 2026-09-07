import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
const root = resolve(import.meta.dirname, "..");
const data = mkdtempSync(join(tmpdir(), "mauscrew-browser-"));
process.env.MAUSCREW_DATA_DIR = data;
const { Store } = await import("../server/store.ts");
const { WorkflowManager } = await import("../server/workflows.ts");
const { ReviewQueue } = await import("../server/review-queue.ts");
const store = new Store(() => ({ instanceId: "codex", model: "fake-codex-model" }));
const bot = store.createBot({ name: "Smoke Bot", modelSelection: { instanceId: "codex", model: "fake-codex-model" } });
store.patchBot(bot.id, { autoProfile: false, computer: "off" });
const messages = Array.from({ length: 1001 }, (_, i) => ({ id: `smoke-${i}`, parentId: i ? `smoke-${i - 1}` : null, role: i % 2 ? "bot" : "user", kind: "text", text: `Fixture message ${i}${i === 10 ? " unique-search-needle" : ""}`, at: Date.now() - (1001 - i) * 1000 }));
writeFileSync(join(data, `messages-${bot.threadId}.json`), JSON.stringify({ messages, activeLeafId: "smoke-1000" }));
const workflows = new WorkflowManager();
const workflow = workflows.create({ title: "Interrupted fixture workflow", ownerBotId: bot.id, threadId: bot.threadId, steps: [{ title: "Fixture step", assigneeBotId: bot.id }] });
workflows.updateStep(workflow.id, workflow.steps[0].id, { status: "running", output: "Saved progress" });
new ReviewQueue().create({ title: "Fixture draft", target: "Fixture recipient", content: "Fixture body", sourceBotId: bot.id, sourceThreadId: bot.threadId });
const fake = join(data, "fake-cli.mjs");
// The shebang is what keeps this fixture fake: CreateProcess can't exec a bare
// .mjs (spawn EFTYPE), and a driver that can't run its configured CLI falls
// back to the real one on PATH — quietly spending the user's account on a test.
writeFileSync(fake, `#!/usr/bin/env node\nif (process.argv.includes('--version')) { console.log('fixture 1.0'); } else { await import(${JSON.stringify(new URL("../server/testing/fake-codex-app-server.ts", import.meta.url).href)}); }`);
// `cli` belongs under `config` — that is the only key the registry hands to the
// driver's decodeConfig; at the top level it is dropped and the driver falls
// back to the real `codex` on PATH.
writeFileSync(join(data, "config.json"), JSON.stringify({ instances: { codex: { driver: "codex", config: { cli: fake } } }, analytics: { enabled: false } }));
const child = spawn(process.execPath, ["server/index.ts"], { cwd: root, windowsHide: true, env: {
  PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP,
  HOME: data, USERPROFILE: data, MAUSCREW_DATA_DIR: data,
  MAUSCREW_PORT: "18859", MAUSCREW_WEBHOOK_PORT: "18860", MAUSCREW_STATIC_DIR: join(root, "dist"), MAUSCREW_DISABLE_LOCAL_VM: "1", MAUSCREW_DISABLE_ANALYTICS: "1",
}, stdio: "inherit" });
process.on("SIGINT", () => child.kill()); process.on("SIGTERM", () => child.kill());
child.on("exit", (code) => process.exit(code ?? 0));
