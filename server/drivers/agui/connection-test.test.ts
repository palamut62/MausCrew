import { describe, expect, it, vi } from "vitest";

import { aguiEventTypes, testAguiConnection } from "./connection-test.ts";

const localResolver = async () => [{ address: "127.0.0.1", family: 4 }];

describe("AG-UI connection test", () => {
  it("recognizes typed events in an SSE response", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(
      'data: {"type":"RUN_STARTED","threadId":"thread","runId":"run"}\n\n',
      { status: 200, headers: { "content-type": "text/event-stream; charset=utf-8" } },
    ));
    const result = await testAguiConnection({
      endpoint: "http://localhost:8000/ag-ui",
      allowPrivateHosts: true,
      resolver: localResolver,
      fetchImpl,
    });

    expect(result).toEqual({ ok: true, status: 200, events: ["RUN_STARTED"] });
    const request = fetchImpl.mock.calls[0]?.[1];
    expect(request?.method).toBe("POST");
    expect(JSON.parse(String(request?.body))).toMatchObject({ messages: [{ role: "user" }], tools: [] });
  });

  it("reports auth and non-stream responses precisely", async () => {
    await expect(testAguiConnection({
      endpoint: "http://localhost/ag-ui",
      allowPrivateHosts: true,
      resolver: localResolver,
      fetchImpl: async () => new Response("no", { status: 401 }),
    })).resolves.toEqual({ ok: false, status: 401, reason: "The AG-UI agent rejected the auth header." });

    await expect(testAguiConnection({
      endpoint: "http://localhost/ag-ui",
      allowPrivateHosts: true,
      resolver: localResolver,
      fetchImpl: async () => new Response("{}", { status: 200, headers: { "content-type": "application/json" } }),
    })).resolves.toMatchObject({ ok: false, reason: expect.stringContaining("not an AG-UI event stream") });
  });

  it("deduplicates event and data type declarations", () => {
    expect(aguiEventTypes('event: RUN_STARTED\ndata: {"type":"RUN_STARTED"}\n\ndata: {"type":"TEXT_MESSAGE_START"}'))
      .toEqual(["RUN_STARTED", "TEXT_MESSAGE_START"]);
  });
});
