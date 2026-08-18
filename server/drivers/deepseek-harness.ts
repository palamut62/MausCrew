// DeepSeek Harness provider driver (spec §10–§13, §22).
//
// Unlike codex.ts, which spawns a CLI per turn, this driver owns one
// long-lived Python bridge per provider instance. That is forced rather than
// chosen: the SDK has no per-call system-prompt parameter, so a bot's persona
// only reaches the model through the runtime's process-global composition
// (deviation D5). One persona per process therefore means one process per
// provider instance.
//
// Everything the bridge cannot honestly do is reported as unsupported rather
// than approximated (spec §54). In this phase that means no in-session model
// switching, and cancellation that says which of its two forms it took.
import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";

import type {
  DriverCreateInput,
  ProviderAdapter,
  ProviderDriver,
  ProviderInstance,
  ProviderSnapshot,
  RuntimeEvent,
  RuntimeEventListener,
  SendTurnInput,
  ThreadId,
  TurnId,
  TurnStartResult,
} from "../contracts.ts";
import { newEventId, newId } from "../contracts.ts";
import type { ModelCatalog } from "../contracts.ts";
import type { DeepSeekHarnessConfig } from "./deepseek/config.ts";
import { approvalsActive, decodeConfig, defaultConfig, describeBaseUrl } from "./deepseek/config.ts";
import { ApprovalMailbox } from "./deepseek/approval-mailbox.ts";
import { composeFor, mountFingerprint, mountSupport, mountsFor } from "./deepseek/composition.ts";
import { DeepSeekBridge } from "./deepseek/bridge.ts";
import { NativeDeepSeekBridge, checkNativeLaunch } from "./deepseek/native-bridge.ts";
import type { BridgeMessage } from "./deepseek/bridge-protocol.ts";
import { mapMessage, isSuccessfulFinish, isTerminal } from "./deepseek/event-mapper.ts";
import { catalogFor, discoverModels, MODELS } from "./deepseek/model-catalog.ts";
import { probeSdk, resolveBundledRuntime, runtimePath } from "./deepseek/process-manager.ts";
import { defaultWorkspaceFor, sessionIdFor, sessionRootFor } from "./deepseek/session-manager.ts";
import { DeepSeekBridgeError, describeError, toRuntimeError } from "./deepseek/errors.ts";

export const DRIVER_KIND = "deepseek-harness";

interface ActiveTurn {
  turnId: TurnId;
  threadId: ThreadId;
  requestId: string;
  settled: boolean;
  /** Cleared by settle(). A turn that ends normally must not later be
   * killed by its own watchdog. */
  timeout?: ReturnType<typeof setTimeout>;
}

/** Test seam. The driver itself never passes these — it is the same role
 * `config.cli` plays for codex.ts, kept off the config shape because a
 * bridge script path is not something a user should be able to point
 * anywhere (spec §81). */
export interface DeepSeekInstanceOptions {
  /** Run a different bridge script. Contract tests point this at a fake. */
  scriptPath?: string;
}

export const deepSeekHarnessDriver: ProviderDriver<DeepSeekHarnessConfig> = {
  driverKind: DRIVER_KIND,
  metadata: { displayName: "DeepSeek Harness", supportsMultipleInstances: true },
  install: {
    command: {
      darwin:
        "python3 -m venv ~/.mauscrew/runtimes/deepseek/venv && ~/.mauscrew/runtimes/deepseek/venv/bin/python -m pip install --pre deepseek-harness-sdk==0.1.0rc6 deepseek-harness-runtime-bin==0.1.0rc6",
      linux:
        "python3 -m venv ~/.mauscrew/runtimes/deepseek/venv && ~/.mauscrew/runtimes/deepseek/venv/bin/python -m pip install --pre deepseek-harness-sdk==0.1.0rc6 deepseek-harness-runtime-bin==0.1.0rc6",
      // no native Windows runtime wheel exists; create the managed carrier
      // inside the default WSL distribution the driver will call (spec §8)
      win32:
        'wsl.exe sh -lc "python3 -m venv ~/.mauscrew/runtimes/deepseek/venv && ~/.mauscrew/runtimes/deepseek/venv/bin/python -m pip install --pre deepseek-harness-sdk==0.1.0rc6 deepseek-harness-runtime-bin==0.1.0rc6"',
    },
    docsUrl: "https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/python-sdk.md",
  },
  decodeConfig,
  defaultConfig,
  models: MODELS,

  create(input: DriverCreateInput<DeepSeekHarnessConfig>): Promise<ProviderInstance> {
    return createDeepSeekInstance(input);
  },
};

