import { randomUUID } from "node:crypto";
import { checkAguiEndpoint } from "./endpoint.js";
const TEST_TIMEOUT_MS = 15_000;
const MAX_BYTES = 8_000;
function probeBody() {
    return {
        threadId: `mauscrew-test-${randomUUID()}`,
        runId: `mauscrew-test-${randomUUID()}`,
        messages: [{ id: randomUUID(), role: "user", content: "MausCrew connection test. Reply with one short word." }],
        tools: [],
        context: [],
        state: {},
        forwardedProps: { mauscrewConnectionTest: true },
    };
}
export function aguiEventTypes(text) {
    const types = [];
    for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed.startsWith("event:"))
            types.push(trimmed.slice(6).trim());
        if (!trimmed.startsWith("data:"))
            continue;
        try {
            const parsed = JSON.parse(trimmed.slice(5).trim());
            if (typeof parsed.type === "string")
                types.push(parsed.type);
        }
        catch {
            // A partial final event does not invalidate the complete events read.
        }
    }
    return [...new Set(types.filter(Boolean))];
}
export async function testAguiConnection(input) {
    const verdict = await checkAguiEndpoint(input.endpoint, input);
    if (!verdict.allowed)
        return { ok: false, reason: verdict.reason };
    let response;
    try {
        response = await (input.fetchImpl ?? fetch)(verdict.url, {
            method: "POST",
            headers: { accept: "text/event-stream", "content-type": "application/json", ...input.headers },
            body: JSON.stringify(probeBody()),
            signal: AbortSignal.timeout(input.timeoutMs ?? TEST_TIMEOUT_MS),
        });
    }
    catch (error) {
        return {
            ok: false,
            reason: error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)
                ? "The AG-UI agent did not answer before the connection-test timeout."
                : "MausCrew could not reach the AG-UI endpoint.",
        };
    }
    if (!response.ok) {
        return {
            ok: false,
            status: response.status,
            reason: response.status === 401 || response.status === 403
                ? "The AG-UI agent rejected the auth header."
                : `The AG-UI endpoint answered HTTP ${response.status}.`,
        };
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("text/event-stream")) {
        return { ok: false, status: response.status, reason: `The endpoint returned ${contentType || "no content type"}, not an AG-UI event stream.` };
    }
    const reader = response.body?.getReader();
    if (!reader)
        return { ok: false, status: response.status, reason: "The AG-UI endpoint returned no event stream." };
    const decoder = new TextDecoder();
    let body = "";
    try {
        while (body.length < MAX_BYTES) {
            const chunk = await reader.read();
            if (chunk.done)
                break;
            body += decoder.decode(chunk.value, { stream: true });
            const events = aguiEventTypes(body);
            if (events.some((event) => event === "RUN_STARTED" || event === "TEXT_MESSAGE_START")) {
                await reader.cancel().catch(() => undefined);
                return { ok: true, status: response.status, events };
            }
        }
    }
    catch {
        return { ok: false, status: response.status, reason: "The AG-UI event stream broke during the connection test." };
    }
    const events = aguiEventTypes(body);
    return events.length
        ? { ok: true, status: response.status, events }
        : { ok: false, status: response.status, reason: "The endpoint answered, but emitted no valid AG-UI events." };
}
