import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

import {
  ensureRemoteCuaCommand,
  REMOTE_CUA_EXECUTABLE,
  REMOTE_CUA_SOCKET,
  REMOTE_CUA_VERSION,
  remoteComputerBootstrapCommand,
  semanticBrowserCommand,
} from "./remote-computer.ts";

const HELPER_PATTERN = new RegExp("const CDP_HELPER_SOURCE = String.raw`([\\s\\S]*?)`;");

describe("remote Cua computer setup", () => {
  it("installs one exact checksummed 0.20.0 driver and disables telemetry", () => {
    const command = remoteComputerBootstrapCommand("Test Bot");
    expect(REMOTE_CUA_VERSION).toBe("0.20.0");
    expect(command).toContain("cua_driver-0.20.0-py3-none-manylinux_2_31_x86_64.whl");
    expect(command).toContain("cua_driver-0.20.0-py3-none-manylinux_2_31_aarch64.whl");
    expect(command).toContain("f60c35696a37f37ac954935e478ae4754f220856d022036625c9400d72185961");
    expect(command).toContain("48833bc5e4c60e701fc9eefb57dbac36ec77ef3990f816fbbe85b4e954af2c77");
    expect(command).toContain(`test "$(${REMOTE_CUA_EXECUTABLE} --version)" = "cua-driver 0.20.0"`);
    expect(command).toContain("sha256sum -c -");
    expect(command).toContain("CUA_DRIVER_RS_TELEMETRY_ENABLED=0");
    expect(command).not.toContain("uv pip install");
    expect(command).not.toContain("cua-computer-server");
    expect(command).not.toContain("--port 8000");
    if (process.platform !== "win32") {
      expect(spawnSync("/bin/bash", ["-n"], { input: command }).status).toBe(0);
    }
  });

  it("reattaches the private daemon after resume without opening a port", () => {
    const command = ensureRemoteCuaCommand();
    expect(command).toContain(`status --socket ${REMOTE_CUA_SOCKET}`);
    expect(command).toContain(`serve --socket ${REMOTE_CUA_SOCKET} --permission-mode standard`);
    expect(command).toContain("CUA_DRIVER_RS_TELEMETRY_ENABLED=0");
    expect(command).not.toMatch(/--host|--port/);
  });

  it("encodes semantic browser input instead of interpolating it into shell", () => {
    const command = semanticBrowserCommand("fill", { ref: "b7", text: "don't expand $HOME" });
    expect(command).toContain("mauscrew-cdp.mjs fill");
    expect(command).not.toContain("don't expand");
    expect(command).not.toContain("$HOME");
  });
  // The CDP helper is shipped as a string and run on the box, so nothing in
  // this repo's toolchain would notice if it stopped being valid JavaScript.
  it("ships a browser helper that actually parses, and covers every action", () => {
    const source = readFileSync(new URL("./remote-computer.ts", import.meta.url), "utf8");
    const helper = HELPER_PATTERN.exec(source)?.[1];
    expect(helper, "CDP helper source not found").toBeTruthy();
    expect(() => new Function(`return (async () => {${helper}})`)).not.toThrow();
    for (const action of [
      "snapshot",
      "click",
      "fill",
      "tabs",
      "select",
      "key",
      "text",
      "box",
      "drag",
      "scrollTo",
    ]) {
      expect(helper, `helper handles ${action}`).toContain(`action === "${action}"`);
    }
  });

  // Every browser tool but browser_tabs acts on the front tab. Before the
  // target existed they all silently ran against whichever page Chrome listed
  // first, so a bot that opened a second tab described one page and clicked
  // another.
  it("lets a caller name the tab instead of always taking the first", () => {
    const command = semanticBrowserCommand("snapshot", { target: "t2" });
    const decoded = JSON.parse(
      Buffer.from(command.split(" ").pop()!.replace(/'/g, ""), "base64url").toString("utf8"),
    );
    expect(decoded.target).toBe("t2");
  });

  it("keeps a dropdown value out of the shell", () => {
    const command = semanticBrowserCommand("select", { ref: "b3", value: "$(whoami)" });
    expect(command).toContain("mauscrew-cdp.mjs select");
    expect(command).not.toContain("whoami");
  });
  // A press that jumps straight to a release fires no mousemove, and drag
  // handlers that listen for it do nothing at all.
  it("drags through intermediate points rather than teleporting", () => {
    const source = readFileSync(new URL("./remote-computer.ts", import.meta.url), "utf8");
    const helper = HELPER_PATTERN.exec(source)?.[1];
    expect(helper).toContain("mouseMoved");
    const drag = helper!.slice(helper!.indexOf('action === "drag"'));
    expect(drag.slice(0, drag.indexOf("scrollTo"))).toMatch(/for \(let step/);
  });

  it("keeps a drag destination out of the shell too", () => {
    const command = semanticBrowserCommand("drag", { ref: "b1", toRef: "$(whoami)" });
    expect(command).toContain("mauscrew-cdp.mjs drag");
    expect(command).not.toContain("whoami");
  });
});
