import { HttpAgent } from "@ag-ui/client";
import { newEventId, newId } from "../contracts.js";
import { checkAguiEndpoint } from "./agui/endpoint.js";
const DRIVER_KIND = "agui";
const MODELS = { default: "remote", options: [{ id: "remote", label: "Remote agent" }] };
function decodeConfig(raw) {
    const value = (raw ?? {});
    const endpoint = typeof value.endpoint === "string" ? value.endpoint.trim() : "";
    if (!endpoint)
        throw new Error("AG-UI endpoint is required");
    const authHeader = typeof value.authHeader === "string" && value.authHeader.trim() ? value.authHeader.trim() : "Authorization";
    if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(authHeader))
        throw new Error("AG-UI auth header name is invalid");
    return {
        endpoint,
        authHeader,
        authEnv: typeof value.authEnv === "string" ? value.authEnv : "",
        allowPrivateHosts: value.allowPrivateHosts !== false,
    };
}
function aguiMessages(turn) {
    return [
        ...(turn.system ? [{ id: newId(), role: "system", content: turn.system }] : []),
        ...(turn.transcript ?? []).map((message) => ({
            id: newId(),
            role: message.role === "assistant" ? "assistant" : "user",
            content: message.text,
        })),
        { id: newId(), role: "user", content: turn.text },
    ];
}
export const AguiDriver = {
    driverKind: DRIVER_KIND,
    metadata: { displayName: "AG-UI Agent", supportsMultipleInstances: true },
    models: MODELS,
    decodeConfig,
    defaultConfig: () => decodeConfig({ endpoint: "http://127.0.0.1:8000/ag-ui" }),
    async create(input) {
        const { instanceId, config } = input;
        const listeners = new Set();
        const active = new Map();
        const authValue = config.authEnv ? input.environment[config.authEnv] ?? process.env[config.authEnv] : undefined;
        const headers = authValue ? { [config.authHeader]: authValue } : undefined;
        const emit = (event) => {
            for (const listener of [...listeners])
                listener(event);
        };
        const base = (threadId, turnId) => ({
            eventId: newEventId(),
            provider: DRIVER_KIND,
            providerInstanceId: instanceId,
            threadId,
            turnId,
            createdAt: new Date().toISOString(),
        });
        const snapshot = async () => {
            const verdict = await checkAguiEndpoint(config.endpoint, { allowPrivateHosts: config.allowPrivateHosts });
            if (!verdict.allowed)
                return { state: "unavailable", reason: verdict.reason };
            // Auth is optional in AG-UI. Registration performs a live connection
            // test, so an agent that succeeded without a header must stay usable in
            // the model picker rather than being mislabeled as signed out.
            return { state: "available", authenticated: true, version: "AG-UI HTTP/SSE" };
        };
        const sendTurn = async (turn) => {
            if (active.has(turn.threadId))
                throw new Error("an AG-UI run is already active on this thread");
            const verdict = await checkAguiEndpoint(config.endpoint, { allowPrivateHosts: config.allowPrivateHosts });
            if (!verdict.allowed)
                throw new Error(verdict.reason);
            const turnId = newId();
            const abort = new AbortController();
            active.set(turn.threadId, { abort, turnId });
            const agent = new HttpAgent({
                url: verdict.url,
                agentId: instanceId,
                threadId: turn.threadId,
                initialMessages: aguiMessages(turn),
                ...(headers ? { headers } : {}),
            });
            emit({ ...base(turn.threadId, turnId), type: "turn.started" });
            emit({ ...base(turn.threadId, turnId), type: "session.started", sessionId: turn.threadId, model: turn.model ?? MODELS.default });
            void (async () => {
                let finished = false;
                let failed = false;
                try {
                    await agent.runAgent({ abortController: abort, forwardedProps: { mauscrewBotId: turn.threadId, mauscrewProviderInstanceId: instanceId } }, {
                        onTextMessageContentEvent: ({ event }) => {
                            if (event.delta)
                                emit({ ...base(turn.threadId, turnId), type: "content.delta", streamKind: "assistant_text", delta: event.delta });
                        },
                        onTextMessageEndEvent: ({ textMessageBuffer }) => {
                            if (textMessageBuffer.trim()) {
                                emit({ ...base(turn.threadId, turnId), type: "item.completed", itemType: "assistant_text", text: textMessageBuffer });
                            }
                        },
                        onToolCallStartEvent: ({ event }) => {
                            emit({
                                ...base(turn.threadId, turnId),
                                type: "item.started",
                                itemType: "tool",
                                itemId: event.toolCallId,
                                title: event.toolCallName,
                                raw: { source: "ag-ui", payload: { type: event.type, toolCallId: event.toolCallId, toolCallName: event.toolCallName } },
                            });
                        },
                        onToolCallEndEvent: ({ event, toolCallName }) => {
                            emit({ ...base(turn.threadId, turnId), type: "item.completed", itemType: "tool", itemId: event.toolCallId, ok: true, raw: { source: "ag-ui", payload: { type: event.type, toolCallName } } });
                        },
                        onRunErrorEvent: ({ event }) => {
                            failed = true;
                            emit({ ...base(turn.threadId, turnId), type: "runtime.error", message: event.message || "The AG-UI run failed." });
                        },
                        onRunFinishedEvent: () => {
                            finished = true;
                        },
                        onRunFailed: ({ error }) => {
                            failed = true;
                            emit({ ...base(turn.threadId, turnId), type: "runtime.error", message: error.message });
                        },
                    });
                    if (!finished && !failed && !abort.signal.aborted) {
                        failed = true;
                        emit({ ...base(turn.threadId, turnId), type: "runtime.error", message: "The AG-UI stream ended without RUN_FINISHED or RUN_ERROR." });
                    }
                }
                catch (error) {
                    failed = true;
                    if (!abort.signal.aborted)
                        emit({ ...base(turn.threadId, turnId), type: "runtime.error", message: error instanceof Error ? error.message : String(error) });
                }
                finally {
                    active.delete(turn.threadId);
                    emit({ ...base(turn.threadId, turnId), type: "turn.completed", ok: finished && !failed && !abort.signal.aborted, stopReason: abort.signal.aborted ? "interrupted" : failed ? "error" : null, cost: null });
                }
            })();
            return { turnId };
        };
        return {
            instanceId,
            driverKind: DRIVER_KIND,
            displayName: input.displayName,
            enabled: input.enabled,
            models: MODELS,
            snapshot,
            adapter: {
                provider: DRIVER_KIND,
                capabilities: { sessionModelSwitch: "unsupported" },
                sendTurn,
                interruptTurn: async (threadId) => active.get(threadId)?.abort.abort(),
                respondToRequest: async () => { throw new Error("AG-UI remote interrupts are not mapped to MausCrew approvals yet"); },
                hasSession: (threadId) => active.has(threadId),
                stopAll: async () => { for (const run of active.values())
                    run.abort.abort(); },
                onEvent: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
            },
            dispose: async () => {
                for (const run of active.values())
                    run.abort.abort();
                active.clear();
                listeners.clear();
            },
        };
    },
};
