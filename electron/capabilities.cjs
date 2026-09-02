// Pure desktop capability detection shared by Electron main tests and the
// renderer contract. Keep this file free of Electron imports so every branch
// is deterministic and unit-testable.

const DESKTOP_PLATFORMS = new Set(["darwin", "linux", "win32"]);

function normalizedPlatform(platform) {
  return DESKTOP_PLATFORMS.has(platform) ? platform : "other";
}

function linuxSession(platform, env) {
  if (platform !== "linux") return "unknown";
  const declared = String(env.XDG_SESSION_TYPE ?? "").toLowerCase();
  if (declared === "wayland") return "wayland";
  if (declared === "x11" || declared === "xorg") return "x11";
  // A Wayland user session may also expose DISPLAY for XWayland. Prefer the
  // Wayland signal so the UI never bypasses portal-mediated behavior.
  if (env.WAYLAND_DISPLAY) return "wayland";
  if (env.DISPLAY) return "x11";
  return "headless";
}

/**
 * Whether this machine can actually be driven by a bot.
 *
 * Three different implementations sit behind one flag, and each has its own
 * proof of readiness rather than a platform check:
 *
 *  - macOS: the CUA daemon this app started (or an installed CuaDriver.app),
 *    reported through the connection descriptor.
 *  - Windows: the bundled Cua SDK bridge (server/host-computer-proxy.ts and
 *    its native runtime). `hostDriver.staged` is the main process saying it
 *    found that bridge on disk; without it the driver cannot load and the
 *    honest answer is unsupported.
 *  - Linux: the same pinned cua-driver the Local VM runs, installed on the
 *    host and serving a socket. X11 only — under Wayland input injection and
 *    capture both go through portals the driver does not speak, so the flag
 *    stays false rather than producing a bot that clicks nothing.
 */
function localComputerReady(platform, connection, hostDriver = null, session = "unknown") {
  if (platform === "darwin") {
    return connection?.mode === "embedded" || connection?.mode === "standalone";
  }
  if (platform === "win32") return hostDriver?.staged === true;
  if (platform === "linux") return session === "x11" && hostDriver?.staged === true;
  return false;
}

function localComputerReason(platform, session, hostDriver) {
  if (platform === "darwin") return "cua-driver-unavailable";
  if (platform === "win32") return "cua-driver-unavailable";
  if (platform === "linux") {
    if (session === "wayland") return "wayland-session";
    if (session !== "x11") return "no-display";
    return hostDriver?.installing ? "cua-driver-installing" : "cua-driver-not-installed";
  }
  return "unsupported-platform";
}

function desktopCapabilities({
  platform = process.platform,
  env = process.env,
  packaged = false,
  localConnection = null,
  credentialStoreUnreadable = false,
  hostDriver = null,
} = {}) {
  const hostPlatform = normalizedPlatform(platform);
  const isMac = hostPlatform === "darwin";
  const isWin = hostPlatform === "win32";
  const session = linuxSession(hostPlatform, env);
  const localAvailable = localComputerReady(hostPlatform, localConnection, hostDriver, session);
  // desktopCapturer reads the screen on macOS, Windows and X11 alike. Only
  // Wayland routes it through a portal picker the user has to answer per
  // capture, which is not a live preview — so it is reported as such rather
  // than shown as a frame that never arrives.
  const previewAvailable = isMac || isWin || (hostPlatform === "linux" && session === "x11");

  return {
    host: {
      platform: hostPlatform,
      label:
        hostPlatform === "darwin"
          ? "macOS"
          : hostPlatform === "linux"
            ? "Linux"
            : hostPlatform === "win32"
              ? "Windows"
              : "Desktop",
      session,
      packaged: Boolean(packaged),
    },
    windowChrome: isMac ? "mac-inset" : "native",
    screenPreview: {
      available: previewAvailable,
      interaction: previewAvailable ? "direct" : hostPlatform === "linux" && session === "wayland" ? "portal-picker" : "none",
      ...(!previewAvailable
        ? { reasonCode: hostPlatform === "linux" ? (session === "wayland" ? "wayland-session" : "no-display") : "unsupported-platform" }
        : {}),
    },
    dictation: {
      // Windows runs the whisper.cpp recognizer (speech-win.mjs) — capture
      // lives in the renderer, files download on first use
      available: isMac || isWin,
      engine: isMac ? "apple-speech" : isWin ? "whisper-local" : "none",
      onDevice: isMac || isWin,
      ...(!isMac && !isWin ? { reasonCode: "unsupported-platform" } : {}),
    },
    // A saved key that cannot be decrypted must not read as "never entered".
    // The renderer uses this to say so instead of showing an empty key field.
    credentialStore: {
      readable: !credentialStoreUnreadable,
      ...(credentialStoreUnreadable ? { reasonCode: "saved-credentials-unreadable" } : {}),
    },
    localComputer: {
      available: localAvailable,
      support: localAvailable ? "supported" : "unsupported",
      ...(!localAvailable ? { reasonCode: localComputerReason(hostPlatform, session, hostDriver) } : {}),
    },
  };
}

module.exports = { desktopCapabilities, linuxSession, localComputerReady };
