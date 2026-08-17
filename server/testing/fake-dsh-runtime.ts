#!/usr/bin/env node
// A scripted stand-in for the DeepSeek Harness SDK JSON-RPC runtime.
//
// The twin of fake-deepseek-bridge.ts, one layer down: that one fakes our own
// Python bridge, this one fakes the thing the bridge was talking to. The two
// are scripted to produce the SAME conversation, which is what makes the
// parity suite meaningful — feed each transport its own fake, compare the
// RuntimeEvents that come out, and any difference is a real difference in the
// transport rather than in the scenario.
//
// Every frame here is shaped from the upstream reference, not invented:
// `packages/sdk/protocol/src/types.ts` for the notification payloads, and the
// session-event vocabulary (`agent/inbox/spliced`, `assistant/chunk`,
// `assistant/message`, `tool/call`, `tool/result`, `turn/end`) as
// `python/sdk/src/deepseek_harness/api.py` consumes it.
//
// FAKE_DSH_MODE selects the scenario, matching the Python fake's names.
import { createInterface } from "node:readline";

const MODE = process.env.FAKE_DSH_MODE ?? "happy";
const SERVER_NAME = process.env.FAKE_DSH_SERVER_NAME ?? "deepseek-harness-sdk-runtime";

function send(frame: Record<string, unknown>): void {
  process.stdout.write(JSON.stringify(frame) + "\n");
}

function notify(method: string, params: Record<string, unknown>): void {
  send({ jsonrpc: "2.0", method, params });
}

function sessionEvent(sessionId: string, type: string, data: Record<string, unknown>): void {
  notify("session.event", { sessionId, event: { type, data } });
}

const DUMP = process.env.FAKE_DSH_DUMP;
const received: unknown[] = [];
function record(frame: unknown): void {
  if (!DUMP) return;
  received.push(frame);
  void import("node:fs").then((fs) => {
    fs.writeFileSync(DUMP, JSON.stringify({ env: process.env, commands: received }, null, 2));
  });
}

if (MODE === "crash-on-start") {
  process.stderr.write("boom: the runtime could not start\n");
  process.exit(1);
}

let messageSerial = 0;

function runTurn(sessionId: string, messageId: string): void {
  // The receipt. Until the driver sees this it must not treat an idle status
  // as the end of its turn — that gate is the whole reason this frame exists.
  sessionEvent(sessionId, "agent/inbox/spliced", { inserted: [{ id: messageId }] });
  notify("session.status", { sessionId, status: "running" });

  if (MODE === "crash-mid-turn") {
    process.stderr.write("runtime died mid-turn\n");
    process.exit(9);
  }

  // Accepts the prompt and then never finishes it.
  if (MODE === "hang") return;

  if (MODE === "subagent") {
    notify("subagent.started", { parentSessionId: sessionId, childSessionId: "child-abcdef123456" });
    notify("subagent.finished", {
      provider: "local",
      agentId: "child-abcdef123456",
      parentSessionId: sessionId,
      childSessionId: "child-abcdef123456",
      status: "ok",
      stopReason: "completed",
    });
  }

  if (MODE === "tools") {
    sessionEvent(sessionId, "tool/call", { callId: "call-1", name: "bash", arguments: { command: "ls -la" } });
    sessionEvent(sessionId, "tool/result", { message: { callId: "call-1", isError: false } });
  }

  sessionEvent(sessionId, "assistant/chunk", { chunk: { type: "reasoning-delta", text: "düşünüyorum" } });
  sessionEvent(sessionId, "assistant/chunk", { chunk: { type: "text-delta", text: "Merhaba " } });
  sessionEvent(sessionId, "assistant/chunk", { chunk: { type: "text-delta", text: "dünya 🌍" } });
  sessionEvent(sessionId, "assistant/message", {
    message: { content: [{ type: "text", text: "Merhaba dünya 🌍" }] },
    usage: { inputTokens: 12, outputTokens: 34 },
  });
  sessionEvent(sessionId, "turn/end", {
    reason: { kind: MODE === "stopped-turn" ? "length" : "completed" },
  });
  notify("session.status", { sessionId, status: "idle" });
}

const rl = createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let frame: Record<string, unknown>;
  try {
    frame = JSON.parse(trimmed);
  } catch {
    process.stderr.write(`unparseable frame: ${trimmed}\n`);
    return;
  }
  record(frame);
  const id = frame.id;
  const params = (frame.params ?? {}) as Record<string, unknown>;

  switch (frame.method) {
    case "initialize":
      if (MODE === "silent") return; // never answers — exercises the handshake timeout
      if (MODE === "sdk-missing") {
        send({ jsonrpc: "2.0", id, error: { code: -32603, message: "no adapter registered for provider" } });
        return;
      }
      send({ jsonrpc: "2.0", id, result: { serverInfo: { name: SERVER_NAME, version: "0.0.0-fake" } } });
      return;
    case "session/prompt": {
      if (MODE === "reject-prompt") {
        send({ jsonrpc: "2.0", id, error: { code: -32603, message: "session agent was disposed outside the server" } });
        return;
      }
      const sessionId = String(params.sessionId ?? "");
      const messageId = `msg-${++messageSerial}`;
      send({ jsonrpc: "2.0", id, result: { messageId } });
      // A tick of delay so the response lands before the notifications, the
      // ordering a real out-of-process runtime produces.
      setTimeout(() => runTurn(sessionId, messageId), 5);
      return;
    }
    case "shutdown":
      send({ jsonrpc: "2.0", id, result: {} });
      setTimeout(() => process.exit(0), 5);
      return;
    default:
      if (id !== undefined) send({ jsonrpc: "2.0", id, error: { code: -32601, message: "method not found" } });
      return;
  }
});