export async function createDeepSeekInstance(
  input: DriverCreateInput<DeepSeekHarnessConfig>,
  options: DeepSeekInstanceOptions = {},
): Promise<ProviderInstance> {
  {
    const { instanceId, environment } = input;
    let config = input.config;
    let bundledRuntimeReason = "";
    if (
      config.runtime.strategy === "bundled"
      && config.transport.mode === "native"
      && config.transport.launchArgs.length === 0
    ) {
      const resolved = await resolveBundledRuntime(config);
      bundledRuntimeReason = resolved.reason ?? "";
      if (resolved.launchArgs.length) {
        config = { ...config, transport: { ...config.transport, launchArgs: resolved.launchArgs } };
      }
    }
    const apiKey = environment[config.apiKeyEnv] ?? "";
    const sessionRoot = sessionRootFor(instanceId, config.sessionRoot);

    /** Whether anything on the other side will ever ask us a question. Both
     * halves have to agree: the composition must contain the gate, and the
     * policy must be `ask`. Under `never` the plugin refuses locally and no
     * request is ever written, so watching for one would be theatre. */
    const approvalsEnabled = approvalsActive(config) && config.approval.policy === "ask";

    const listeners = new Set<RuntimeEventListener>();
    /** requestId → turn. The bridge multiplexes every thread over one pipe,
     * so correlation is by request id, not by process. */
    const byRequest = new Map<string, ActiveTurn>();
    /** One in-flight turn per thread; different threads run in parallel
     * (spec §17) because the runtime keys its sessions independently. */
    const byThread = new Map<ThreadId, ActiveTurn>();
    const startedSessions = new Set<ThreadId>();
    /** Runtime session id chosen for each thread in this process incarnation.
     * rc6's JSON-RPC server always calls agents.create(), even when a durable
     * log with that id already exists. On a fresh MausCrew instance we use a
     * history-derived incarnation id and replay the active transcript once;
     * later turns stay on that same live runtime session. */
    const runtimeSessionByThread = new Map<ThreadId, string>();
    /** Runtime session id → thread, so a request written by the plugin finds
     * the conversation it belongs to. Populated on every turn rather than
     * derived by parsing, because the id format is ours to change. */
    const threadBySession = new Map<string, ThreadId>();
    /** Approval id → the thread whose card is showing it. */
    const approvalThread = new Map<string, ThreadId>();
    let disposed = false;

    const emit = (event: RuntimeEvent) => {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch {
          // a listener that throws must not take down the bridge reader
        }
      }
    };

    const baseEvent = (turn: ActiveTurn) => ({
      eventId: newEventId(),
      provider: DRIVER_KIND,
      providerInstanceId: instanceId,
      threadId: turn.threadId,
      turnId: turn.turnId,
      createdAt: new Date().toISOString(),
    });

    /** Settle a turn exactly once. Every exit path — normal completion,
     * error, bridge death, dispose — funnels through here so a thread can
     * never be left permanently busy (spec §46). */
    const settle = (turn: ActiveTurn, ok: boolean, stopReason: string | null) => {
      if (turn.settled) return;
      turn.settled = true;
      if (turn.timeout) clearTimeout(turn.timeout);
      // A question outlives nothing. The call that asked it is over, so any
      // card still open on this thread resolves to no (spec §43, P3-07) —
      // leaving it open would mean a click minutes from now authorizing a
      // tool call that already gave up waiting.
      for (const [id, threadId] of [...approvalThread]) {
        if (threadId !== turn.threadId) continue;
        approvalThread.delete(id);
        mailbox.respond(id, "deny", "the turn ended before this was answered");
        emit({ ...baseEvent(turn), requestId: id, type: "request.resolved", behavior: "deny", source: "turn-ended" });
      }
      byRequest.delete(turn.requestId);
      if (byThread.get(turn.threadId) === turn) byThread.delete(turn.threadId);
      emit({ ...baseEvent(turn), type: "turn.completed", ok, stopReason, cost: null });
    };

    /** The approval broker's driver half (spec §37–§43). Constructed always,
     * started only when the composition actually contains the gate — an
     * inert mailbox costs nothing and keeps every call site below free of
     * "is it on" branching. */
    const mailbox = new ApprovalMailbox({
      sessionRoot,
      timeoutMs: config.approval.timeoutMs,
      onRequest: (request) => {
        const threadId = threadBySession.get(request.sessionId);
        const turn = threadId ? byThread.get(threadId) : undefined;
        if (!turn) {
          // A question from a session we are not tracking — a leftover from
          // a turn that already settled, or a subagent's own session. We
          // cannot show it to anyone, so it cannot be allowed.
          mailbox.respond(request.id, "deny", "this request arrived for a conversation that is no longer waiting");
          return;
        }
        approvalThread.set(request.id, turn.threadId);
        emit({
          ...baseEvent(turn),
          requestId: request.id,
          type: "request.opened",
          requestType: "permission",
          tool: request.tool,
          // No `choices`: a permission card's buttons are the app's own
          // Allow/Deny, and supplying labels here would only make this
          // provider's cards look different from every other one's.
          summary: request.summary,
        });
      },
    });

    /** The bridge process starts once and keeps its cwd for its whole life,
     * so the first turn's workspace is the instance's workspace. Per-turn
     * cwd still rides on turn.start for the runtime's own tools. */
    let currentWorkspace = defaultWorkspaceFor(instanceId, "default");

    /** Which integrations this instance can mount at all, decided once from
     * the config (spec §52, §53). Under WSL the stdio proxies are host
     * binaries the Linux runtime cannot run, so they are simply not offered. */
    const support = mountSupport(config);

    /** The composition the live runtime was started with, and the mounts it
     * describes. Like `currentWorkspace`, these belong to the process rather
     * than to a turn: DSH_CORDIS_CONFIG is read once at startup, so changing
     * the mounted set means a new process. */
    let mountedComposition: string | null = null;
    let mountedFingerprint = "";

    // Which transport this instance speaks (spec §88). The two are
    // interchangeable by construction — same surface, same message stream —
    // so everything below this line is written once and works for both.
    const native = config.transport.mode === "native";
    const Transport = native ? NativeDeepSeekBridge : DeepSeekBridge;

    const bridge: DeepSeekBridge | NativeDeepSeekBridge = new Transport(
      () => ({
        // The generated composition replaces the configured one for the life
        // of this process. It is a superset — the base file verbatim plus the
        // mounts — so the approval gate and the adapters are still there.
        config: mountedComposition
          ? { ...config, cordis: { ...config.cordis, configPath: mountedComposition } }
          : config,
        apiKey,
        sessionRoot,
        instanceEnv: environment,
        approvalChannelActive: approvalsEnabled,
        cwd: currentWorkspace,
        ...(options.scriptPath ? { scriptPath: options.scriptPath } : {}),
      }),
      {
        onMessage: (message: BridgeMessage, raw: unknown) => {
          const requestId = "requestId" in message ? message.requestId : null;
          const turn = requestId ? byRequest.get(requestId) : null;
          if (!turn) {
            // An untied error is a bridge-level failure (no turn to blame);
            // anything else without a turn is a late message for a turn we
            // already settled, and replaying it would reopen a closed turn.
            if (message.type === "error") emitBridgeError(message.message || message.code);
            return;
          }

          for (const event of mapMessage(message, {
            provider: DRIVER_KIND,
            providerInstanceId: instanceId,
            threadId: turn.threadId,
            turnId: turn.turnId,
            raw,
          })) {
            // turn.started is emitted by sendTurn and turn.completed by
            // settle(), so both are owned by the driver's own lifecycle. The
            // bridge's copies would double up and, for completion, bypass
            // the once-only guard.
            if (event.type === "turn.completed" || event.type === "turn.started") continue;
            emit(event);
          }

          if (message.type === "session.started") startedSessions.add(turn.threadId);
          if (message.type === "error") settle(turn, false, "error");
          else if (isTerminal(message)) {
            const reason = message.type === "turn.completed" ? message.finishReason : null;
            const ok = isSuccessfulFinish(reason);
            settle(turn, ok, ok ? null : reason);
          }
        },
        onExit: ({ expected, code, stderr }) => {
          if (expected) return;
          // The next process cannot reopen rc6's existing runtime session id;
          // choose a replay incarnation on the next dispatched turn.
          startedSessions.clear();
          runtimeSessionByThread.clear();
          const detail = stderr.trim().slice(-300) || `exit code ${code}`;
          const { message, setup } = describeError("bridge_crashed", detail);
          for (const turn of [...byRequest.values()]) {
            emit({ ...baseEvent(turn), type: "runtime.error", message, ...(setup ? { setup: true } : {}) });
            settle(turn, false, "bridge_crashed");
          }
        },
      },
    );

    /** Stop a turn for real, or say so when we cannot (spec §44).
     *
     * There is no cancel on the wire — the SDK runtime answers exactly
     * `initialize`, `session/prompt` and `shutdown` — so the only thing that
     * genuinely halts a model call is killing the process. That is safe
     * because the DeepSeek session log is the context and it is already on
     * disk; the next turn reattaches by deterministic session id.
     *
     * It is also indiscriminate: one process serves every thread on this
     * instance. So the hard path is taken only when the turn being stopped
     * is the last one running. With a sibling turn in flight, killing would
     * cancel someone else's work to satisfy this request, and the soft path
     * — stop relaying, settle, let the call finish unobserved — is the
     * lesser harm. The reason is reported either way rather than presenting
     * a detached turn as a stopped one. */
    const cancelTurn = async (turn: ActiveTurn, stopReason: string): Promise<void> => {
      const alone = byRequest.size <= 1;
      try {
        bridge.send({ type: "turn.cancel", requestId: turn.requestId });
      } catch {
        // bridge already gone; settling below is the whole remedy
      }
      settle(turn, false, stopReason);
      if (!alone) {
        emit({
          ...baseEvent(turn),
          type: "runtime.error",
          message:
            "Stopped waiting for this turn. Another turn is still running on this bot, so the DeepSeek runtime was left alive and this request finishes in the background — it does not consume the thread.",
        });
        return;
      }
      await bridge.cancelHard();
      startedSessions.clear();
      runtimeSessionByThread.clear();
    };

    function emitBridgeError(detail: string): void {
      const { message, setup } = toRuntimeError(detail, detail);
      emit({
        eventId: newEventId(),
        provider: DRIVER_KIND,
        providerInstanceId: instanceId,
        threadId: "",
        createdAt: new Date().toISOString(),
        type: "runtime.error",
        message,
        ...(setup ? { setup: true } : {}),
      });
    }

    const adapter: ProviderAdapter = {
      provider: DRIVER_KIND,
      capabilities: {
        // the runtime resolves its model when the composition is built, so a
        // switch means a new process, not an in-session change
        sessionModelSwitch: "unsupported",
        // Mounted as `@deepseek-ai/dsh-mcp-client` instances in a generated
        // composition (spec §52, §53). Reported from `mountSupport` rather
        // than hardcoded true: under WSL the stdio proxies cannot be launched
        // by a Linux runtime, and claiming otherwise would put a Local VM
        // option in front of a user for whom every call would fail (§54).
        agentsMcp: support.agentsMcp,
        computerMcp: support.computerMcp,
        composioMcp: support.composioMcp,
      },

      async sendTurn(turnInput: SendTurnInput): Promise<TurnStartResult> {
        if (disposed) throw new DeepSeekBridgeError("bridge_crashed", "this provider instance was disposed");

        if (!apiKey) {
          const { message } = describeError("credentials_missing");
          throw new DeepSeekBridgeError("credentials_missing", message);
        }
        if (byThread.has(turnInput.threadId)) {
          throw new Error("a turn is already running on this thread");
        }
        // A bundled runtime that could not be located leaves launchArgs empty,
        // and the transport can then only say "argv missing" — which is true
        // and useless, because the user never configures that argv for a
        // bundled runtime. The lookup already knows why it failed, so say
        // that instead. Same error kind, so the surfaces treat it the same.
        if (config.transport.mode === "native" && config.transport.launchArgs.length === 0 && bundledRuntimeReason) {
          throw new DeepSeekBridgeError(
            "sdk_missing",
            `the bundled DeepSeek Harness runtime could not be located: ${bundledRuntimeReason}`,
          );
        }

        const workspace = turnInput.cwd || defaultWorkspaceFor(instanceId, turnInput.threadId);
        await mkdir(workspace, { recursive: true });
        // Started before the runtime is, so the directory exists and is
        // clean before anything can write into it (P3-08).
        if (approvalsEnabled) mailbox.start();

        // Integration mounts (spec §52, §53). The composition is read once
        // per runtime process, so a change to the mounted set is a restart —
        // taken only when this instance has nothing else running, because one
        // process serves every thread and restarting under a sibling turn
        // would kill that turn to add a tool to this one.
        const mounts = mountsFor(turnInput.integrations, support);
        const requestedDynamicCordis = turnInput.runtimeFeatures?.dynamicCordis === true;
        // Dynamic Package code is allowed only when our own approval plugin
        // and live mailbox are both known to be present. A custom composition
        // may have a gate, but we cannot prove or answer it, so never append a
        // code runner to that unknown policy surface.
        const runtimeFeatures = {
          ...turnInput.runtimeFeatures,
          dynamicCordis: requestedDynamicCordis && approvalsEnabled,
        };
        const fingerprint = mountFingerprint(mounts, runtimeFeatures);
        let mountNote = requestedDynamicCordis && !approvalsEnabled
          ? "Dynamic Cordis was not enabled because this provider is not using MausCrew's active approval composition. Restore the bundled composition with approval policy Ask before enabling dynamic plugin code."
          : "";
        if (fingerprint !== mountedFingerprint) {
          if (byRequest.size > 0) {
            mountNote =
              "This turn asked for a different set of tools than the running DeepSeek runtime was started with. Another turn is still in flight on this bot, so the runtime was left alone and this turn runs with the tools already mounted. Send this message again once the other turn finishes.";
          } else {
            if (bridge.status().running) {
              await bridge.stop();
              startedSessions.clear();
              runtimeSessionByThread.clear();
            }
            mountedComposition = composeFor(config, sessionRoot, mounts, runtimeFeatures);
            mountedFingerprint = fingerprint;
            if ((mounts.length > 0 || runtimeFeatures.dynamicCordis === true) && !mountedComposition) {
              mountNote =
                "This bot's DeepSeek runtime extensions could not be mounted: mounting them means generating a Cordis composition, and the base composition this bot points at is missing. The turn runs without those tools (App Settings → DeepSeek Harness → composition).";
              mountedFingerprint = "";
            }
          }
        }

        if (!bridge.status().running) currentWorkspace = workspace;

        const runtimeSessionId = sessionForTurn(
          instanceId,
          turnInput.threadId,
          turnInput.transcript,
          runtimeSessionByThread,
        );
        const prompt = startedSessions.has(turnInput.threadId)
          ? turnInput.text
          : replayPrompt(turnInput.transcript, turnInput.text);
        const turn: ActiveTurn = {
          turnId: newId(),
          threadId: turnInput.threadId,
          requestId: newId(),
          settled: false,
        };
        byThread.set(turn.threadId, turn);
        byRequest.set(turn.requestId, turn);
        threadBySession.set(runtimeSessionId, turn.threadId);

        try {
          await bridge.ensureStarted();
          bridge.send({
            type: "turn.start",
            requestId: turn.requestId,
            threadId: turn.threadId,
            sessionId: runtimeSessionId,
            prompt,
            model: turnInput.model || config.defaultModel,
            maxTokens: config.maxTokens,
            cwd: runtimePath(config, workspace),
            ...(turnInput.system ? { system: turnInput.system } : {}),
          });
        } catch (error) {
          const { message, setup } = toRuntimeError(error);
          emit({ ...baseEvent(turn), type: "runtime.error", message, ...(setup ? { setup: true } : {}) });
          settle(turn, false, "start_failed");
          throw error;
        }

        // Watchdog (spec §45, P2-02). The Python side blocks on the
        // subscription with no deadline of its own — api.py's Session.run
        // awaits `subscription.next()` indefinitely — so a runtime that hangs
        // after accepting the prompt would leave the thread busy forever.
        // The bound is enforced here because this is the only side that has
        // one. Started after the send so a slow spawn does not eat the budget.
        turn.timeout = setTimeout(() => {
          if (turn.settled) return;
          emit({
            ...baseEvent(turn),
            type: "runtime.error",
            message: `This turn did not finish within ${humanDuration(config.turnTimeoutMs)} and was stopped. Raise turnTimeoutMs for this bot if long runs are expected.`,
          });
          void cancelTurn(turn, "timeout");
        }, config.turnTimeoutMs);
        turn.timeout.unref?.();

        emit({ ...baseEvent(turn), type: "turn.started" });
        // After turn.started so it renders inside the turn it belongs to,
        // rather than as an orphan notice above it.
        if (mountNote) emit({ ...baseEvent(turn), type: "runtime.error", message: mountNote });
        return { turnId: turn.turnId };
      },

      async interruptTurn(threadId: ThreadId, turnId?: TurnId): Promise<void> {
        const turn = byThread.get(threadId);
        if (!turn || (turnId && turn.turnId !== turnId)) return;
        await cancelTurn(turn, "interrupted");
      },

      async respondToRequest(
        threadId: ThreadId,
        requestId: string,
        decision: { behavior: "allow" | "deny" | "answer"; message?: string },
      ): Promise<void> {
        if (!approvalsEnabled) {
          throw new DeepSeekBridgeError(
            "sandbox_refused",
            "This bot has no approval broker composed, so there is nothing to answer. Point it at the composition MausCrew ships to turn approvals on.",
          );
        }
        // The id has to belong to this thread. A permission granted from the
        // wrong conversation is a permission granted by someone who was not
        // shown what they were granting (spec §87, P3-10).
        if (approvalThread.get(requestId) !== threadId) return;
        approvalThread.delete(requestId);
        // "answer" is a free-text reply to a question, and this broker only
        // ever asks yes-or-no ones. Treating it as consent would be reading
        // approval into an input that never expressed it.
        const behavior = decision.behavior === "allow" ? "allow" : "deny";
        mailbox.respond(requestId, behavior, decision.message);
        const turn = byThread.get(threadId);
        if (turn) {
          emit({ ...baseEvent(turn), requestId, type: "request.resolved", behavior, source: "user" });
        }
      },

      hasSession(threadId: ThreadId): boolean {
        return startedSessions.has(threadId);
      },

      async stopAll(): Promise<void> {
        for (const turn of [...byRequest.values()]) settle(turn, false, "stopped");
        mailbox.denyAll("the bot was stopped");
        mailbox.stop();
        await bridge.stop();
      },

      onEvent(listener: RuntimeEventListener): () => void {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };

    // Model catalog (P2-05). Starts as the static list so the picker is
    // never empty, then narrows to whatever the configured endpoint actually
    // serves. A failed discovery leaves the previous value in place — the
    // same rule acp/core.ts follows — because an endpoint being briefly
    // unreachable must not make the user's model vanish from the UI.
    let models: ModelCatalog = catalogFor(config.defaultModel);
    let discovered = false;

    return {
      instanceId,
      driverKind: DRIVER_KIND,
      displayName: input.displayName,
      enabled: input.enabled,
      get models(): ModelCatalog {
        return models;
      },
      adapter,

      async refreshModels(): Promise<void> {
        // The registry calls this before every snapshot(). Discovery is one
        // network round trip against a third-party endpoint, so it runs once
        // per instance rather than on every poll; a model list is not
        // volatile enough to justify the traffic.
        if (discovered || disposed || !apiKey) return;
        discovered = true;
        const next = await discoverModels({ baseUrl: config.baseUrl, apiKey, defaultModel: config.defaultModel });
        if (next) models = next;
      },

      async snapshot(): Promise<ProviderSnapshot> {
        // §97: a custom endpoint receives this bot's API key, and the user
        // should be able to see that from the provider row rather than only
        // at the moment they typed it. `reason` is the only free-text channel
        // a snapshot has, so an available provider carries the warning there.
        const warning = describeBaseUrl(config.baseUrl).warning;
        const note = warning ? { reason: warning } : {};
        const live = bridge.status();
        if (live.running) {
          return { state: "available", ...note, authenticated: Boolean(apiKey), version: live.sdkVersion };
        }
        // The native transport has no interpreter to probe: it is either
        // configured with a runnable argv or it is not, and saying which is
        // more useful than reporting on a Python it does not use.
        if (native) {
          const launch = checkNativeLaunch(config.transport.launchArgs, config.runtime.mode === "wsl");
          if (!launch.ok) {
            return {
              state: "unavailable",
              reason: bundledRuntimeReason || launch.reason || "the native transport is not configured",
              authenticated: Boolean(apiKey),
              version: null,
            };
          }
          if (!apiKey) {
            return { state: "unavailable", reason: describeError("credentials_missing").message, authenticated: false, version: null };
          }
          return { state: "available", ...note, authenticated: true, version: live.sdkVersion };
        }
        const probe = await probeSdk(config);
        if (!probe.version) {
          const { message } = describeError(probe.reason?.includes("deepseek_harness") ? "sdk_missing" : "python_missing", probe.reason);
          return { state: "unavailable", reason: message, authenticated: Boolean(apiKey), version: null };
        }
        if (!apiKey) {
          return {
            state: "unavailable",
            reason: describeError("credentials_missing").message,
            authenticated: false,
            version: probe.version,
          };
        }
        return { state: "available", ...note, authenticated: true, version: probe.version };
      },

      async dispose(): Promise<void> {
        disposed = true;
        for (const turn of [...byRequest.values()]) settle(turn, false, "disposed");
        mailbox.denyAll("the bot was shut down");
        mailbox.stop();
        listeners.clear();
        await bridge.stop();
      },
    };
  }
}

