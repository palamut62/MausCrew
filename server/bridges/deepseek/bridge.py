#!/usr/bin/env python3
"""OpenMausBot ↔ DeepSeek Harness bridge.

One long-lived process per provider instance (spec §13). The DeepSeekHarness
runtime is created lazily on the first turn and reused for every turn after
it, so session state, the persistent shell and startup cost all survive
across messages. Spawning a process per turn would throw all three away.

Protocol: newline-delimited JSON on stdio, versioned by the bridge.ready
handshake this process sends before anything else (spec §14, §15).

Two invariants that the transport depends on:

  * stdout carries protocol messages and nothing else. A stray print() here
    desynchronizes the Node parser, which is why every diagnostic goes to
    stderr through log() (spec §23).
  * secrets never appear in output. Errors are relayed by message, and the
    environment is never dumped, even on a crash (spec §56).

The SDK's run() is blocking, so each turn executes on its own worker thread
and stdin keeps being read while a turn is in flight (spec §16). Without
that the bridge could not accept a shutdown — or anything else — mid-turn.
"""

from __future__ import annotations

import json
import os
import sys
import threading
import traceback
from typing import Any, Callable

PROTOCOL_VERSION = 1

_stdout_lock = threading.Lock()


def log(message: str) -> None:
    """Diagnostics — stderr only, never stdout."""
    print(f"[deepseek-harness] {message}", file=sys.stderr, flush=True)


def emit(payload: dict) -> None:
    """Write one protocol message. Serialized: worker threads share stdout.

    ensure_ascii=False keeps Turkish, CJK and emoji intact as UTF-8 rather
    than expanding them into escapes (spec §78).
    """
    line = json.dumps(payload, ensure_ascii=False)
    with _stdout_lock:
        sys.stdout.write(line + "\n")
        sys.stdout.flush()


def emit_error(request_id: str | None, code: str, message: str) -> None:
    emit({"type": "error", "requestId": request_id, "code": code, "message": message})


# ── SDK import, deferred and fail-closed ────────────────────────────────
# Import failure is a setup problem the user fixes by installing the SDK, so
# it is reported as a protocol message and the process exits rather than
# dying on a traceback the Node side would have to guess at.
try:
    from deepseek_harness import DeepSeekHarness, DeepSeekHarnessConfig  # type: ignore
except Exception as exc:  # noqa: BLE001 - any import failure is the same class of problem
    emit_error(None, "sdk_missing", f"ModuleNotFoundError: {exc}")
    sys.exit(3)

try:
    from importlib.metadata import version as _pkg_version

    SDK_VERSION: str | None = _pkg_version("deepseek-harness-sdk")
except Exception:  # noqa: BLE001 - version is informational; absence is not fatal
    SDK_VERSION = None


class RuntimePool:
    """Runtimes keyed by the settings that are fixed at construction time.

    DeepSeekHarnessConfig takes provider/model/cwd/cordis when the runtime is
    built, so a turn that changes any of them needs a different runtime. The
    pool keeps one per distinct combination instead of rebuilding per turn.
    """

    def __init__(self) -> None:
        self._runtimes: dict[tuple, Any] = {}
        self._lock = threading.Lock()

    def get(self, key: tuple, factory: Callable[[], Any]) -> Any:
        with self._lock:
            runtime = self._runtimes.get(key)
            if runtime is None:
                runtime = factory()
                self._runtimes[key] = runtime
            return runtime

    def close_all(self) -> None:
        with self._lock:
            runtimes = list(self._runtimes.values())
            self._runtimes.clear()
        for runtime in runtimes:
            try:
                runtime.close()
            except Exception as exc:  # noqa: BLE001 - shutdown is best-effort
                log(f"runtime close failed: {exc}")


POOL = RuntimePool()

