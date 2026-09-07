// Browser acceptance for the task-memory / handover / verified-completion
// features, driven against the fixture harness:
//
//   node scripts/browser-fixture.mjs      # terminal 1 (port 18859)
//   node scripts/browser-acceptance.mjs   # terminal 2
//
// The fixture serves `dist`, so run `pnpm build` after changing the frontend.
// Covered: task memory add/correct/delete and its source-message link, the
// handover queue, an engine evaluation scored against its criterion, and a work
// card moving from "reported" to "user verified" with stored evidence.
//
// Skips (exit 0) when playwright or its chromium build is unavailable — this is
// a local acceptance run, not a declared dependency of the package.
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const BASE = process.env.MAUSCREW_ACCEPTANCE_BASE ?? "http://127.0.0.1:18859";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.log("skip: playwright is not installed");
  process.exit(0);
}

/** Playwright's own registry first; fall back to whatever chromium build the
 * shared cache actually has, since its revision moves independently of us. */
function browserPath() {
  try {
    const path = chromium.executablePath();
    if (existsSync(path)) return undefined; // the default launch will find it
  } catch {
    /* no registry entry for this playwright build */
  }
  const cache =
    process.platform === "win32"
      ? join(process.env.LOCALAPPDATA ?? join(homedir(), "AppData/Local"), "ms-playwright")
      : process.platform === "darwin"
        ? join(homedir(), "Library/Caches/ms-playwright")
        : join(homedir(), ".cache/ms-playwright");
  if (!existsSync(cache)) return null;
  const build = readdirSync(cache).filter((n) => /^chromium-\d+$/.test(n)).sort().at(-1);
  if (!build) return null;
  for (const rel of ["chrome-win64/chrome.exe", "chrome-mac/Chromium.app/Contents/MacOS/Chromium", "chrome-linux/chrome"]) {
    const candidate = join(cache, build, rel);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

async function api(path, method = "GET", body) {
  const r = await fetch(BASE + path, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json();
  assert.ok(r.ok, `${method} ${path} -> ${JSON.stringify(d)}`);
  return d;
}

let bots;
try {
  bots = await api("/api/bots");
} catch (e) {
  console.log(`skip: no fixture harness on ${BASE} (${e.message})`);
  process.exit(0);
}
const bot = bots.bots[0];
assert.ok(bot, "fixture harness has no bot");

const instance = (await api("/api/instances")).instances[0];
// A real CLI here means the fixture's fake one did not load; an evaluation run
// would then spend the user's actual account.
assert.equal(instance.snapshot.version, "fixture 1.0", "fixture is not using its fake CLI");

const executablePath = browserPath();
if (executablePath === null) {
  console.log("skip: no chromium build available for playwright");
  process.exit(0);
}

const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(15000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

const openBotSettings = () => page.locator('button[title="Bot settings"]').click();
const pass = (m) => console.log("PASS", m);

try {
  await page.goto(BASE);
  await page.getByRole("button", { name: "Maybe later", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  // --- task memory: add, correct, delete ---------------------------------
  await openBotSettings();
  const memory = page.getByRole("region", { name: "Görev hafızası" });
  await memory.getByLabel("Hafıza notu").fill("UI acceptance decision");
  await memory.getByRole("button", { name: "Not ekle", exact: true }).click();
  await memory.getByText("UI acceptance decision", { exact: true }).waitFor();
  await memory.getByRole("button", { name: "Düzenle", exact: true }).last().click();
  await memory.getByLabel("Hafıza notu").fill("Corrected UI acceptance");
  await memory.getByRole("button", { name: "Kaydet", exact: true }).click();
  await memory.getByText("Corrected UI acceptance", { exact: true }).waitFor();
  await memory.getByRole("button", { name: "Sil", exact: true }).last().click();
  await memory.getByText("Corrected UI acceptance", { exact: true }).waitFor({ state: "hidden" });
  pass("task memory add / correct / delete");

  await api(`/api/bots/${bot.id}/tasks/${bot.threadId}/memory`, "POST", {
    kind: "decision",
    text: "Source link acceptance",
    sourceMessageId: "smoke-10",
  });
  await page.reload();
  await openBotSettings();
  await memory.getByText("Source link acceptance", { exact: true }).waitFor();
  pass("memory entry survives a reload");

  // --- source-message link, and the reload that used to follow it ---------
  await page.getByRole("button", { name: "Kaynak mesaja git" }).first().click();
  await page.locator("#message-smoke-10").waitFor();
  pass("source navigation reaches the archived message");

  assert.equal(
    await page.evaluate(() => sessionStorage.getItem("mauscrew:jump-message")),
    null,
    "a handled jump left its sessionStorage fallback behind",
  );
  await page.reload();
  await page.waitForTimeout(2000);
  assert.equal(await page.locator("#message-smoke-1000").count(), 1, "reload did not open the newest messages");
  assert.equal(await page.locator("#message-smoke-10").count(), 0, "reload was pinned to the jumped-to message");
  pass("a reload after a jump still opens the newest messages");

  // --- engine evaluation scored against its criterion ---------------------
  await openBotSettings();
  const ops = page.getByRole("region", { name: "Bot değerlendirmesi" });
  await ops.getByRole("button", { name: "Bu botla değerlendirmeyi çalıştır" }).click();
  await ops.getByText(/Ölçüt karşılanmadı/).first().waitFor({ timeout: 30000 });
  const result = (await api("/api/evaluations")).results.at(-1);
  assert.equal(result.status, "failed", "an answer that misses the criterion must not count as success");
  await ops.getByText(new RegExp(`Token giriş/çıkış: ${result.inputTokens} / ${result.outputTokens}`)).first().waitFor();
  pass(`evaluation: criterion unmet, ${result.inputTokens}/${result.outputTokens} tokens, ${result.durationMs}ms`);

  // --- handover queue ------------------------------------------------------
  await page.getByRole("region", { name: "İş devri kuyruğu" }).waitFor();
  const queue = await api("/api/delegations");
  assert.ok(Array.isArray(queue.items), "handover queue is not served");
  pass(`handover queue reachable (${queue.items.length} job(s))`);

  // --- work card: reported -> user verified -------------------------------
  await api(`/api/bots/${bot.id}/messages`, "POST", { text: "Fixture task for verification" });
  for (let i = 0; i < 80; i++) {
    const current = (await api("/api/bots")).bots.find((b) => b.id === bot.id);
    if (!current.busy) break;
    await page.waitForTimeout(200);
  }
  const cardId = (await api(`/api/threads/${bot.threadId}/window?`)).messages
    .filter((m) => m.ui?.component === "live-work")
    .at(-1)?.id;
  assert.ok(cardId, "the turn produced no work card");

  await page.reload();
  const card = page.locator(`#message-${cardId}`).getByRole("article", { name: "Görev durumu" });
  await card.getByText("Tamamlandı bildirildi", { exact: true }).waitFor();
  await card.getByText("Henüz doğrulanmadı", { exact: true }).waitFor();
  pass("work card shows owner, wait reason, next step and the reported state");

  await card.getByRole("button", { name: "Sonucu doğrula" }).click();
  await card.getByLabel("Doğrulama kanıtı").fill("Fixture result inspected: done from the fake engine");
  await card.getByRole("button", { name: "Kontrol ettim, doğrulamayı kaydet" }).click();
  await card.getByText("Doğrulandı", { exact: true }).waitFor();
  await card.getByText("Kullanıcı doğruladı", { exact: true }).waitFor();
  const stored = (await api(`/api/threads/${bot.threadId}/window?`)).messages.find((m) => m.id === cardId);
  assert.equal(stored.ui.props.verification, "user");
  assert.ok(stored.ui.props.evidence?.note, "the verification was stored without evidence");
  pass("reported completion becomes user-verified, with the evidence kept");

  assert.equal(errors.length, 0, `page errors:\n${errors.join("\n")}`);
  console.log("\nall browser acceptance checks passed");
} catch (e) {
  console.log("FAIL", e.message);
  console.log("visible tail:", (await page.locator("body").innerText()).slice(-1200).replace(/\s+/g, " "));
  process.exitCode = 1;
} finally {
  await browser.close();
}
