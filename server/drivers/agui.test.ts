import { createServer, type RequestListener, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";

import type { RuntimeEvent } from "../contracts.ts";
import { AguiDriver } from "./agui.ts";

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  })));
});

async function listen(handler: RequestListener) {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("test server did not bind a TCP port");
  return `http://127.0.0.1:${address.port}/ag-ui`;
}

describe("AguiDriver", () => {
  it("maps a real HTTP/SSE run into canonical MausCrew events", async () => {
    let requestBody: Record<string, unknown> | undefined;
    const endpoint = await listen((request, response) => {
      let body = "";
      request.setEncoding("utf8");
      request.on("data", (chunk) => { body += chunk; });
      request.on("end", () => {
        requestBody = JSON.parse(body) as Record<string, unknown>;
        response.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
        const events = [
          { type: "RUN_STARTED", threadId: "thread-1", runId: "run-1" },
          { type: "TEXT_MESSAGE_START", messageId: "message-1", role: "assistant" },
          { type: "TEXT_MESSAGE_CONTENT", messageId: "message-1", delta: "Merhaba" },
          { type: "TEXT_MESSAGE_END", messageId: "message-1" },
          { type: "RUN_FINISHED", threadId: "thread-1", runId: "run-1" },
        ];
        for (const event of events) response.write(`data: ${JSON.stringify(event)}\n\n`);
        response.end();
      });
    });
    const instance = await AguiDriver.create({
      instanceId: "agui-test",
      displayName: "Test agent",
      enabled: true,
      config: { endpoint, authHeader: "Authorization", authEnv: "", allowPrivateHosts: true },
      environment: {},
    });
    const events: RuntimeEvent[] = [];
    instance.adapter.onEvent((event) => events.push(event));
    await expect(instance.snapshot()).resolves.toMatchObject({ state: "available", authenticated: true });
    const completed = new Promise<RuntimeEvent>((resolve) => {
      const off = instance.adapter.onEvent((event) => {
        if (event.type === "turn.completed") {
          off();
          resolve(event);
        }
      });
    });

    await instance.adapter.sendTurn({ threadId: "thread-1", text: "Selam", system: "Kısa yanıtla." });
    await expect(completed).resolves.toMatchObject({ type: "turn.completed", ok: true });
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "content.delta", delta: "Merhaba" }),
      expect.objectContaining({ type: "item.completed", itemType: "assistant_text", text: "Merhaba" }),
    ]));
    expect(requestBody).toMatchObject({
      threadId: "thread-1",
      messages: [
        expect.objectContaining({ role: "system", content: "Kısa yanıtla." }),
        expect.objectContaining({ role: "user", content: "Selam" }),
      ],
      forwardedProps: { mauscrewBotId: "thread-1", mauscrewProviderInstanceId: "agui-test" },
    });
    await instance.dispose();
  });

  it("fails closed when a stream ends without a terminal run event", async () => {
    const endpoint = await listen((_request, response) => {
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.end('data: {"type":"RUN_STARTED","threadId":"thread-2","runId":"run-2"}\n\n');
    });
    const instance = await AguiDriver.create({
      instanceId: "agui-truncated",
      displayName: "Truncated agent",
      enabled: true,
      config: { endpoint, authHeader: "Authorization", authEnv: "", allowPrivateHosts: true },
      environment: {},
    });
    const completed = new Promise<RuntimeEvent>((resolve) => {
      const off = instance.adapter.onEvent((event) => {
        if (event.type === "turn.completed") {
          off();
          resolve(event);
        }
      });
    });
    await instance.adapter.sendTurn({ threadId: "thread-2", text: "test" });
    await expect(completed).resolves.toMatchObject({ type: "turn.completed", ok: false, stopReason: "error" });
    await instance.dispose();
  });
});
