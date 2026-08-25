// Shared provisioning and shell contract for the cloud computer's Cua Driver.
// The box command API is the transport boundary: the daemon stays loopback-only
// inside the VM and MausCrew never exposes another inbound port.

export const REMOTE_CUA_VERSION = "0.20.0";
export const REMOTE_CUA_EXECUTABLE = "/opt/mauscrew/cua-driver";
export const REMOTE_CUA_SOCKET = "/opt/mauscrew/run/cua.sock";
export const REMOTE_CUA_SESSION = "mauscrew";
export const REMOTE_CDP_HELPER = "/opt/mauscrew/mauscrew-cdp.mjs";

const REMOTE_CUA_WHEELS = {
  x86_64: {
    url: "https://files.pythonhosted.org/packages/fa/d7/a43008a328a40c85e7bc706fc20235b9abedc75e28b413817655153157ff/cua_driver-0.20.0-py3-none-manylinux_2_31_x86_64.whl",
    sha256: "f60c35696a37f37ac954935e478ae4754f220856d022036625c9400d72185961",
  },
  aarch64: {
    url: "https://files.pythonhosted.org/packages/94/9d/1c1838b69067e83266c3d2aae02d74eef353a43dc8644884ccf03fe7f933/cua_driver-0.20.0-py3-none-manylinux_2_31_aarch64.whl",
    sha256: "48833bc5e4c60e701fc9eefb57dbac36ec77ef3990f816fbbe85b4e954af2c77",
  },
} as const;