# Turns in flight, so a cancel or a shutdown can stop forwarding their output.
#
# The runtime exposes no cancellation: its JSON-RPC surface is exactly
# initialize / session/prompt / shutdown (packages/sdk/server/src/server.ts),
# and AgentHandle has no abort. So "cancel" in this process means we stop
# relaying and let the call finish — capabilities.cancel stays false because
# that is what this process can honestly promise.
#
# Real cancellation exists one level up: the Node driver terminates this
# process when the cancelled turn is the last one running. That works because
# the session log on disk is the model's context, so the next turn reattaches
# by session id. It is deliberately not attempted here — this process cannot
# kill itself without also killing the sibling turns it is still serving.
ACTIVE: dict[str, dict] = {}
ACTIVE_LOCK = threading.Lock()


def env_str(name: str, fallback: str = "") -> str:
    value = os.environ.get(name)
    return value if isinstance(value, str) and value else fallback


def build_runtime(model: str, cwd: str | None, max_tokens: int | None, system: str | None) -> Any:
    provider = env_str("DSH_BRIDGE_PROVIDER", "deepseek-official")
    session_root = env_str("DSH_SESSION_ROOT") or None
    cordis = env_str("DSH_CORDIS_CONFIG") or None
    base_url = env_str("DEEPSEEK_BASE_URL") or None

    # Persona reaches the agent only through the composition, which reads it
    # from DSH_SYSTEM_PROMPT — the SDK has no system_prompt parameter (its own
    # test suite asserts the absence). That variable is process-global, so a
    # bridge serving more than one persona would leak one bot's instructions
    # into another. The Node side keeps one bridge per provider instance to
    # avoid that; here we only pass it through.
    env: dict[str, str] = {}
    if system:
        env["DSH_SYSTEM_PROMPT"] = system

    config = DeepSeekHarnessConfig(
        provider=provider,
        model=model,
        max_tokens=max_tokens,
        cwd=cwd,
        session_root=session_root,
        cordis=cordis,
        base_url=base_url,
        env=env,
    )
    return DeepSeekHarness(config)


def forward_notification(request_id: str, session_id: str, descendants: set[str], notification: Any) -> None:
    """Translate one SDK notification into protocol messages.

    Only root-session *content* events are forwarded. Subagent sessions arrive
    here too, but relaying their deltas would interleave two narrators into
    one transcript. Their lifecycle is forwarded instead, as a single activity
    chip per child (spec §50).
    """
    method = getattr(notification, "method", None)
    payload = getattr(notification, "payload", None) or {}

    # subagent.started / subagent.finished carry parentSessionId +
    # childSessionId (packages/sdk/protocol/src/types.ts). Delegation nests,
    # so a child can itself delegate; `descendants` tracks the sessions we
    # have already accepted so a grandchild is still recognized as belonging
    # to this turn rather than silently dropped.
    if method in ("subagent.started", "subagent.finished"):
        parent = payload.get("parentSessionId")
        child = payload.get("childSessionId")
        if not isinstance(child, str) or not child:
            return
        if parent != session_id and parent not in descendants:
            return
        if method == "subagent.started":
            descendants.add(child)
            emit({"type": "subagent.started", "requestId": request_id, "childSessionId": child})
            return
        emit({
            "type": "subagent.finished",
            "requestId": request_id,
            "childSessionId": child,
            "provider": str(payload.get("provider") or "subagent"),
            # 'ok' | 'error' is the deployment-mapped outcome; anything that is
            # not an explicit ok is reported as a failed chip rather than
            # guessed at, so a child that errored never renders as finished.
            "ok": payload.get("status") == "ok",
            "stopReason": str(payload.get("stopReason") or "completed"),
        })
        return

    if method != "session.event":
        return
    if payload.get("sessionId") != session_id:
        return
    event = payload.get("event")
    if not isinstance(event, dict):
        return

    etype = event.get("type")
    data = event.get("data")
    if not isinstance(data, dict):
        data = {}

    if etype == "assistant/chunk":
        chunk = data.get("chunk")
        if not isinstance(chunk, dict):
            return
        kind = chunk.get("type")
        text = chunk.get("text")
        if kind == "text-delta" and text:
            emit({"type": "assistant.delta", "requestId": request_id, "delta": str(text)})
        elif kind == "reasoning-delta" and text:
            emit({"type": "reasoning.delta", "requestId": request_id, "delta": str(text)})
        elif kind == "usage":
            emit_usage(request_id, chunk.get("usage"))
        return

    if etype == "assistant/message":
        emit_usage(request_id, data.get("usage"))
        return

    if etype == "tool/call":
        call_id = str(data.get("callId") or f"{request_id}-tool")
        name = str(data.get("name") or "tool")
        emit({
            "type": "tool.started",
            "requestId": request_id,
            "tool": name,
            "itemId": call_id,
            "title": summarize_tool(name, data.get("arguments")),
        })
        return

    if etype == "tool/result":
        message = data.get("message")
        message = message if isinstance(message, dict) else {}
        call_id = str(message.get("callId") or data.get("callId") or f"{request_id}-tool")
        emit({
            "type": "tool.completed",
            "requestId": request_id,
            "itemId": call_id,
            "ok": not bool(message.get("isError")),
        })
        return


