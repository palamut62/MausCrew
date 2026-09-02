// One-place setup and lifecycle for the shared, isolated Local VM.
import { useCallback, useEffect, useState } from "react";
import { Spin } from "./Spin";
import { ArrowClockwise, ArrowCounterClockwise, ArrowSquareOut, Check, Circle, Square, Trash, Warning } from "@phosphor-icons/react";
import { Card, CommandLine } from "./SettingsPrimitives";
import { cn } from "@/lib/cn";

type Action = "pull" | "run" | "start" | "stop" | "remove" | "recreate";

interface Status {
  platform: string;
  runtime: string | null;
  available: string[];
  daemonUp: boolean;
  image: boolean;
  imageMatches: boolean;
  managed: boolean;
  container: "running" | "stopped" | "missing";
  network: "loopback" | "unsafe" | "unknown";
  security: "hardened" | "unsafe" | "unknown";
  persistence: "durable" | "unsafe" | "unknown";
  desktopReady: boolean;
  ready: boolean;
  problem: string | null;
  image_ref: string;
  base_image_ref: string;
  driver_version: string;
  container_name: string;
  workspace_path: string;
  workspace_guest_path: string;
  viewer_url: string;
  idle_timeout_ms: number;
  commands: {
    install: string | null;
    runtimeStart: string | null;
    pull: string | null;
    run: string | null;
    start: string | null;
    stop: string | null;
    remove: string | null;
    view: string;
  };
}

function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children?: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md text-[11px]",
          done ? "bg-success/20 text-success" : "border border-hairline text-ink-secondary",
        )}
      >
        {done ? <Check size={12} weight="fill" /> : n}
      </div>
      <div className="min-w-0 flex-1">
        <div className={cn("text-[14px]", done ? "text-ink-secondary line-through" : "text-ink")}>{title}</div>
        {!done && children && <div className="mt-2 flex flex-col items-start gap-2">{children}</div>}
      </div>
    </div>
  );
}

function ActionButton({
  action,
  pending,
  children,
  onClick,
  danger = false,
}: {
  action: Action;
  pending: Action | null;
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={pending !== null}
      className={cn(
        "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium disabled:opacity-50",
        danger ? "bg-danger/15 text-danger hover:bg-danger/20" : "bg-accent text-app hover:brightness-110",
      )}
    >
      {pending === action && <Spin size={13} weight="fill" />}
      {children}
    </button>
  );
}

interface HostStatus {
  supported: boolean;
  session: "x11" | "wayland" | "headless";
  installed: boolean;
  running: boolean;
  version: string;
  arch: string;
  problem?: string;
}

/**
 * "This computer" as a destination, on the platform where it needs setting up.
 *
 * macOS starts its driver with the app and Windows ships one inside the
 * package; only Linux has a driver to fetch, so the card renders there and
 * nowhere else rather than showing three platforms a control two of them
 * cannot use.
 */