const CDP_HELPER_SOURCE = String.raw`const [action, encoded = ""] = process.argv.slice(2);
const input = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8") || "{}");
const pages = await fetch("http://127.0.0.1:9222/json/list").then((r) => r.json());
const tabs = pages.filter((item) => item.type === "page" && item.webSocketDebuggerUrl);
if (action === "tabs" && !input.target) {
  process.stdout.write(JSON.stringify({ tabs: tabs.map((tab, index) => ({ ref: "t" + index, title: String(tab.title ?? "").slice(0, 200), url: tab.url, active: index === 0 })) }));
  process.exit(0);
}
// Every action used to run against tabs[0]. Chrome lists the most recently
// active page first, so it was usually right and silently wrong the moment a
// bot opened a second tab: the snapshot described one page while the click
// landed on another. A target makes the choice explicit.
const targetMatch = /^t(\d+)$/.exec(String(input.target ?? ""));
const page = targetMatch ? tabs[Number(targetMatch[1])] : tabs[0];
if (!page) throw new Error(targetMatch ? "no such browser tab; take a new browser_tabs listing" : "no debuggable browser page");
if (input.url && page.url !== input.url) throw new Error("page changed; take a new browser snapshot");
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", () => reject(new Error("DevTools connection failed")), { once: true });
});
let nextId = 0;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(String(event.data));
  if (!message.id) return;
  const waiter = pending.get(message.id);
  if (!waiter) return;
  pending.delete(message.id);
  if (message.error) waiter.reject(new Error(message.error.message));
  else waiter.resolve(message.result ?? {});
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++nextId;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});
const refId = (value) => {
  const match = /^b(\d+)$/.exec(String(value ?? ""));
  if (!match) throw new Error("invalid or stale browser ref; take a new snapshot");
  return Number(match[1]);
};
if (action === "snapshot") {
  await send("Accessibility.enable");
  const { nodes = [] } = await send("Accessibility.getFullAXTree", { depth: 14 });
  const useful = new Set(["button", "checkbox", "combobox", "heading", "link", "menuitem", "radio", "searchbox", "slider", "spinbutton", "switch", "tab", "textbox"]);
  const elements = [];
  for (const node of nodes) {
    const role = String(node.role?.value ?? "").toLowerCase();
    const name = String(node.name?.value ?? "").replace(/\s+/g, " ").trim().slice(0, 180);
    const backend = Number(node.backendDOMNodeId ?? 0);
    if (!backend || !useful.has(role) || (!name && role !== "textbox" && role !== "searchbox")) continue;
    const disabled = node.properties?.some((property) => property.name === "disabled" && property.value?.value === true) ?? false;
    elements.push({ ref: "b" + backend, role, name: name || "unnamed", disabled });
    if (elements.length >= 250) break;
  }
  process.stdout.write(JSON.stringify({ title: String(page.title ?? "").slice(0, 200), url: page.url, elements }));
} else if (action === "click") {
  const backendNodeId = refId(input.ref);
  const { model } = await send("DOM.getBoxModel", { backendNodeId });
  const quad = model?.border ?? model?.content;
  if (!Array.isArray(quad) || quad.length < 8) throw new Error("element is not visible; take a new snapshot");
  const x = (quad[0] + quad[2] + quad[4] + quad[6]) / 4;
  const y = (quad[1] + quad[3] + quad[5] + quad[7]) / 4;
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  process.stdout.write(JSON.stringify({ ok: true, ref: input.ref }));
} else if (action === "fill") {
  const backendNodeId = refId(input.ref);
  await send("DOM.focus", { backendNodeId });
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "a", code: "KeyA", modifiers: 2 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "a", code: "KeyA", modifiers: 2 });
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Backspace", code: "Backspace" });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Backspace", code: "Backspace" });
  await send("Input.insertText", { text: String(input.text ?? "") });
  process.stdout.write(JSON.stringify({ ok: true, ref: input.ref }));
} else if (action === "tabs") {
  await send("Page.bringToFront");
  process.stdout.write(JSON.stringify({ ok: true, activated: input.target, title: String(page.title ?? "").slice(0, 200), url: page.url }));
} else if (action === "select") {
  // A native <select> ignores typing, and clicking it opens a popup the OS
  // draws - invisible to the accessibility tree and unclickable by ref. Set
  // the value on the element and fire the events a page listens for instead.
  const backendNodeId = refId(input.ref);
  const { object } = await send("DOM.resolveNode", { backendNodeId });
  if (!object?.objectId) throw new Error("element is gone; take a new snapshot");
  const { result, exceptionDetails } = await send("Runtime.callFunctionOn", {
    objectId: object.objectId,
    functionDeclaration: "function(wanted){if(this.tagName!=='SELECT')return 'not-a-select';const options=Array.from(this.options);const hit=options.find(o=>o.value===wanted)||options.find(o=>o.label===wanted)||options.find(o=>(o.textContent||'').trim()===wanted);if(!hit)return 'no-option:'+options.map(o=>(o.textContent||'').trim()).slice(0,25).join(' | ');this.value=hit.value;this.dispatchEvent(new Event('input',{bubbles:true}));this.dispatchEvent(new Event('change',{bubbles:true}));return 'ok';}",
    arguments: [{ value: String(input.value ?? "") }],
    returnByValue: true,
  });
  if (exceptionDetails) throw new Error("could not set the option");
  const outcome = String(result?.value ?? "");
  if (outcome === "not-a-select") throw new Error("that ref is not a dropdown; use browser_click or browser_fill");
  if (outcome.startsWith("no-option:")) throw new Error("no such option. Available: " + outcome.slice(10));
  process.stdout.write(JSON.stringify({ ok: true, ref: input.ref, value: input.value }));
} else if (action === "key") {
  // Page-scoped, unlike the desktop press_key: it reaches the focused element
  // whether or not the browser window happens to own OS focus.
  const key = String(input.key ?? "");
  const named = { Enter: { code: "Enter", keyCode: 13, text: "\r" }, Tab: { code: "Tab", keyCode: 9 }, Escape: { code: "Escape", keyCode: 27 }, Backspace: { code: "Backspace", keyCode: 8 }, Delete: { code: "Delete", keyCode: 46 }, ArrowUp: { code: "ArrowUp", keyCode: 38 }, ArrowDown: { code: "ArrowDown", keyCode: 40 }, ArrowLeft: { code: "ArrowLeft", keyCode: 37 }, ArrowRight: { code: "ArrowRight", keyCode: 39 }, PageDown: { code: "PageDown", keyCode: 34 }, PageUp: { code: "PageUp", keyCode: 33 }, Home: { code: "Home", keyCode: 36 }, End: { code: "End", keyCode: 35 } }[key];
  if (!named) throw new Error("unsupported key: " + key);
  if (input.ref) await send("DOM.focus", { backendNodeId: refId(input.ref) });
  const base = { key, code: named.code, windowsVirtualKeyCode: named.keyCode, nativeVirtualKeyCode: named.keyCode };
  await send("Input.dispatchKeyEvent", { type: named.text ? "keyDown" : "rawKeyDown", ...base, ...(named.text ? { text: named.text } : {}) });
  await send("Input.dispatchKeyEvent", { type: "keyUp", ...base });
  process.stdout.write(JSON.stringify({ ok: true, key }));
} else if (action === "text") {
  // The snapshot lists controls, not prose. Asking a bot to read an article
  // left it with nothing but a screenshot to squint at.
  const { result } = await send("Runtime.evaluate", {
    expression: "(()=>{const drop=document.querySelectorAll('script,style,noscript,svg');for(const n of drop)n.remove();const main=document.querySelector('main,article,[role=main]')||document.body;return (main.innerText||'').replace(/\n{3,}/g,'\n\n').trim();})()",
    returnByValue: true,
  });
  const full = String(result?.value ?? "");
  const limit = Math.min(Number(input.maxChars) || 20000, 60000);
  process.stdout.write(JSON.stringify({ title: String(page.title ?? "").slice(0, 200), url: page.url, text: full.slice(0, limit), truncated: full.length > limit }));
} else {
  throw new Error("unknown browser action");
}
socket.close();`;

