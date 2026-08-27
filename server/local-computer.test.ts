import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { readCuaConnection } from "./local-computer.ts";

describe("local computer descriptor", () => {
  it("fails closed on Linux even when a valid-looking descriptor exists", () => {
    const userData = join(process.env.HOME!, "linux-user-data");
    mkdirSync(userData, { recursive: true });
    writeFileSync(
      join(userData, "cua-connection.json"),
      JSON.stringify({
        mode: "embedded",
        mcpCommand: "/tmp/cua-driver",
        mcpArgs: ["mcp", "--embedded"],
        mcpEnv: { CUA_DRIVER_EMBEDDED: "1" },
      }),
    );

    expect(readCuaConnection({ platform: "linux", userData })).toBeNull();
  });

  it("reads and validates an exact macOS userData descriptor", () => {
    const userData = join(process.env.HOME!, "windows-user-data");
    mkdirSync(userData, { recursive: true });
    writeFileSync(
      join(userData, "cua-connection.json"),
      JSON.stringify({
        mode: "embedded",
        mcpCommand: "C:\\cua-driver.exe",
        mcpArgs: ["mcp"],
        mcpEnv: { CUA_DRIVER_EMBEDDED: "1" },
      }),
    );

    expect(readCuaConnection({ platform: "darwin", userData })).toEqual({
      command: "C:\\cua-driver.exe",
      args: ["mcp"],
      env: { CUA_DRIVER_EMBEDDED: "1" },
    });
  });

  it("rejects malformed argv and environment values", () => {
    const userData = join(process.env.HOME!, "invalid-user-data");
    mkdirSync(userData, { recursive: true });
    writeFileSync(
      join(userData, "cua-connection.json"),
      JSON.stringify({ mode: "embedded", mcpCommand: "cua-driver", mcpArgs: "mcp" }),
    );

    expect(readCuaConnection({ platform: "darwin", userData })).toBeNull();
  });

  it("rejects an array environment descriptor", () => {
    const userData = join(process.env.HOME!, "array-environment-user-data");
    mkdirSync(userData, { recursive: true });
    writeFileSync(
      join(userData, "cua-connection.json"),
      JSON.stringify({
        mode: "embedded",
        mcpCommand: "cua-driver",
        mcpEnv: ["CUA_DRIVER_EMBEDDED=1"],
      }),
    );

    expect(readCuaConnection({ platform: "darwin", userData })).toBeNull();
  });

  it("uses the bundled native Windows MCP bridge without a descriptor", () => {
    const moduleDir = join(process.env.HOME!, "windows-native-module");
    const proxy = join(moduleDir, "host-cua", "host-computer-proxy.mjs");
    mkdirSync(join(moduleDir, "host-cua", "native"), { recursive: true });
    writeFileSync(proxy, "// test bridge");

    expect(readCuaConnection({ platform: "win32", moduleDir })).toEqual({
      command: process.execPath,
      args: [proxy],
      env: {
        ELECTRON_RUN_AS_NODE: "1",
        CUA_DRIVER_RS_TELEMETRY_ENABLED: "0",
        MAUSCREW_CUA_SDK_LIBRARY: join(moduleDir, "host-cua", "native", "cua_driver_sdk.dll"),
      },
    });
  });
});
