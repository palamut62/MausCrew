import { app, BrowserWindow, clipboard, desktopCapturer, dialog, ipcMain, Menu, safeStorage, session, shell, systemPreferences, Tray, utilityProcess } from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startCua, stopCua, registerCuaIpc } from "./cua.mjs";
import { finishSpeech, startSpeech, stopSpeech } from "./speech.mjs";
import { openBlankTerminal } from "./terminal-launch.mjs";
import { orderedServerPorts, readSavedServerPort, saveServerPort } from "./server-port.mjs";
import { startUpdater, registerUpdaterIpc } from "./updater.mjs";
import { shouldHideWindowOnClose } from "./window-lifecycle.mjs";
import capabilitiesModule from "./capabilities.cjs";

const { desktopCapabilities } = capabilitiesModule;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 127.0.0.1 explicitly — vite binds IPv4; a bare "localhost" here can
// resolve to ::1 and paint a black window
const DEV_URL = process.env.ELECTRON_START_URL ?? "http://127.0.0.1:5199";
let SERVER_PORT = 8799;
const APP_ICON = path.join(__dirname, "resources/app-icon.png");
const TRAY_ICON = path.join(__dirname, "resources/tray-icon.png");

// GNOME groups the window with its installed desktop entry only when both
// identities match. This must run before Electron becomes ready.
if (process.platform === "linux") app.setDesktopName("com.mauscrew.app.desktop");

// Packaged: the harness server ships in Resources (compiled JS, zero deps)
// and runs on Electron's own Node via utilityProcess. It serves the built
// UI too, so the window talks to one origin and there is no dev proxy.
// A stray server on the default port must not brick the app — fall back to
// alternate ports until one binds AND identifies as ours (the probe checks
// our API shape, not just a 200).
let serverProc = null;
let serverReady = true;
let secureCredentials = {};
let mainWindow = null;
let tray = null;
let quitRequested = false;
const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) app.quit();

const CREDENTIALS_FILE = path.join(app.getPath("userData"), "credentials.bin");

function migrateLegacySecureCredentials() {
  if (fs.existsSync(CREDENTIALS_FILE)) return;
  const appData = app.getPath("appData");
  for (const legacyName of ["OpenMausBot", "openmausbot"]) {
    const legacyFile = path.join(appData, legacyName, "credentials.bin");
    if (!fs.existsSync(legacyFile) || legacyFile === CREDENTIALS_FILE) continue;
    try {
      fs.mkdirSync(path.dirname(CREDENTIALS_FILE), { recursive: true });
      fs.copyFileSync(legacyFile, CREDENTIALS_FILE, fs.constants.COPYFILE_EXCL);
      slog(`migrated secure credentials from ${legacyName}`);
      return;
    } catch (error) {
      slog(`secure credential migration failed: ${error?.message ?? error}`);
    }
  }
}

async function loadSecureCredentials() {
  try {
    if (!fs.existsSync(CREDENTIALS_FILE) || !(await safeStorage.isAsyncEncryptionAvailable())) return {};
    const decrypted = await safeStorage.decryptStringAsync(fs.readFileSync(CREDENTIALS_FILE));
    return JSON.parse(decrypted.result);
  } catch (error) {
    slog(`credential load failed: ${error?.message ?? error}`);
    return {};
  }
}