const shellQuote = (value: string): string => `'${value.replace(/'/g, "'\\''")}'`;

/** Start the already-installed daemon after a box resume. This is cheap when
 * it is healthy and intentionally does not install anything on the hot path. */
export function ensureRemoteCuaCommand(): string {
  return [
    `if [ -x ${REMOTE_CUA_EXECUTABLE} ]; then`,
    `  mkdir -p ${REMOTE_CUA_SOCKET.slice(0, REMOTE_CUA_SOCKET.lastIndexOf("/"))}`,
    `  if ! ${REMOTE_CUA_EXECUTABLE} status --socket ${REMOTE_CUA_SOCKET} >/dev/null 2>&1; then`,
    `    rm -f ${REMOTE_CUA_SOCKET}`,
    '    display=${DISPLAY:-$(find /tmp/.X11-unix -maxdepth 1 -name "X*" -printf ":%f\\n" 2>/dev/null | sed "s/:X/:/" | head -1)}',
    '    display=${display:-:0}',
    `    nohup env HOME="$HOME" DISPLAY="$display" CUA_DRIVER_INSTALL_CHANNEL=python_package CUA_DRIVER_RS_TELEMETRY_ENABLED=0 ${REMOTE_CUA_EXECUTABLE} serve --socket ${REMOTE_CUA_SOCKET} --permission-mode standard > /tmp/mauscrew-cua-driver.log 2>&1 &`,
    `    for i in 1 2 3 4 5 6 7 8 9 10; do ${REMOTE_CUA_EXECUTABLE} status --socket ${REMOTE_CUA_SOCKET} >/dev/null 2>&1 && break; sleep 0.2; done`,
    "  fi",
    "fi",
  ].join("\n");
}

/** Idempotent setup. The exact wheel is verified before its bundled native
 * executable is installed; installation remains asynchronous so first-time
 * provisioning does not block the desktop for several minutes. */