const MAX_REPLAY_CHARS = 64 * 1024;

/** Pick one runtime-native id for this process incarnation. The suffix is a
 * digest only — no conversation content reaches a filename or a log path. */
function sessionForTurn(
  instanceId: string,
  threadId: ThreadId,
  transcript: SendTurnInput["transcript"],
  live: Map<ThreadId, string>,
): string {
  const existing = live.get(threadId);
  if (existing) return existing;
  const base = sessionIdFor(instanceId, threadId);
  const history = replayHistory(transcript);
  const id = history
    ? `${base}:replay-${createHash("sha256").update(history).digest("hex").slice(0, 12)}`
    : base;
  live.set(threadId, id);
  return id;
}

/** rc6 cannot resume an existing JSON-RPC session across processes. Replay
 * only on the first turn of a fresh process; once the session is live, the
 * runtime remains the source of truth and receives only the new message. */
function replayPrompt(transcript: SendTurnInput["transcript"], current: string): string {
  const history = replayHistory(transcript);
  if (!history) return current;
  return [
    "MausCrew restored the active conversation after the DeepSeek runtime restarted.",
    "Treat the following role-labelled text as prior conversation history.",
    "<conversation-history>",
    history,
    "</conversation-history>",
    "<current-user-message>",
    current,
    "</current-user-message>",
  ].join("\n");
}

function replayHistory(transcript: SendTurnInput["transcript"]): string {
  if (!transcript?.length) return "";
  const rendered = transcript
    .slice(-40)
    .map(({ role, text }) => `<${role}>\n${text.slice(-16_384)}\n</${role}>`)
    .join("\n");
  return rendered.length > MAX_REPLAY_CHARS ? rendered.slice(-MAX_REPLAY_CHARS) : rendered;
}

/** The timeout in words. Configurable down to a second, so "0 minutes" is a
 * reachable and useless thing to tell someone. */
function humanDuration(ms: number): string {
  if (ms < 60_000) {
    const seconds = Math.max(1, Math.round(ms / 1000));
    return `${seconds} second${seconds === 1 ? "" : "s"}`;
  }
  const minutes = Math.round(ms / 60_000);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

/** Registration name, matching the other drivers' PascalCase convention. */
export const DeepSeekHarnessDriver = deepSeekHarnessDriver;

export default deepSeekHarnessDriver;
