// playwright-proxy — a browser on THIS machine, driven properly.
//
// MausCrew can already work a browser two ways, and both are compromises. On
// the Box it drives Chrome through CDP, which is real automation but happens
// on a cloud VM with none of the user's context. On the local computer it
// clicks pixels, which happens here but has no idea what a button is: it waits
// by sleeping, finds things by looking, and breaks when the page reflows.
//
// This is the third way — Playwright against a browser on the user's own
// machine. It knows when navigation finished, what an element is, and whether
// a click actually landed, so a bot can fill a form on a real site without the
// user watching a cursor guess at coordinates.
//
// Two deliberate limits.
//
// It normally runs in its own profile under the app's data directory, not the
// user's day-to-day Chrome. The only exception is an explicit localhost CDP
// session the user deliberately attached in Settings. That boundary is visible
// in the UI, reversible, and the proxy never closes the attached browser.
//
// Playwright is optional. It is a large dependency and most bots never touch a
// browser, so it is loaded only when used, and its absence is reported as a
// thing to install rather than a crash.
//
// stdout is the MCP channel — never console.log here.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
const PROFILE_DIR = process.env.MAUSCREW_PLAYWRIGHT_PROFILE ?? "";
const HEADLESS = process.env.MAUSCREW_PLAYWRIGHT_HEADLESS === "1";
const CDP_ENDPOINT = process.env.MAUSCREW_PLAYWRIGHT_CDP ?? "";
/** A page that has not settled in this long is not going to. */
const NAV_TIMEOUT_MS = 30_000;
const ACTION_TIMEOUT_MS = 15_000;
/** Enough of a page to answer a question, not enough to flood the turn. */
const MAX_TEXT_CHARS = 20_000;
const MAX_ELEMENTS = 200;
const send = (obj) => process.stdout.write(JSON.stringify(obj) + "\n");
let context = null;
let starting = null;
let attachedToUserBrowser = false;
/** The message a missing dependency should produce: a next step, not a stack. */
const NOT_INSTALLED = "Playwright is not installed, so browser control on this computer is unavailable. Install it with: npm install -g playwright && npx playwright install chromium";
async function browser() {
    if (context)
        return context;
    if (starting)
        return starting;
    starting = (async () => {
        let chromium;
        try {
            ({ chromium } = (await import("playwright")));
        }
        catch {
            throw new Error(NOT_INSTALLED);
        }
        if (CDP_ENDPOINT) {
            const attached = await chromium.connectOverCDP(CDP_ENDPOINT);
            const existing = attached.contexts()[0];
            if (!existing)
                throw new Error("The selected browser has no attachable context");
            attachedToUserBrowser = true;
            context = existing;
            return existing;
        }
        const dir = PROFILE_DIR || join(process.cwd(), ".mauscrew-browser");
        mkdirSync(dir, { recursive: true });
        // Persistent, so a sign-in the user approves once is not asked for again,
        // and separate, so it is only ever the sessions the bot established.
        const created = await chromium.launchPersistentContext(dir, {
            headless: HEADLESS,
            viewport: { width: 1280, height: 800 },
            args: ["--disable-blink-features=AutomationControlled"],
        });
        context = created;
        return created;
    })();
    try {
        return await starting;
    }
    finally {
        starting = null;
    }
}
async function page() {
    const ctx = await browser();
    const existing = ctx.pages();
    const target = existing.length ? existing[existing.length - 1] : await ctx.newPage();
    target.setDefaultTimeout(ACTION_TIMEOUT_MS);
    target.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
    return target;
}
/** Refs are handed out per snapshot and mean nothing after the next one. */
let refs = new Map();
const SNAPSHOT_SCRIPT = `(() => {
  const useful = ['a','button','input','textarea','select','summary','[role=button]','[role=link]','[role=tab]','[role=checkbox]','[role=menuitem]'];
  const out = [];
  let index = 0;
  for (const node of document.querySelectorAll(useful.join(','))) {
    const box = node.getBoundingClientRect();
    if (!box.width || !box.height) continue;
    const style = getComputedStyle(node);
    if (style.visibility === 'hidden' || style.display === 'none') continue;
    const label = (node.getAttribute('aria-label') || node.getAttribute('placeholder') || node.value || node.innerText || node.title || '').replace(/\\s+/g, ' ').trim().slice(0, 140);
    const role = node.getAttribute('role') || node.tagName.toLowerCase();
    node.setAttribute('data-maus-ref', 'p' + index);
    out.push({ ref: 'p' + index, role, label, disabled: node.disabled === true });
    index += 1;
    if (index >= ${MAX_ELEMENTS}) break;
  }
  return { title: document.title, url: location.href, elements: out };
})()`;
async function snapshot() {
    const target = await page();
    const result = (await target.evaluate(SNAPSHOT_SCRIPT));
    refs = new Map(result.elements.map((el) => [el.ref, `[data-maus-ref="${el.ref}"]`]));
    const lines = result.elements.map((el) => `- [${el.ref}] ${el.role}${el.disabled ? " disabled" : ""}: ${el.label || "unnamed"}`);
    return `${result.title || "Untitled"} — ${result.url}\n${lines.join("\n") || "No interactive elements found."}`;
}
function selectorFor(ref) {
    const selector = refs.get(ref);
    if (!selector)
        throw new Error("that ref is stale or unknown — take a new pc_browser_snapshot");
    return selector;
}
const TOOLS = [
    {
        name: "pc_browser_open",
        description: CDP_ENDPOINT
            ? "Open a URL in the browser session the user explicitly attached to MausCrew. Waits for the page to settle and returns what is on it."
            : "Open a URL in a browser running on the user's own computer, in MausCrew's own isolated profile. Waits for the page to settle and returns what is on it.",
        inputSchema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
    },
    {
        name: "pc_browser_snapshot",
        description: "List the interactive elements on the current page with fresh refs. Prefer this over a screenshot: it says what things are, not what they look like.",
        inputSchema: { type: "object", properties: {} },
    },
    {
        name: "pc_browser_click",
        description: "Click one element ref from the most recent snapshot, then return the settled page.",
        inputSchema: { type: "object", properties: { ref: { type: "string" } }, required: ["ref"] },
    },
    {
        name: "pc_browser_fill",
        description: "Type into one field ref from the most recent snapshot, replacing what is there.",
        inputSchema: {
            type: "object",
            properties: { ref: { type: "string" }, text: { type: "string" } },
            required: ["ref", "text"],
        },
    },
    {
        name: "pc_browser_select",
        description: "Choose an option in a dropdown ref. Dropdowns ignore typing and open a menu the page cannot see.",
        inputSchema: {
            type: "object",
            properties: { ref: { type: "string" }, value: { type: "string" } },
            required: ["ref", "value"],
        },
    },
    {
        name: "pc_browser_press",
        description: "Send a key to the page — Enter to submit, Escape to dismiss, Tab to move on.",
        inputSchema: {
            type: "object",
            properties: { key: { type: "string" }, ref: { type: "string" } },
            required: ["key"],
        },
    },
    {
        name: "pc_browser_read",
        description: "Read the visible text of the current page. Use this to read an article or a result, rather than squinting at a screenshot.",
        inputSchema: { type: "object", properties: { max_chars: { type: "number" } } },
    },
    {
        name: "pc_browser_screenshot",
        description: "Take a picture of the current page, for when its layout matters rather than its content.",
        inputSchema: { type: "object", properties: {} },
    },
];
const text = (id, body, isError = false) => send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: body }], isError } });
async function settled(target) {
    // networkidle is the honest signal that a click finished doing whatever it
    // started; without it a snapshot describes the page mid-transition.
    await target.waitForLoadState("networkidle", { timeout: NAV_TIMEOUT_MS }).catch(() => { });
    return snapshot();
}
async function callTool(name, args) {
    if (name === "pc_browser_open") {
        const url = String(args.url ?? "").trim();
        if (!/^https?:\/\//i.test(url))
            return { body: "pc_browser_open needs an http(s) URL.", isError: true };
        const target = await page();
        await target.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
        return { body: await settled(target) };
    }
    if (name === "pc_browser_snapshot")
        return { body: await snapshot() };
    if (name === "pc_browser_click") {
        const target = await page();
        await target.click(selectorFor(String(args.ref ?? "")));
        return { body: await settled(target) };
    }
    if (name === "pc_browser_fill") {
        const target = await page();
        await target.fill(selectorFor(String(args.ref ?? "")), String(args.text ?? ""));
        return { body: await settled(target) };
    }
    if (name === "pc_browser_select") {
        const target = await page();
        await target.selectOption(selectorFor(String(args.ref ?? "")), String(args.value ?? ""));
        return { body: await settled(target) };
    }
    if (name === "pc_browser_press") {
        const target = await page();
        const key = String(args.key ?? "");
        const ref = String(args.ref ?? "");
        await target.press(ref ? selectorFor(ref) : "body", key);
        return { body: await settled(target) };
    }
    if (name === "pc_browser_read") {
        const target = await page();
        const body = await target.evaluate(`(() => { for (const n of document.querySelectorAll('script,style,noscript')) n.remove(); const main = document.querySelector('main,article,[role=main]') || document.body; return (main.innerText || '').replace(/\\n{3,}/g, '\\n\\n').trim(); })()`);
        const limit = Math.min(Number(args.max_chars) || MAX_TEXT_CHARS, 60_000);
        const full = String(body ?? "");
        return {
            body: `${await target.title()} — ${target.url()}\n\n${full.slice(0, limit)}${full.length > limit ? "\n\n[truncated]" : ""}`,
        };
    }
    if (name === "pc_browser_screenshot") {
        const target = await page();
        const shot = await target.screenshot({ type: "jpeg", quality: 70 });
        send({
            jsonrpc: "2.0",
            id: currentId,
            result: {
                content: [{ type: "image", data: Buffer.from(shot).toString("base64"), mimeType: "image/jpeg" }],
            },
        });
        return { body: "" };
    }
    return { body: `Unknown tool: ${name}`, isError: true };
}
let currentId = null;
/**
 * One browser action at a time.
 *
 * There is a single page, so two calls arriving together fight over it: a read
 * issued while a click is still navigating fails with "execution context was
 * destroyed", which reads to the agent as a broken page rather than a race.
 * Well-behaved clients send one call at a time, but the failure is confusing
 * enough that it is worth not depending on that.
 */
let queue = Promise.resolve();
function serialize(work) {
    const result = queue.then(work, work);
    queue = result.then(() => undefined, () => undefined);
    return result;
}
async function handle(message) {
    const id = message.id;
    currentId = id;
    const method = String(message.method ?? "");
    if (method === "initialize") {
        return send({
            jsonrpc: "2.0",
            id,
            result: {
                protocolVersion: "2024-11-05",
                capabilities: { tools: {} },
                serverInfo: { name: "mauscrew-pc-browser", version: "0.1.0" },
            },
        });
    }
    if (method === "tools/list")
        return send({ jsonrpc: "2.0", id, result: { tools: TOOLS } });
    if (method === "tools/call") {
        const params = (message.params ?? {});
        inFlight += 1;
        try {
            const result = await serialize(() => callTool(String(params.name ?? ""), params.arguments ?? {}));
            if (result.body)
                text(id, result.body, result.isError);
        }
        catch (error) {
            // Every failure here is the browser's, not the protocol's: report it as
            // a tool error so the agent can react rather than the turn dying.
            text(id, error instanceof Error ? error.message : String(error), true);
        }
        finally {
            inFlight -= 1;
        }
        return;
    }
    if (id !== undefined)
        send({ jsonrpc: "2.0", id, error: { code: -32601, message: "method not found" } });
}
let buffer = "";
process.stdin.on("data", (chunk) => {
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (!line.trim())
            continue;
        try {
            void handle(JSON.parse(line));
        }
        catch {
            // a malformed line is not worth killing the server over
        }
    }
});
/** Calls still running. A parent going away must not cut one in half. */
let inFlight = 0;
let closing = false;
async function shutdown() {
    if (closing)
        return;
    closing = true;
    // Give whatever is mid-call a chance to answer; a browser action that is
    // already underway will finish in seconds or time out on its own.
    const deadline = Date.now() + ACTION_TIMEOUT_MS + NAV_TIMEOUT_MS;
    while (inFlight > 0 && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    // Never close a browser session the user explicitly attached. Doing so
    // would close their tabs merely because an agent turn ended.
    if (!attachedToUserBrowser)
        await context?.close().catch(() => { });
    process.exit(0);
}
// stdin closing means the driver that spawned this is gone. Without it the
// browser stays open and the process lingers after every turn.
process.stdin.on("end", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
