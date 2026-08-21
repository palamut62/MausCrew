import { randomUUID } from "node:crypto";

import { killCliTree, spawnCli } from "../procs.ts";
import { classifyMcpTool } from "./classifier.ts";

export async function testMcpConnection(input: {
  command: string;
  args: string[];
  env?: Record<string, string>;
  timeoutMs?: number;
}): Promise<{ ok: true; tools: Array<{ name: string; class: ReturnType<typeof classifyMcpTool> }> }> {
  return new Promise((resolve, reject) => {
    const child = spawnCli(input.command, input.args, {
      env: { ...process.env, ...input.env },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let settled = false;
    let buffer = "";
    let stderr = "";
    const finish = (error?: Error, tools?: Array<{ name: string; class: ReturnType<typeof classifyMcpTool> }>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      killCliTree(child);
      if (error) reject(error);
      else resolve({ ok: true, tools: tools ?? [] });
    };
    const timer = setTimeout(() => finish(new Error("MCP server did not complete its handshake before the timeout")), input.timeoutMs ?? 10_000);
    timer.unref?.();
    child.on("error", (error) => finish(new Error(`MCP server could not start: ${error.message}`)));
    child.stderr.on("data", (chunk) => { stderr = (stderr + String(chunk)).slice(-1000); });
    child.on("exit", (code) => {
      if (!settled) finish(new Error(stderr.trim() || `MCP server exited during handshake (${code ?? "signal"})`));
    });
    const send = (message: unknown) => child.stdin.write(`${JSON.stringify(message)}\n`);
    child.stdout.on("data", (chunk) => {
      buffer += String(chunk);
      if (buffer.length > 512_000) return finish(new Error("MCP server emitted too much handshake output"));
      let newline;
      while ((newline = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line) continue;
        let message: any;
        try { message = JSON.parse(line); } catch { continue; }
        if (message.id === "init" && message.result) {
          send({ jsonrpc: "2.0", method: "notifications/initialized" });
          send({ jsonrpc: "2.0", id: "tools", method: "tools/list", params: {} });
        } else if (message.id === "tools" && Array.isArray(message.result?.tools)) {
          const tools = message.result.tools
            .filter((tool: unknown) => tool && typeof tool === "object" && typeof (tool as any).name === "string")
            .slice(0, 500)
            .map((tool: any) => ({ name: tool.name, class: classifyMcpTool(tool.name) }));
          finish(undefined, tools);
        } else if ((message.id === "init" || message.id === "tools") && message.error) {
          finish(new Error(`MCP handshake failed: ${String(message.error.message ?? "unknown error")}`));
        }
      }
    });
    send({
      jsonrpc: "2.0",
      id: "init",
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "mauscrew-connection-test", version: "1" },
        requestId: randomUUID(),
      },
    });
  });
}