async function saveSecureCredentials(credentials) {
  if (!(await safeStorage.isAsyncEncryptionAvailable())) {
    throw new Error("The operating-system credential store is unavailable");
  }
  fs.mkdirSync(path.dirname(CREDENTIALS_FILE), { recursive: true });
  const encrypted = await safeStorage.encryptStringAsync(JSON.stringify(credentials));
  const temporary = `${CREDENTIALS_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, encrypted, { mode: 0o600 });
  fs.renameSync(temporary, CREDENTIALS_FILE);
}

function aguiCredentialEnv(credentials) {
  return Object.fromEntries(
    Object.entries(credentials)
      .filter(([name, value]) => name.startsWith("aguiAuth:") && typeof value === "string" && value)
      .map(([name, value]) => {
        const id = name.slice("aguiAuth:".length);
        const envName = `MAUSCREW_AGUI_AUTH_${id.replace(/[^A-Za-z0-9]/g, "_").toUpperCase()}`;
        return [envName, value];
      }),
  );
}

function mcpCredentialEnv(credentials) {
  return Object.fromEntries(
    Object.entries(credentials)
      .filter(([name, value]) => name.startsWith("mcpEnv:") && typeof value === "string" && value)
      .flatMap(([name, value]) => {
        const match = /^mcpEnv:([\w-]{1,60}):([A-Za-z_][A-Za-z0-9_]{0,79})$/.exec(name);
        if (!match) return [];
        const server = match[1].replace(/[^A-Za-z0-9]/g, "_").toUpperCase();
        const field = match[2].replace(/[^A-Za-z0-9]/g, "_").toUpperCase();
        return [[`MAUSCREW_MCP_${server}_${field}`, value]];
      }),
  );
}

async function secureComposioConfig() {
  const dataDir = process.env.MAUSCREW_DATA_DIR || process.env.OMB_DATA_DIR || path.join(app.getPath("home"), ".mauscrew");
  const configPath = path.join(dataDir, "config.json");
  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    if (!config?.composio || typeof config.composio !== "object") return;
    let changed = false;
    const apiKey = config?.composio?.apiKey;
    if (typeof apiKey === "string" && apiKey.trim().startsWith("ak_")) {
      if (!secureCredentials.composioApiKey) {
        secureCredentials.composioApiKey = apiKey.trim();
        await saveSecureCredentials(secureCredentials);
      }
      config.composio.apiKey = "";
      changed = true;
    } else if (typeof apiKey === "string" && apiKey.trim()) {
      config.composio.apiKey = "";
      changed = true;
    }
    // These were the old Connect credential and endpoint. They are no longer
    // read; remove them during the upgrade so an unused secret is not left in
    // plaintext indefinitely.
    for (const field of ["key", "url"]) {
      if (Object.hasOwn(config.composio, field)) {
        delete config.composio[field];
        changed = true;
      }
    }
    if (!changed) return;
    const temporary = `${configPath}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(config, null, 2), { mode: 0o600 });
    fs.renameSync(temporary, configPath);
  } catch (error) {
    if (error?.code !== "ENOENT") slog(`credential migration failed: ${error?.message ?? error}`);
  }
}

// The packaged app has no terminal: everything about the server child's life
// goes to server.log in the OS log dir (~/Library/Logs/MausCrew on macOS,
// Console.app-visible; %APPDATA%\MausCrew\logs on Windows), which is also
// why stdio is piped, not inherited — under a Finder/Explorer launch the
// parent's stdio leads nowhere and a failed boot is otherwise undiagnosable.
const LOG_DIR = app.getPath("logs");
let logStream = null;
function slog(line) {
  try {
    if (!logStream) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
      logStream = fs.createWriteStream(path.join(LOG_DIR, "server.log"), { flags: "a" });
    }
    logStream.write(`[${new Date().toISOString()}] ${line}\n`);
  } catch {
    /* logging must never break startup */
  }
}