export function remoteComputerBootstrapCommand(botName: string): string {
  const helper = Buffer.from(CDP_HELPER_SOURCE).toString("base64");
  const installer = [
    "set -eu",
    "trap 'rm -f /tmp/mauscrew-cua-installing' EXIT",
    "sudo mkdir -p /opt/mauscrew/run",
    'sudo chown -R "$(id -u):$(id -g)" /opt/mauscrew',
    'arch="$(uname -m)"',
    `case "$arch" in x86_64) url=${shellQuote(REMOTE_CUA_WHEELS.x86_64.url)}; sha=${REMOTE_CUA_WHEELS.x86_64.sha256} ;; aarch64|arm64) url=${shellQuote(REMOTE_CUA_WHEELS.aarch64.url)}; sha=${REMOTE_CUA_WHEELS.aarch64.sha256} ;; *) echo "unsupported architecture: $arch" >&2; exit 1 ;; esac`,
    'wheel="/tmp/cua-driver-${sha}.whl"',
    'curl -fsSL "$url" -o "$wheel"',
    'echo "$sha  $wheel" | sha256sum -c -',
    'python3 - "$wheel" <<\'PY\'\nimport os, sys, zipfile\nwheel = sys.argv[1]\nwith zipfile.ZipFile(wheel) as archive:\n    names = [name for name in archive.namelist() if name == "cua_driver/bin/cua-driver" or name.endswith("/cua_driver/bin/cua-driver")]\n    if len(names) != 1:\n        raise SystemExit("cua-driver executable missing from wheel")\n    with archive.open(names[0]) as source, open("/opt/mauscrew/cua-driver", "wb") as target:\n        target.write(source.read())\nos.chmod("/opt/mauscrew/cua-driver", 0o755)\nPY',
    `test "$(${REMOTE_CUA_EXECUTABLE} --version)" = "cua-driver ${REMOTE_CUA_VERSION}"`,
    `touch /opt/mauscrew/cua-${REMOTE_CUA_VERSION}-ready`,
    'rm -f "$wheel"',
  ].join("\n");
  // The name lands inside a double-quoted region of a single-quoted shell
  // word, where $, backticks and friends are all live — stripping quotes
  // alone left command substitution reachable through a renamed bot. Allow
  // only a conservative display-safe set instead of outsmarting quoting.
  const safeName = botName.replace(/[^\p{L}\p{N} _.,:#%()+@/-]/gu, "").slice(0, 80);
  return [
    "if ! command -v xdotool >/dev/null || ! command -v convert >/dev/null || ! command -v curl >/dev/null || ! command -v python3 >/dev/null; then sudo apt-get update -qq || true; sudo apt-get install -y -qq ca-certificates curl python3 gnome-screenshot xclip wmctrl xdotool imagemagick scrot >/dev/null 2>&1 || true; fi",
    "sudo mkdir -p /opt/mauscrew/run",
    `printf %s ${shellQuote(helper)} | base64 -d | sudo tee ${REMOTE_CDP_HELPER} >/dev/null`,
    `sudo chmod 0755 ${REMOTE_CDP_HELPER}`,
    'pkill -f "^/opt/mauscrew/venv/bin/python -m computer_server( |$)" >/dev/null 2>&1 || true',
    `[ -f /opt/mauscrew/cua-${REMOTE_CUA_VERSION}-ready ] || [ -f /tmp/mauscrew-cua-installing ] || { touch /tmp/mauscrew-cua-installing; nohup bash -c ${shellQuote(installer)} > /tmp/mauscrew-cua-install.log 2>&1 & }`,
    ensureRemoteCuaCommand(),
    `tmux has-session -t work 2>/dev/null || tmux new-session -d -s work 'echo; echo "  ▦ ${safeName}'"'"'s computer — MausCrew"; echo; exec bash -i'`,
    "echo bootstrapped",
  ].join("\n");
}

export type SemanticBrowserAction = "snapshot" | "click" | "fill" | "tabs" | "select" | "key" | "text";

export function semanticBrowserCommand(action: SemanticBrowserAction, input: unknown): string {
  const encoded = Buffer.from(JSON.stringify(input ?? {})).toString("base64url");
  return `node ${REMOTE_CDP_HELPER} ${action} ${shellQuote(encoded)}`;
}