def emit_usage(request_id: str, usage: Any) -> None:
    if not isinstance(usage, dict):
        return
    input_tokens = usage.get("inputTokens")
    output_tokens = usage.get("outputTokens")
    if not isinstance(input_tokens, int) and not isinstance(output_tokens, int):
        return
    emit({
        "type": "token.usage",
        "requestId": request_id,
        "input": input_tokens if isinstance(input_tokens, int) else 0,
        "output": output_tokens if isinstance(output_tokens, int) else 0,
    })


def summarize_tool(name: str, arguments: Any) -> str:
    """A short label for the activity chip.

    Tool arguments can carry file contents or command output, so this takes a
    prefix and never the whole payload.
    """
    if isinstance(arguments, str):
        text = arguments
    elif isinstance(arguments, dict):
        for field in ("command", "path", "file_path", "query"):
            value = arguments.get(field)
            if isinstance(value, str) and value:
                text = value
                break
        else:
            text = ""
    else:
        text = ""
    text = text.replace("\n", " ").strip()
    return f"{name}: {text[:60]}" if text else name


def run_turn(command: dict) -> None:
    request_id = str(command.get("requestId") or "")
    session_id = str(command.get("sessionId") or "")
    prompt = command.get("prompt")
    if not request_id or not session_id or not isinstance(prompt, str):
        emit_error(request_id or None, "bad_request", "turn.start needs requestId, sessionId and prompt")
        return

    model = str(command.get("model") or env_str("DSH_BRIDGE_MODEL", "deepseek-v4-flash"))
    cwd = command.get("cwd") if isinstance(command.get("cwd"), str) else None
    max_tokens = command.get("maxTokens") if isinstance(command.get("maxTokens"), int) else None
    system = command.get("system") if isinstance(command.get("system"), str) else None

    def cancelled() -> bool:
        with ACTIVE_LOCK:
            entry = ACTIVE.get(request_id)
            return entry is None or entry.get("cancelled", False)

    try:
        runtime = POOL.get(
            (model, cwd, max_tokens, system),
            lambda: build_runtime(model, cwd, max_tokens, system),
        )
        emit({"type": "turn.started", "requestId": request_id, "sessionId": session_id})
        emit({"type": "session.started", "requestId": request_id, "sessionId": session_id, "model": model})

        # Child sessions delegated by this turn, so nested delegation is still
        # attributed here. Per-turn, never shared: two turns must not see each
        # other's children.
        descendants: set[str] = set()

        def on_notification(notification: Any) -> None:
            if cancelled():
                return
            try:
                forward_notification(request_id, session_id, descendants, notification)
            except Exception as exc:  # noqa: BLE001 - one bad event must not kill the turn
                log(f"notification forwarding failed: {exc}")

        result = runtime.run(prompt, session_id=session_id, on_notification=on_notification)

        if cancelled():
            emit({
                "type": "turn.completed",
                "requestId": request_id,
                "finishReason": "cancelled",
                "finalResponse": "",
                "sessionId": session_id,
            })
            return

        final_response = getattr(result, "final_response", "") or ""
        if final_response:
            emit({"type": "assistant.message", "requestId": request_id, "text": final_response})
        emit({
            "type": "turn.completed",
            "requestId": request_id,
            "finishReason": getattr(result, "finish_reason", None),
            "finalResponse": final_response,
            "sessionId": getattr(result, "session_id", session_id),
        })
    except Exception as exc:  # noqa: BLE001 - every failure must settle the turn
        # The traceback goes to stderr for debugging; the user-facing channel
        # gets the message only, so nothing from the environment leaks.
        log("turn failed:\n" + traceback.format_exc())
        emit_error(request_id, "runtime_error", f"{type(exc).__name__}: {exc}")
        emit({
            "type": "turn.completed",
            "requestId": request_id,
            "finishReason": "error",
            "finalResponse": "",
            "sessionId": session_id,
        })
    finally:
        with ACTIVE_LOCK:
            ACTIVE.pop(request_id, None)


