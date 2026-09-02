import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { desktopCapabilities, linuxSession, localComputerReady } = require("./capabilities.cjs");

describe("desktop capabilities", () => {
  it("keeps macOS native features behind a ready CUA connection", () => {
    const capabilities = desktopCapabilities({
      platform: "darwin",
      packaged: true,
      localConnection: { mode: "embedded" },
    });

    expect(capabilities).toMatchObject({
      host: { platform: "darwin", label: "macOS", session: "unknown", packaged: true },
      windowChrome: "mac-inset",
      screenPreview: { available: true, interaction: "direct" },
      dictation: { available: true, engine: "apple-speech", onDevice: true },
      localComputer: { available: true, support: "supported" },
    });
  });

  it("fails closed on an unknown platform", () => {
    const capabilities = desktopCapabilities({
      platform: "freebsd",
      env: { DISPLAY: ":0" },
      localConnection: { mode: "embedded" },
    });

    expect(capabilities.windowChrome).toBe("native");
    expect(capabilities.screenPreview.available).toBe(false);
    expect(capabilities.dictation.available).toBe(false);
    expect(capabilities.localComputer).toMatchObject({
      available: false,
      support: "unsupported",
      reasonCode: "unsupported-platform",
    });
  });

  // A macOS-shaped connection descriptor means nothing on Linux: the driver
  // there is the host cua-driver the harness installs and serves itself.
  it("drives an X11 Linux session once the host driver is installed", () => {
    const base = { platform: "linux", env: { XDG_SESSION_TYPE: "x11", DISPLAY: ":0" } };
    expect(desktopCapabilities({ ...base, localConnection: { mode: "embedded" } }).localComputer).toMatchObject({
      available: false,
      reasonCode: "cua-driver-not-installed",
    });
    expect(desktopCapabilities({ ...base, hostDriver: { installing: true } }).localComputer.reasonCode)
      .toBe("cua-driver-installing");
    expect(desktopCapabilities({ ...base, hostDriver: { staged: true } })).toMatchObject({
      screenPreview: { available: true, interaction: "direct" },
      localComputer: { available: true, support: "supported" },
    });
  });

  it("refuses a Wayland session even with the driver installed", () => {
    // Input injection and capture both go through portals cua-driver does not
    // speak; a true flag here would be a bot that clicks nothing.
    const capabilities = desktopCapabilities({
      platform: "linux",
      env: { XDG_SESSION_TYPE: "wayland", WAYLAND_DISPLAY: "wayland-0", DISPLAY: ":0" },
      hostDriver: { staged: true },
    });
    expect(capabilities.localComputer).toMatchObject({ available: false, reasonCode: "wayland-session" });
    expect(capabilities.screenPreview).toMatchObject({ available: false, interaction: "portal-picker" });
  });

  // win32 keeps every other native feature closed but gains the whisper.cpp
  // recognizer — renderer-side capture, files fetched on first use
  it("offers whisper-local dictation and screen preview on win32", () => {
    const capabilities = desktopCapabilities({
      platform: "win32",
      env: { DISPLAY: ":0" },
      localConnection: { mode: "embedded" },
    });

    expect(capabilities.windowChrome).toBe("native");
    // desktopCapturer reads the Windows screen with no permission prompt.
    expect(capabilities.screenPreview).toMatchObject({ available: true, interaction: "direct" });
    expect(capabilities.dictation).toMatchObject({
      available: true,
      engine: "whisper-local",
      onDevice: true,
    });
    // The macOS connection descriptor is not what makes Windows ready — the
    // staged Cua SDK bridge is.
    expect(capabilities.localComputer).toMatchObject({
      available: false,
      support: "unsupported",
      reasonCode: "cua-driver-unavailable",
    });
  });

  it("turns Windows local control on once the Cua bridge is staged", () => {
    const capabilities = desktopCapabilities({ platform: "win32", hostDriver: { staged: true } });
    expect(capabilities.localComputer).toMatchObject({ available: true, support: "supported" });
  });

  // Regression: a credentials.bin copied across the OpenMausBot→MausCrew rename
  // decrypts nowhere on Windows (safeStorage binds to the app's own Local State
  // key). The app reported Composio as simply unconfigured, so the user saw a
  // key they had definitely entered silently do nothing.
  it("reports an unreadable credential store instead of looking unconfigured", () => {
    expect(desktopCapabilities({ platform: "win32" }).credentialStore).toEqual({ readable: true });
    expect(desktopCapabilities({ platform: "win32", credentialStoreUnreadable: true }).credentialStore).toEqual({
      readable: false,
      reasonCode: "saved-credentials-unreadable",
    });
  });

  it("detects Wayland before XWayland and distinguishes X11 and headless Linux", () => {
    expect(linuxSession("linux", { WAYLAND_DISPLAY: "wayland-0", DISPLAY: ":0" })).toBe("wayland");
    expect(linuxSession("linux", { XDG_SESSION_TYPE: "x11", DISPLAY: ":0" })).toBe("x11");
    expect(linuxSession("linux", {})).toBe("headless");
  });

  it("never treats an embedded-looking Linux connection as local control", () => {
    expect(localComputerReady("linux", { mode: "embedded" })).toBe(false);
    expect(localComputerReady("darwin", { mode: "unavailable" })).toBe(false);
    expect(localComputerReady("darwin", { mode: "standalone" })).toBe(true);
    // Each platform proves readiness its own way; none of them accepts
    // another platform's evidence.
    expect(localComputerReady("win32", { mode: "embedded" })).toBe(false);
    expect(localComputerReady("win32", null, { staged: true })).toBe(true);
    expect(localComputerReady("linux", null, { staged: true }, "x11")).toBe(true);
    expect(localComputerReady("linux", null, { staged: true }, "wayland")).toBe(false);
  });
});
