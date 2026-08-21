import { describe, expect, it } from "vitest";

import { testMcpConnection } from "./connection-test.ts";

const FAKE_SERVER = String.raw`
let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let newline;
  while ((newline = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, newline);
    buffer = buffer.slice(newline + 1);
    const message = JSON.parse(line);
    if (message.method === "initialize") {
      process.stdout.write(JSON.stringify({jsonrpc:"2.0", id:message.id, result:{protocolVersion:"2024-11-05", capabilities:{tools:{}}, serverInfo:{name:"fake",version:"1"}}}) + "\n");
    }
    if (message.method === "tools/list") {
      process.stdout.write(JSON.stringify({jsonrpc:"2.0", id:message.id, result:{tools:[{name:"issues.get"},{name:"issues.create"},{name:"magic"}]}}) + "\n");
    }
  }
});`;

describe("MCP connection test", () => {
  it("performs initialize and tools/list against a real child process", async () => {
    await expect(testMcpConnection({ command: process.execPath, args: ["-e", FAKE_SERVER] }))
      .resolves.toEqual({
        ok: true,
        tools: [
          { name: "issues.get", class: "read" },
          { name: "issues.create", class: "write" },
          { name: "magic", class: "unknown" },
        ],
      });
  });
});
