#!/usr/bin/env node
// A scripted stand-in for server/bridges/deepseek/bridge.py.
//
// Written in Node rather than Python so the driver's contract tests run on
// any machine, including one with no Python and no DeepSeek SDK. It speaks
// the same newline-JSON protocol; the driver cannot tell the difference,
// which is the point — these tests exercise the Node half, not the SDK.
//
// FAKE_DSH_MODE selects the scenario. Everything it prints on stdout is
// protocol; diagnostics go to stderr, same rule as the real bridge.
import { createInterface } from "node:readline";

const MODE = process.env.FAKE_DSH_MODE ?? "happy";
const PROTOCOL = Number(process.env.FAKE_DSH_PROTOCOL ?? "1");

function emit(message: Record<string, unknown>): void {
  process.stdout.write(JSON.stringify(message) + "\n");
}

if (MODE === "sdk-missing") {
  emit({
    type: "error",
    requestId: null,
    code: "sdk_missing",
    message: "ModuleNotFoundError: No module named 'deepseek_harness'",
  });
  process.exit(3);
}

if (MODE === "silent") {
  // never greets — exercises the handshake timeout
  setInterval(() => {}, 1 << 30);
} else if (MODE === "crash-on-start") {
  process.stderr.write("boom: the runtime could not start\n");
  process.exit(1);
} else {
  emit({
    type: "bridge.ready",
    protocolVersion: PROTOCOL,
    sdkVersion: "0.0.0-fake",
    capabilities: { streaming: true, sessions: true, cancel: false, approvals: false },
  });
}

// Dump what we were given so tests can assert on the environment and on the
// exact commands the driver sent (spec §12: no stray credentials).
const DUMP = process.env.FAKE_DSH_DUMP;
const received: unknown[] = [];
function record(command: unknown): void {
  if (!DUMP) return;
  received.push(command);
  void import("node:fs").then((fs) => {
    fs.writeFileSync(DUMP, JSON.stringify({ env: process.env, commands: received }, null, 2));
  });
}

function runTurn(command: Record<string, unknown>): void {
  const requestId = String(command.requestId);
  emit({ type: "turn.started", requestId, threadId: command.threadId });
  emit({ type: "session.started", requestId, sessionId: command.sessionId, model: command.model ?? null });

  if (MODE === "crash-mid-turn") {
    process.stderr.write("bridge died mid-turn\n");
    process.exit(9);
  }

  if (MODE === "error-turn") {
    emit({ type: "error", requestId, code: "unauthorized", message: "401 Unauthorized" });
    return;
  }

  // Accepts the turn and then never finishes it — the shape of a runtime
  // that hangs after taking the prompt, which is what the driver's watchdog
  // and its hard cancel both exist for.
  if (MODE === "hang") return;

  if (MODE === "subagent") {
    emit({
      type: "subagent.started",
      requestId,
      parentSessionId: command.sessionId,
      childSessionId: "child-abcdef123456",
    });
    emit({
      type: "subagent.finished",
      requestId,
      childSessionId: "child-abcdef123456",
      parentSessionId: command.sessionId,
      provider: "local",
      agentId: "researcher",
      ok: true,
      stopReason: "completed",
      lastAssistantMessage: "Reviewed the delegated files and found no remaining failures.",
    });
  }

  if (MODE === "tools") {
    emit({ type: "tool.started", requestId, tool: "bash", itemId: `${requestId}-1`, title: "ls -la" });
    emit({ type: "tool.completed", requestId, itemId: `${requestId}-1`, ok: true });
  }

  // Unicode split across deltas on purpose: the driver must reassemble the
  // stream without mangling multibyte text.
  emit({ type: "reasoning.delta", requestId, delta: "düşünüyorum" });
  emit({ type: "assistant.delta", requestId, delta: "Merhaba " });
  emit({ type: "assistant.delta", requestId, delta: "dünya 🌍" });
  // usage first: bridge.py emits it from the assistant/message event, and the
  // final text only after the blocking run() returns
  emit({ type: "token.usage", requestId, input: 12, output: 34 });
  emit({ type: "assistant.message", requestId, text: "Merhaba dünya 🌍" });
  emit({
    type: "turn.completed",
    requestId,
    finishReason: MODE === "stopped-turn" ? "length" : "completed",
    finalResponse: "Merhaba dünya 🌍",
    sessionId: command.sessionId,
  });
}

const rl = createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let command: Record<string, unknown>;
  try {
    command = JSON.parse(trimmed);
  } catch {
    process.stderr.write(`unparseable command: ${trimmed}\n`);
    return;
  }
  record(command);

  switch (command.type) {
    case "turn.start":
      // a tick of delay so the driver's own turn.started lands first, the
      // ordering a real out-of-process bridge produces
      setTimeout(() => runTurn(command), 5);
      break;
    case "shutdown":
      process.exit(0);
      break;
    default:
      // turn.cancel and approval.respond are recorded, not acted on — the
      // real bridge cannot honor either yet
      break;
  }
});