async function startServerOn(port) {
  const entry = path.join(process.resourcesPath, "server", "index.js");
  slog(`fork ${entry} port=${port}`);
  const proc = utilityProcess.fork(entry, [], {
    env: {
      ...process.env,
      MAUSCREW_STATIC_DIR: path.join(process.resourcesPath, "ui"),
      MAUSCREW_PORT: String(port),
      MAUSCREW_USER_DATA: app.getPath("userData"),
      ...(secureCredentials.composioApiKey
        ? { COMPOSIO_API_KEY: secureCredentials.composioApiKey }
        : {}),
      ...aguiCredentialEnv(secureCredentials),
      ...mcpCredentialEnv(secureCredentials),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  proc.stdout?.on("data", (d) => slog(`[out] ${String(d).trimEnd()}`));
  proc.stderr?.on("data", (d) => slog(`[err] ${String(d).trimEnd()}`));
  proc.once("spawn", () => slog(`spawned pid=${proc.pid}`));
  let exited = false;
  proc.once("exit", (code) => {
    exited = true;
    slog(`exited code=${code}`);
  });
  // wait for the port to answer (fresh machine: first boot writes data dirs).
  // Identity check is by PID: a dev harness server has the same API shape,
  // so only the child we actually forked (matching pid + static serving)
  // counts as ours.
  for (let i = 0; i < 40; i++) {
    if (exited) return null;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (res.ok) {
        const body = await res.json().catch(() => null);
        if (body?.app === "mauscrew" && body.pid === proc.pid && body.static) return proc;
        break; // someone else owns this port — try the next one
      }
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  try {
    proc.kill();
  } catch {}
  return null;
}

async function startServerPackaged() {
  const userDataDir = app.getPath("userData");
  const ports = orderedServerPorts(readSavedServerPort(userDataDir));
  // two passes: a quit-and-reopen relaunch can race the dying instance's
  // server during teardown — one settle-and-retry covers it
  for (let attempt = 0; attempt < 2; attempt++) {
    for (const port of ports) {
      const proc = await startServerOn(port);
      if (proc) {
        serverProc = proc;
        SERVER_PORT = port;
        try {
          saveServerPort(userDataDir, port);
        } catch (error) {
          slog(`server port persistence failed: ${error?.message ?? error}`);
        }
        return true;
      }
    }
    await new Promise((r) => setTimeout(r, 2500));
  }
  return false;
}

const ERROR_PAGE =
  "data:text/html;charset=utf-8," +
  encodeURIComponent(
    `<body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#070707;color:#fcfcfc;font:15px -apple-system,system-ui"><div style="text-align:center;max-width:360px"><div style="font-size:40px">🐭</div><h2 style="font-weight:600;margin:12px 0 6px">Couldn't start the bot server</h2><p style="color:#fcfcfc99;line-height:1.5">Something else is using its ports. Quit and reopen MausCrew — if it keeps happening, restart your computer.</p></div></body>`,
  );

let cuaReady = Promise.resolve({ mode: "unavailable", reason: "not-started" });

function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    return mainWindow;
  }
  const isMac = process.platform === "darwin";
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 900,
    minHeight: 600,
    icon: APP_ICON,
    backgroundColor: "#060708",
    autoHideMenuBar: process.platform !== "darwin",
    // macOS keeps inset traffic lights, Windows keeps its custom overlay,
    // and Linux uses the native desktop title bar and window controls.
    ...(isMac
      ? { titleBarStyle: "hiddenInset", trafficLightPosition: { x: 16, y: 16 } }
      : process.platform === "win32"
        ? {
            titleBarStyle: "hidden",
            // height MUST match the ChatView/GroupView header strip (px-5 py-3
            // around a 36px control row = 60). Windows draws the caption buttons
            // to fill the overlay, so anything shorter leaves a dead band under
            // them and anything taller overhangs the header.
            titleBarOverlay: { color: "#060708", symbolColor: "#9AA5B1", height: 60 },
          }
        : {}),
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });
  mainWindow = win;

  win.on("close", (event) => {
    if (!shouldHideWindowOnClose({ quitRequested, trayAvailable: Boolean(tray) })) return;
    event.preventDefault();
    win.hide();
  });
  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
  });

  // Deep-link hardening. A window.open from the renderer reaches the OS
  // browser only with an http(s) scheme pointing away from the app itself —
  // file:// and custom protocol handlers never get to shell.openExternal,
  // whatever a compromised server response tries to pop open. In-page
  // navigation is the opposite trade: this is a single-origin SPA, so any
  // foreign navigation is a bug or an attack and is stopped, not followed.
  const appOrigin = app.isPackaged ? `http://127.0.0.1:${SERVER_PORT}` : new URL(DEV_URL).origin;
  win.webContents.setWindowOpenHandler(({ url }) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return { action: "deny" };
    }
    if ((parsed.protocol === "https:" || parsed.protocol === "http:") && parsed.origin !== appOrigin) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    let parsed = null;
    try {
      parsed = new URL(url);
    } catch {
      /* unparseable — block below */
    }
    if (!parsed || parsed.origin !== appOrigin) {
      event.preventDefault();
      console.warn(`[main] blocked in-page navigation to ${url}`);
    }
  });

  // Packaged CI smoke hook. It validates the real renderer/preload bridge and
  // same-origin embedded server, then follows the normal window-close path.
  // No debugging port or sandbox override is needed.
  if (process.env.MAUSCREW_SMOKE_TEST === "1") {
    win.webContents.once("did-finish-load", async () => {
      try {
        const result = await win.webContents.executeJavaScript(`
          (async () => {
            if (!window.mauscrew?.getCapabilities) throw new Error("desktop preload bridge is unavailable");
            const [capabilities, healthResponse] = await Promise.all([
              window.mauscrew.getCapabilities(),
              fetch("/api/health"),
            ]);
            if (!healthResponse.ok) {
              throw new Error(\`health request failed: \${healthResponse.status} \${healthResponse.statusText}\`);
            }
            const health = await healthResponse.json();
            return { capabilities, health, location: window.location.href, title: document.title };
          })()
        `);
        const expectedLocation = `http://127.0.0.1:${SERVER_PORT}/`;
        if (result.location !== expectedLocation) {
          throw new Error(
            `unexpected packaged renderer URL: ${result.location} (expected ${expectedLocation})`,
          );
        }
        console.log(`[smoke] renderer-ready ${JSON.stringify(result)}`);
      } catch (error) {
        console.error(`[smoke] renderer-failed ${error?.stack ?? error}`);
      } finally {
        quitRequested = true;
        app.quit();
      }
    });
  }

  if (app.isPackaged) {
    win.loadURL(serverReady ? `http://127.0.0.1:${SERVER_PORT}` : ERROR_PAGE);
  } else {
    win.loadURL(DEV_URL);
  }
  return win;
}