function HostComputerCard() {
  const [status, setStatus] = useState<HostStatus | null>(null);
  const [pending, setPending] = useState<"install" | "start" | "stop" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/host-computer");
      if (!response.ok) return;
      setStatus((await response.json()) as HostStatus);
    } catch {
      /* the harness is restarting; the next poll picks it up */
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const act = async (action: "install" | "start" | "stop") => {
    setPending(action);
    setError(null);
    try {
      const response = await fetch(`/api/host-computer/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? `${action} failed`);
      setStatus(body as HostStatus);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setPending(null);
    }
  };

  // Only Linux has anything to do here.
  if (!status || (status.session === "headless" && !status.installed && !status.supported)) return null;

  return (
    <Card
      title="This computer"
      subtitle="Let a bot drive the desktop you are looking at, using the same pinned Cua driver the Local VM runs. It sees and clicks your real screen — the sandbox boundary is gone, so approvals are the only thing between a bot and your files."
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[12.5px] tracking-tight",
            status.running ? "bg-success/15 text-success" : "bg-raised text-ink-secondary",
          )}
        >
          {status.running ? <Check size={12} weight="fill" /> : <Circle size={9} weight="fill" />}
          {status.running ? "Serving this session" : status.installed ? "Installed, not running" : "Not installed"}
        </span>
        {status.supported && !status.installed && (
          <ActionButton action="pull" pending={pending === "install" ? "pull" : null} onClick={() => void act("install")}>
            Install driver ({status.version})
          </ActionButton>
        )}
        {status.supported && status.installed && !status.running && (
          <ActionButton action="start" pending={pending === "start" ? "start" : null} onClick={() => void act("start")}>
            Start
          </ActionButton>
        )}
        {status.running && (
          <ActionButton action="stop" pending={pending === "stop" ? "stop" : null} danger onClick={() => void act("stop")}>
            Stop
          </ActionButton>
        )}
      </div>
      {!status.supported && (
        <div className="mt-3 rounded-lg bg-raised px-3 py-2 text-[12px] leading-relaxed text-ink-secondary">
          {status.session === "wayland"
            ? "This is a Wayland session. Desktop control needs X11 — log in with an Xorg session, or give the bot a cloud computer or the Local VM instead."
            : status.session === "headless"
              ? "No graphical session was found on this machine, so there is nothing to drive."
              : `There is no pinned driver build for ${status.arch}.`}
        </div>
      )}
      {(error ?? status.problem) && (
        <div className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-[12px] text-danger">{error ?? status.problem}</div>
      )}
    </Card>
  );
}

export function LocalComputerSection() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch("/api/local-computer", { signal });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error ?? `Status request failed (${response.status})`);
    setStatus(body as Status);
    setError(null);
  }, []);

  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    let controller: AbortController | undefined;
    const poll = async () => {
      controller = new AbortController();
      try {
        await refresh(controller.signal);
      } catch (e) {
        if (active && !(e instanceof DOMException && e.name === "AbortError")) {
          setStatus(null);
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (active) {
          setLoading(false);
          timer = window.setTimeout(() => void poll(), 5000);
        }
      }
    };
    void poll();
    return () => {
      active = false;
      controller?.abort();
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [refresh, refreshKey]);

  const post = async (action: Exclude<Action, "recreate">) => {
    const response = await fetch(`/api/local-computer/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error ?? `${action} failed`);
    setStatus(body as Status);
  };

  const act = async (action: Action) => {
    if (
      action === "remove" &&
      !window.confirm("Delete the Local VM? Files and browser sign-ins in its durable workspace will remain.")
    ) return;
    if (
      action === "recreate" &&
      !window.confirm("Replace the existing Local VM with the pinned image and safety limits? Files and browser sign-ins in its durable workspace will remain.")
    ) return;
    setPending(action);
    setError(null);
    try {
      if (action === "recreate") {
        await post("remove");
        await post("run");
      } else {
        await post(action);
      }
      // The desktop starts after the container process; keep the progress
      // state honest and let the regular poll mark it Ready a few seconds on.
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(null);
    }
  };

  const c = status?.commands;
  const ready = status?.ready === true;
  const existing = status?.container !== "missing";
  const needsRecreate = Boolean(
    existing &&
      (!status?.imageMatches ||
        !status?.managed ||
        status?.network === "unsafe" ||
        status?.security === "unsafe" ||
        status?.persistence === "unsafe"),
  );
  const unavailable = !loading && !status;
  const host = status?.platform === "darwin" ? "Mac" : "computer";

  return (
    <>
      <HostComputerCard />
      <Card
        title="Local VM"
        subtitle={`A shared Cua Linux sandbox on this ${host} for bots to browse and work in — isolated, backed by one durable workspace, and automatically recycled after 8 hours without activity.`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[12.5px] tracking-tight",
              ready ? "bg-success/15 text-success" : "bg-raised text-ink-secondary",
            )}
          >
            {loading ? <Spin size={12} weight="fill" /> : ready ? <Check size={12} weight="fill" /> : <Circle size={9} weight="fill" />}
            {loading ? "Checking…" : unavailable ? "Status unavailable" : ready ? "Ready" : (status?.problem ?? "Not ready")}
          </span>
          <button
            onClick={() => {
              setLoading(true);
              setRefreshKey((key) => key + 1);
            }}
            disabled={loading || pending !== null}
            className="flex items-center gap-1.5 rounded-lg border border-hairline px-2.5 py-1 text-[12.5px] text-ink-secondary hover:bg-raised hover:text-ink disabled:opacity-40"
          >
            <ArrowClockwise size={12} weight="bold" /> Re-check
          </button>
          {ready && (
            <a
              href={status?.viewer_url ?? c?.view}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-hairline px-2.5 py-1 text-[12.5px] text-ink hover:bg-raised"
            >
              <ArrowSquareOut size={12} weight="bold" /> Watch screen
            </a>
          )}
        </div>
        {error && <div className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-[12px] text-danger">{error}</div>}
      </Card>

      <Card title="Setup" subtitle="Once a container runtime is open, MausCrew prepares Cua and the VM for you.">
        <div className="flex flex-col gap-4">
          <Step n={1} title="Install a container runtime" done={Boolean(status?.runtime)}>
            <div className="text-[13px] leading-relaxed text-ink-secondary">
              Podman and Colima are free. Docker Desktop may require a paid licence for larger companies and government use.
            </div>
            {c?.install ? (
              <CommandLine command={c.install} />
            ) : (
              <a href="https://podman.io/docs/installation" target="_blank" rel="noreferrer" className="text-[13px] text-accent hover:underline">
                Open the Podman installation guide
              </a>
            )}
          </Step>

          <Step
            n={2}
            title={status?.runtime && !status.daemonUp ? `Open and start ${status.runtime}` : "Start the container runtime"}
            done={Boolean(status?.daemonUp)}
          >
            {!status?.runtime ? null : c?.runtimeStart ? (
              <CommandLine command={c.runtimeStart} />
            ) : (
              <div className="text-[13px] text-ink-secondary">Open the installed runtime and start its engine, then re-check.</div>
            )}
          </Step>

          <Step n={3} title="Prepare the Cua desktop (one-time download and build)" done={Boolean(status?.image)}>
            {status?.daemonUp && (
              <ActionButton action="pull" pending={pending} onClick={() => void act("pull")}>Prepare Cua desktop</ActionButton>
            )}
            {c?.pull && <details className="text-[12px] text-ink-secondary"><summary className="cursor-pointer">Show base-image download</summary><div className="mt-2"><CommandLine command={c.pull} /></div></details>}
          </Step>

          <Step n={4} title={needsRecreate ? "Replace the older or unsafe VM" : "Create and start the Local VM"} done={ready}>
            {needsRecreate ? (
              <>
                <div className="flex gap-2 text-[13px] text-warning">
                  <Warning size={15} weight="bold" className="mt-0.5 shrink-0" />
                  <span>{status?.problem}</span>
                </div>
                {status?.image ? (
                  <ActionButton action="recreate" pending={pending} onClick={() => void act("recreate")} danger>
                    <ArrowCounterClockwise size={13} weight="bold" /> Delete and recreate
                  </ActionButton>
                ) : (
                  <div className="text-[13px] text-ink-secondary">Prepare the pinned Cua desktop above before replacing this VM.</div>
                )}
              </>
            ) : status?.container === "stopped" ? (
              <ActionButton action="start" pending={pending} onClick={() => void act("start")}>Start Local VM</ActionButton>
            ) : status?.container === "running" ? (
              <div className="flex items-center gap-2 text-[13px] text-ink-secondary"><Spin size={13} weight="fill" /> Waiting for the desktop…</div>
            ) : status?.image ? (
              <ActionButton action="run" pending={pending} onClick={() => void act("run")}>Create Local VM</ActionButton>
            ) : null}
            {c?.run && <details className="text-[12px] text-ink-secondary"><summary className="cursor-pointer">Show command</summary><div className="mt-2"><CommandLine command={c.run} /></div></details>}
          </Step>
        </div>
      </Card>

      {unavailable && (
        <Card>
          <div className="flex gap-2 text-[13px] text-ink-secondary">
            <Warning size={15} weight="bold" className="mt-0.5 shrink-0 text-warning" />
            <span>MausCrew could not inspect the container runtime. Re-check, or review the app logs.</span>
          </div>
        </Card>
      )}

      <Card
        title="Safety and storage"
        subtitle={`Cua Driver operates only the VM's desktop. Exactly one private host folder is mounted at ${status?.workspace_guest_path ?? "/home/cua/workspace"}; files and browser profiles there survive VM replacement, while everything elsewhere in the VM remains disposable. The password-protected viewer is available only on this machine. Docker and Podman runs are limited to 4 GB memory, 2 CPUs and 512 processes; all Linux capabilities are dropped except the two the desktop supervisor needs to switch to its unprivileged user. The VM can still reach the internet, and bots share it one at a time.`}
      >
        {existing && (
          <div className="flex flex-wrap gap-2">
            {status?.container === "running" && (
              <ActionButton action="stop" pending={pending} onClick={() => void act("stop")}>
                <Square size={12} weight="fill" /> Stop
              </ActionButton>
            )}
            <ActionButton action="remove" pending={pending} onClick={() => void act("remove")} danger>
              <Trash size={12} weight="bold" /> Delete VM
            </ActionButton>
          </div>
        )}
        <div className="mt-3 break-all text-[11px] text-ink-secondary">
          Durable workspace: {status?.workspace_path ?? "not created"} ·{" "}
          Cua Driver: {status?.driver_version ?? "0.20.0"} · Local image: {status?.image_ref ?? "not prepared"}
          {status?.base_image_ref ? <> · Base: {status.base_image_ref}</> : null}
        </div>
      </Card>
    </>
  );
}
