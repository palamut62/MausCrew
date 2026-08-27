// Native host-computer MCP bridge.
//
// Cua Driver already owns Windows.Graphics.Capture, UI Automation, SendInput,
// stale-element protection, sessions, and verification. This adapter only
// translates its canonical tool inventory/results to MCP over stdio so every
// MausCrew engine can use the same reliable Windows implementation.
import { CuaDriver } from "@trycua/cua-driver";
const driver = CuaDriver.create(undefined);
function send(value) {
    process.stdout.write(`${JSON.stringify(value)}\n`);
}
function errorText(error) {
    return error instanceof Error ? error.message : String(error);
}
async function handle(message) {
    if (message.method === "initialize") {
        send({
            jsonrpc: "2.0",
            id: message.id,
            result: {
                protocolVersion: message.params?.protocolVersion ?? "2024-11-05",
                capabilities: { tools: {} },
                serverInfo: { name: "mauscrew-windows-computer", version: "1" },
            },
        });
        return;
    }
    if (message.method === "tools/list") {
        const inventory = JSON.parse(await driver.listToolsJson());
        send({ jsonrpc: "2.0", id: message.id, result: { tools: inventory.tools ?? [] } });
        return;
    }
    if (message.method === "tools/call") {
        const name = String(message.params?.name ?? "");
        const args = JSON.stringify(message.params?.arguments ?? {});
        const result = await driver.callTool(name, args);
        const content = [];
        if (result.text)
            content.push({ type: "text", text: result.text });
        for (const image of result.images) {
            content.push({ type: "image", data: image.dataBase64, mimeType: image.mimeType });
        }
        send({
            jsonrpc: "2.0",
            id: message.id,
            result: {
                content,
                isError: result.isError,
                ...(result.structuredJson
                    ? { structuredContent: JSON.parse(result.structuredJson) }
                    : {}),
            },
        });
        return;
    }
    if (String(message.method ?? "").startsWith("notifications/"))
        return;
    if (message.id != null) {
        send({ jsonrpc: "2.0", id: message.id, error: { code: -32601, message: "method not found" } });
    }
}
let buffer = "";
let queue = Promise.resolve();
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
    buffer += chunk;
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (line.trim()) {
            try {
                const message = JSON.parse(line);
                queue = queue.then(() => handle(message)).catch((error) => {
                    send({
                        jsonrpc: "2.0",
                        id: message.id,
                        result: { content: [{ type: "text", text: `computer tool failed: ${errorText(error)}` }], isError: true },
                    });
                });
            }
            catch {
                // Ignore malformed transport lines, matching the other local proxies.
            }
        }
        newline = buffer.indexOf("\n");
    }
});
async function shutdown() {
    try {
        await driver.shutdown();
        driver.uniffiDestroy();
    }
    finally {
        process.exit(0);
    }
}
process.stdin.on("end", () => void queue.finally(shutdown));
process.on("SIGTERM", () => void shutdown());