function showMainWindow() {
  return createWindow();
}

app.on("second-instance", () => {
  if (app.isReady()) showMainWindow();
});

function createTray() {
  if (tray) return tray;
  try {
    tray = new Tray(TRAY_ICON);
    tray.setToolTip("MausCrew");
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: "Open MausCrew", click: () => showMainWindow() },
      { type: "separator" },
      {
        label: "Quit MausCrew",
        click: () => {
          quitRequested = true;
          app.quit();
        },
      },
    ]));
    tray.on("click", () => showMainWindow());
    tray.on("double-click", () => showMainWindow());
  } catch (error) {
    tray = null;
    console.error(`[tray] could not create tray icon: ${error?.stack ?? error}`);
  }
  return tray;
}

// "This Mac" screen preview — served from the main process so the Screen
// Recording permission prompt attributes to the app, never the server
ipcMain.handle("screen:frame", async () => {
  if (process.platform !== "darwin") return null;
  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: { width: 1280, height: 800 },
  });
  return sources[0]?.thumbnail.toDataURL() ?? null;
});

// Onboarding permission checks. Status reads are free; the mic request
// pops the real TCC prompt attributed to the app.
//
// Screen Recording deliberately has NO request path here. On macOS 15+
// every pre-grant mechanism is broken: getMediaAccessStatus("screen")
// wraps CGPreflightScreenCaptureAccess, which caches per-process (stays
// "denied" for the whole session after the user grants); a helper child
// binary gets TCC-attributed to ITSELF on macOS 26, not the app, and
// plain executables no longer appear in the Settings pane at all; and
// Sequoia+ re-prompts periodically regardless, so a pre-grant expires.
// The one reliable path is the first real in-process capture
// (screen:frame above / getDisplayMedia via the handler below) — macOS
// prompts then, attributed correctly, at the moment of actual use. The
// perm:open-settings deep link stays as the repair path for denials.
// Copy the engine command, then open a blank terminal. Renderer-controlled
// text must never become a process argument: the user reviews and pastes it.
// Returns false when the renderer should show the clipboard fallback.
ipcMain.handle("engine:open-terminal", async (_event, command) => {
  if (typeof command !== "string" || !command.trim()) return false;
  clipboard.writeText(command);
  return openBlankTerminal();
});

ipcMain.handle("workspace:choose", async () => {
  const result = await dialog.showOpenDialog({
    title: "Choose bot workspace",
    properties: ["openDirectory", "createDirectory"],
  });
  return result.canceled ? null : (result.filePaths[0] ?? null);
});

ipcMain.handle("perm:status", () => ({
  mic:
    process.platform === "darwin"
      ? systemPreferences.getMediaAccessStatus?.("microphone") ?? "unknown"
      : "unsupported",
}));
ipcMain.handle("perm:request-mic", async () => {
  if (process.platform !== "darwin") return false;
  try {
    return await systemPreferences.askForMediaAccess("microphone");
  } catch {
    return false;
  }
});

// macOS never re-prompts a denied permission — the only path is System
// Settings; deep-link straight to the right privacy pane.
ipcMain.handle("perm:open-settings", (_event, pane) => {
  if (process.platform !== "darwin") return false;
  const panes = {
    mic: "Privacy_Microphone",
    screen: "Privacy_ScreenCapture",
    speech: "Privacy_SpeechRecognition",
  };
  // own-property lookup only — a renderer-supplied "__proto__"/"constructor"
  // would otherwise resolve up the prototype chain to a truthy object
  const anchor = Object.hasOwn(panes, pane) ? panes[pane] : "Privacy";
  return shell.openExternal(`x-apple.systempreferences:com.apple.preference.security?${anchor}`);
});

ipcMain.handle("speech:start", (event, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  if (process.platform !== "darwin") {
    win.webContents.send("speech:end", { code: 2, reason: "unsupported-platform" });
    return;
  }
  startSpeech(win, options);
});
ipcMain.handle("speech:stop", () => {
  if (process.platform === "darwin") stopSpeech();
});
ipcMain.handle("speech:finish", () => {
  if (process.platform === "darwin") finishSpeech();
});

