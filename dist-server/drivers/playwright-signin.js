// Signing in to a site *before* a bot needs it.
//
// The PC Browser runs in MausCrew's own persistent profile, which is what
// keeps a bot out of the user's everyday Chrome. The cost of that boundary is
// that the profile starts signed into nothing, and the only way it ever gets
// a session is for a bot to hit a login wall mid-task and stop to ask.
//
// This is the other direction: open that exact profile, headed, with nobody
// driving it, and let the person sign in at their own pace. The window is
// theirs — no automation runs against it, and it ends when they close it.
//
// Runs as its own short-lived process so a browser the user leaves open for
// ten minutes is not ten minutes of a harness request being held open.
//
// stdout carries one JSON line when the window closes: the origins the
// profile now holds cookies for. That is what lets Settings say what this
// browser is signed into without opening it again to look.
import { mkdirSync } from "node:fs";
import { originsFromCookies } from "../cookie-origins.js";
const PROFILE_DIR = process.env.MAUSCREW_PLAYWRIGHT_PROFILE ?? "";
const START_URL = process.env.MAUSCREW_SIGNIN_URL ?? "about:blank";
function fail(message) {
    process.stdout.write(`${JSON.stringify({ ok: false, error: message })}\n`);
    process.exit(1);
}
if (!PROFILE_DIR)
    fail("no browser profile was configured");
let chromium;
try {
    ({ chromium } = (await import("playwright")));
}
catch {
    fail("Playwright is not installed. Install it with: npm install -g playwright && npx playwright install chromium");
}
mkdirSync(PROFILE_DIR, { recursive: true });
let context;
try {
    context = await chromium.launchPersistentContext(PROFILE_DIR, {
        headless: false,
        viewport: null,
        args: ["--disable-blink-features=AutomationControlled"],
    });
}
catch (error) {
    // Playwright's launch errors are a screenful of Chromium flags. The person
    // reading this in Settings needs the first line and a next step, not the
    // command line that failed.
    const first = String(error instanceof Error ? error.message : error).split(/\r?\n/)[0].trim();
    fail(/spawn|ENOENT|executable/i.test(first)
        ? `the browser could not be started (${first}). Run: npx playwright install chromium`
        : first);
}
let reported = false;
async function report() {
    if (reported)
        return;
    reported = true;
    let origins = [];
    try {
        origins = originsFromCookies(await context.cookies());
    }
    catch {
        // The context is already gone; an empty list is more honest than a guess.
    }
    process.stdout.write(`${JSON.stringify({ ok: true, origins, at: Date.now() })}\n`);
    process.exit(0);
}
context.on("close", () => void report());
const page = await context.newPage();
if (START_URL !== "about:blank") {
    // A site that is slow or refuses to load is still a window the user can
    // type into; the navigation failing is not a reason to close it.
    await page.goto(START_URL, { waitUntil: "domcontentloaded", timeout: 45_000 }).catch(() => { });
}
// The harness kills this process when the user cancels from Settings.
for (const signal of ["SIGTERM", "SIGINT"]) {
    process.on(signal, () => {
        void context.close().catch(() => { }).finally(() => void report());
    });
}
