// Renderer bridge. contextIsolation stays on; the renderer only ever sees
// this narrow surface (window.mauscrew), never Node or ipcRenderer itself.
const { contextBridge, ipcRenderer, webUtils } = require("electron");

// Set by the app at boot via registerSttCapture (see speech-win.mjs).
let sttCapture = null;

contextBridge.exposeInMainWorld("mauscrew", {
  /** Host platform ("darwin" | "win32" | "linux") — for platform-aware UI. */
  platform: process.platform,
  restartApp: () => ipcRenderer.invoke("app:restart"),
  getCapabilities: () => ipcRenderer.invoke("desktop:capabilities"),
  /** One frame of this computer's screen as a data: URL when supported. */
  screenFrame: () => ipcRenderer.invoke("screen:frame"),
  // Windows dictation captures in the renderer (main has no mic access):
  // the app registers a capture implementation at boot, and speechStart
  // hands off to it once the main process confirms the recognizer is ready.
  registerSttCapture: (impl) => {
    sttCapture = impl;
  },
  speechStart: async (options) => {
    const result = await ipcRenderer.invoke("speech:start", options);
    if (result && result.mode === "renderer") await sttCapture?.start();
    return result;
  },
  speechStop: () => ipcRenderer.invoke("speech:stop"),
  speechFinish: () => ipcRenderer.invoke("speech:finish"),
  /** One Float32 PCM chunk (ArrayBuffer, 16 kHz mono) from the tap. */
  sttAudio: (chunk) => ipcRenderer.send("speech:audio", chunk),
  /** Main-process lifecycle commands for the capture side: {cmd:"stop"}. */
  onSttControl: (cb) => {
    const handler = (_event, info) => cb(info);
    ipcRenderer.on("stt:control", handler);
    return () => ipcRenderer.removeListener("stt:control", handler);
  },
  /** Recognizer download progress: {label, percent} or null when idle. */
  onSttStatus: (cb) => {
    const handler = (_event, info) => cb(info);
    ipcRenderer.on("stt:status", handler);
    return () => ipcRenderer.removeListener("stt:status", handler);
  },
  onSpeechTranscript: (cb) => {
    const handler = (_event, line) => cb(line);
    ipcRenderer.on("speech:transcript", handler);
    return () => ipcRenderer.removeListener("speech:transcript", handler);
  },
  onSpeechEnd: (cb) => {
    const handler = (_event, info) => cb(info);
    ipcRenderer.on("speech:end", handler);
    return () => ipcRenderer.removeListener("speech:end", handler);
  },
  /** Absolute path of a dropped File — Electron 32 removed File.path, and
   * only the preload can ask. "" when the drag carried no file on disk. */
  getPathForFile: (file) => {
    try {
      return webUtils.getPathForFile(file);
    } catch {
      return "";
    }
  },
  /** {mic} TCC status strings: granted|denied|not-determined|unknown.
   * No screen field — macOS 15+ caches that status per-process, so any
   * value here would lie for the whole session after a grant. */
  permStatus: () => ipcRenderer.invoke("perm:status"),
  /** Triggers the macOS microphone prompt; resolves true when granted. */
  permRequestMic: () => ipcRenderer.invoke("perm:request-mic"),
  /** Opens System Settings on the given privacy pane: mic|screen|speech. */
  permOpenSettings: (pane) => ipcRenderer.invoke("perm:open-settings", pane),

  /** Copies an engine install command and opens a blank terminal. Resolves
   * false if no terminal could be launched; the clipboard still has it. */
  openInstallTerminal: (command) => ipcRenderer.invoke("engine:open-terminal", command),
  /** Choose one absolute host directory for a bot's coding workspace. */
  chooseWorkspace: () => ipcRenderer.invoke("workspace:choose"),
  /** Show a file the bot produced in the OS file manager. Reveals only —
   * never opens the file, because the path came from model output. */
  revealPath: (target) => ipcRenderer.invoke("shell:reveal", target),
  /** Which bots are blocked on the user right now, so the tray can say so
   * while the window is hidden. `[{id, name, kind}]`, newest first. */
  setTrayStatus: (waiting) => ipcRenderer.send("tray:status", waiting),
  /** A tray menu entry was chosen: open the app on that bot. */
  onTraySelectBot: (cb) => {
    const handler = (_event, botId) => cb(botId);
    ipcRenderer.on("tray:select-bot", handler);
    return () => ipcRenderer.removeListener("tray:select-bot", handler);
  },
  /** A mauscrew://bot/add?name=..&title=..&description=.. link was opened
   * (from a browser, or by the OS at cold launch). Fires once per link. */
  onDeepLinkBotAdd: (cb) => {
    const handler = (_event, bot) => cb(bot);
    ipcRenderer.on("deeplink:bot-add", handler);
    return () => ipcRenderer.removeListener("deeplink:bot-add", handler);
  },
  /** User-controlled OS login startup. Packaged Windows/macOS only. */
  startup: {
    get: () => ipcRenderer.invoke("startup:get"),
    set: (enabled) => ipcRenderer.invoke("startup:set", enabled),
  },
  /** Store a provider credential with OS-backed encryption. */
  setCredential: (name, value) => ipcRenderer.invoke("credential:set", name, value),

  /** In-app auto-update. State object:
   *  { status: "idle"|"checking"|"available"|"downloading"|"downloaded"|"error",
   *    version?, percent?, message? }. onState fires immediately with the
   *    current state, then on every transition. Dormant in dev (no bridge). */
  updater: {
    check: () => ipcRenderer.invoke("update:check"),
    download: () => ipcRenderer.invoke("update:download"),
    install: () => ipcRenderer.invoke("update:install"),
    onState: (cb) => {
      ipcRenderer
        .invoke("update:get-state")
        .then((s) => cb(s))
        .catch(() => {});
      const handler = (_event, s) => cb(s);
      ipcRenderer.on("update:state", handler);
      return () => ipcRenderer.removeListener("update:state", handler);
    },
  },
});