ipcMain.handle("desktop:capabilities", async () =>
  desktopCapabilities({
    platform: process.platform,
    env: process.env,
    packaged: app.isPackaged,
    localConnection: await cuaReady,
  }),
);

ipcMain.handle("credential:set", async (_event, name, value) => {
  const agui = typeof name === "string" ? name.match(/^aguiAuth:([\w-]{1,80})$/) : null;
  const mcp = typeof name === "string" ? name.match(/^mcpEnv:([\w-]{1,60}):([A-Za-z_][A-Za-z0-9_]{0,79})$/) : null;
  if ((name !== "composioApiKey" && !agui && !mcp) || typeof value !== "string") {
    throw new Error("Unsupported credential");
  }
  if (app.isPackaged && !(await safeStorage.isAsyncEncryptionAvailable())) {
    throw new Error("The operating-system credential store is unavailable");
  }
  // In development the server is a separately launched process, so it cannot
  // receive credentials from Electron at boot. Keep its established local
  // config path there; production always uses the encrypted external store.
  const secretStorage = app.isPackaged ? "?secretStorage=external" : "";
  const endpoint = agui
    ? `/api/agui-agents/${encodeURIComponent(agui[1])}/credential`
    : mcp
      ? `/api/mcp-servers/${encodeURIComponent(mcp[1])}/credential/${encodeURIComponent(mcp[2])}`
      : `/api/config${secretStorage}`;
  const response = await fetch(`http://127.0.0.1:${SERVER_PORT}${endpoint}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(agui || mcp ? { value: value.trim() } : { composio: { apiKey: value.trim() } }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || `Could not save credential (HTTP ${response.status})`);
  if (app.isPackaged) {
    if (value.trim()) secureCredentials[name] = value.trim();
    else delete secureCredentials[name];
    await saveSecureCredentials(secureCredentials);
  }
  return body;
});

app.whenReady().then(async () => {
  if (!hasSingleInstanceLock) return;
  if (process.platform === "darwin") app.dock.setIcon(APP_ICON);
  if (app.isPackaged) {
    migrateLegacySecureCredentials();
    secureCredentials = await loadSecureCredentials();
    await secureComposioConfig();
  }
  // getDisplayMedia in the renderer → this handler → ScreenCaptureKit, all
  // inside the app's own processes — the one capture path macOS reliably
  // attributes to the app (registers it in the Screen Recording pane and
  // prompts). Used by the onboarding "Enable screen preview" button.
  if (process.platform === "darwin") {
    session.defaultSession.setDisplayMediaRequestHandler(
      (_request, callback) => {
        desktopCapturer
          .getSources({ types: ["screen"] })
          .then((sources) => callback(sources[0] ? { video: sources[0] } : {}))
          .catch(() => callback({}));
      },
      { useSystemPicker: false },
    );
  }
  registerCuaIpc();
  registerUpdaterIpc();
  createTray();
  // Start the CUA daemon before the window so the harness can pick up the
  // connection descriptor on first render. Never blocks window creation on
  // failure — computer use degrades to "unavailable", the rest still works.
  cuaReady =
    process.platform === "darwin"
      ? startCua().catch((e) => {
          console.error("[cua] start failed:", e);
          return { mode: "unavailable", reason: String(e) };
        })
      : Promise.resolve({ mode: "unavailable", reason: "unsupported-platform" });
  if (app.isPackaged) serverReady = await startServerPackaged();
  const win = createWindow();
  // in-app auto-update (packaged only) — checks GitHub releases, downloads on
  // the user's click, installs on "Restart to update"
  startUpdater(win);
  app.on("activate", () => {
    showMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" && !tray) app.quit();
});

// EMBEDDING.md lifecycle rule: defer the first quit until the embedded
// daemon's async cleanup completes — it can't run after the host exits.
// Cap the defer so a wedged daemon cannot keep the app alive forever.
const CUA_STOP_TIMEOUT_MS = 2500;
let cuaCleanedUp = false;
app.on("before-quit", (e) => {
  quitRequested = true;
  if (cuaCleanedUp) return;
  e.preventDefault();
  try {
    serverProc?.kill();
  } catch {}
  // a live dictation session runs its own helper child that holds the mic —
  // stop it here so quitting never orphans a recording process
  stopSpeech();
  const cleanup = Promise.race([
    stopCua().catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, CUA_STOP_TIMEOUT_MS).unref()),
  ]);
  cleanup.then(() => {
    cuaCleanedUp = true;
    app.quit();
  });
});