def handle_command(command: dict) -> bool:
    """Dispatch one command. Returns False when the bridge should exit."""
    ctype = command.get("type")

    if ctype == "shutdown":
        return False

    if ctype == "turn.start":
        request_id = str(command.get("requestId") or "")
        with ACTIVE_LOCK:
            if request_id in ACTIVE:
                emit_error(request_id, "bad_request", "that requestId is already running")
                return True
            ACTIVE[request_id] = {"cancelled": False}
        thread = threading.Thread(target=run_turn, args=(command,), name=f"turn-{request_id}", daemon=True)
        with ACTIVE_LOCK:
            ACTIVE[request_id]["thread"] = thread
        thread.start()
        return True

    if ctype == "turn.cancel":
        request_id = str(command.get("requestId") or "")
        with ACTIVE_LOCK:
            entry = ACTIVE.get(request_id)
            if entry is not None:
                entry["cancelled"] = True
        # No settlement here: run_turn emits turn.completed when the blocking
        # call returns. Emitting it now would let a second turn start on the
        # same session while the first is still writing to it.
        return True

    if ctype == "approval.respond":
        # Approvals exist, but they do not travel this pipe. The gate is a
        # Cordis plugin inside the runtime — a different process from this
        # one, possibly on the other side of a WSL boundary — and it talks to
        # the driver through the file mailbox under DSH_SESSION_ROOT
        # (see server/drivers/deepseek/approval-mailbox.ts). Nothing here can
        # deliver a decision, and pretending otherwise would strand a tool
        # call waiting on an answer that never arrives (spec §36, §37).
        emit_error(
            str(command.get("requestId") or "") or None,
            "unsupported",
            "approvals are brokered through the session mailbox, not this bridge",
        )
        return True

    emit_error(None, "bad_request", f"unknown command type: {ctype!r}")
    return True


def main() -> int:
    # stdio must be UTF-8 in both directions regardless of the host locale,
    # or Turkish and CJK text is mangled on Windows consoles (spec §78).
    for stream in (sys.stdout, sys.stderr, sys.stdin):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is not None:
            reconfigure(encoding="utf-8", errors="replace")

    emit({
        "type": "bridge.ready",
        "protocolVersion": PROTOCOL_VERSION,
        "sdkVersion": SDK_VERSION,
        "capabilities": {
            "streaming": True,
            "sessions": True,
            # what *this process* can do; the driver's hard cancel is separate
            "cancel": False,
            "approvals": False,
        },
    })

    try:
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            try:
                command = json.loads(line)
            except json.JSONDecodeError as exc:
                emit_error(None, "bad_request", f"malformed JSON: {exc}")
                continue
            if not isinstance(command, dict):
                emit_error(None, "bad_request", "expected a JSON object")
                continue
            if not handle_command(command):
                break
    except KeyboardInterrupt:
        pass
    finally:
        with ACTIVE_LOCK:
            for entry in ACTIVE.values():
                entry["cancelled"] = True
        POOL.close_all()
    return 0


if __name__ == "__main__":
    sys.exit(main())
