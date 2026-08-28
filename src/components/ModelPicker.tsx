// Model picker: an instance rail + model list, backed by /api/instances.
// Routing is by exact instanceId only — an entry is never inferred from a
// driver kind, and unavailable instances render disabled with the reason.
//
// On a phone the same content opens as a bottom sheet: this control used to
// be `display:none` below 1280px, so picking a provider — the thing you do
// most in this app — was simply impossible in the mobile build.
import { useEffect, useRef, useState } from "react";
import { CaretDown, Check, Warning } from "@phosphor-icons/react";
import { useStore, type Bot, type InstanceInfo } from "@/state/store";
import { ProviderMark } from "./ProviderIcons";
import { EngineSetup, needsSignIn } from "./EngineSetup";
import { Sheet } from "./Sheet";
import { useIsMobile } from "@/lib/use-media";
import { cn } from "@/lib/cn";

function modelLabel(instance: InstanceInfo | undefined, model: string): string {
  return instance?.models.options.find((o) => o.id === model)?.label ?? model;
}

export function ModelPicker({ bot, className }: { bot: Bot; className?: string }) {
  const { state, dispatch, refreshInstances } = useStore();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [railId, setRailId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const selection = bot.modelSelection;
  const active = state.instances.find((i) => i.instanceId === selection.instanceId);
  const railInstance =
    state.instances.find((i) => i.instanceId === (railId ?? selection.instanceId)) ??
    state.instances[0];

  // Opening the picker is the user asking "what can I run?" — re-probe rather
  // than answer from a snapshot taken at launch, which is stale the moment
  // they install or sign in to anything.
  useEffect(() => {
    if (open) void refreshInstances();
  }, [open, refreshInstances]);

  // The sheet owns its own dismissal (backdrop + Escape); this is only for
  // the desktop dropdown, which has neither.
  useEffect(() => {
    if (!open || isMobile) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, isMobile]);

  const pick = (instance: InstanceInfo, model: string) => {
    // setModel replaces the whole selection, so a configured effort has to be
    // carried across deliberately. Same engine, different model: keep it —
    // silently resetting the level the user chose is not what "pick a model"
    // means. Different engine: drop it, since effort vocabularies are
    // per-driver and the old level may be one the new engine never declared.
    const sameInstance = instance.instanceId === selection.instanceId;
    dispatch({
      type: "setModel",
      botId: bot.id,
      selection: {
        instanceId: instance.instanceId,
        model,
        ...(sameInstance && selection.effort ? { effort: selection.effort } : {}),
      },
    });
    setOpen(false);
  };

  const rail = (
    <>
      {state.instances.map((instance) => {
        const unavailable =
          instance.snapshot.state !== "available" || instance.snapshot.authenticated === false;
        const onRail = instance.instanceId === railInstance?.instanceId;
        return (
          <button
            key={instance.instanceId}
            onClick={() => setRailId(instance.instanceId)}
            title={
              unavailable
                ? `${instance.displayName} — ${
                    instance.snapshot.reason ??
                    (instance.snapshot.authenticated === false ? "sign-in required" : "unavailable")
                  }`
                : instance.displayName
            }
            className={cn(
              "flex shrink-0 items-center justify-center rounded-lg",
              // 44px on touch, 36px on the desktop rail where it sits in a
              // narrow column beside the list.
              isMobile ? "size-11" : "size-9",
              onRail ? "bg-raised" : "hover:bg-raised/60",
              unavailable && "opacity-40",
            )}
          >
            <ProviderMark
              driverKind={instance.driverKind}
              gateway={instance.gateway}
              displayName={instance.displayName}
              size={isMobile ? 22 : 18}
            />
          </button>
        );
      })}
    </>
  );

  const models = railInstance ? (
    <>
      <div className="px-2 pb-1 pt-1">
        <div className="text-[13px] font-semibold text-ink">{railInstance.displayName}</div>
        {/* A version string is metadata and reads as mono; a reason
            is a sentence written for the user and does not. */}
        {(() => {
          const healthy =
            railInstance.snapshot.state === "available" &&
            railInstance.snapshot.authenticated !== false;
          const version = healthy ? railInstance.snapshot.version : undefined;
          return (
            <div
              className={cn(
                "truncate text-[11px] text-ink-secondary",
                version && "font-mono tracking-tight",
              )}
            >
              {healthy ? (version ?? "ready") : (railInstance.snapshot.reason ?? "sign-in required")}
            </div>
          );
        })()}
        {/* A working engine can still have something the user needs
            to know — a bot pointed at a third-party endpoint is
            "available" and is also sending that host an API key.
            Reporting it only on failure would hide exactly the case
            where nothing looks wrong. */}
        {railInstance.snapshot.state === "available" &&
          railInstance.snapshot.authenticated !== false &&
          railInstance.snapshot.reason && (
            <div className="mt-1 flex gap-1.5 rounded-lg border border-warning/25 bg-warning/10 px-2 py-1.5 text-[10.5px] leading-[1.4] text-warning">
              <Warning size={12} weight="bold" className="mt-px shrink-0" aria-hidden="true" />
              <span>{railInstance.snapshot.reason}</span>
            </div>
          )}
      </div>
      {/* An unavailable engine used to be a dead end here: dimmed
          rows and the reason hidden in a tooltip, at exactly the
          moment the user is trying to fix it. Show the way out. */}
      {(railInstance.snapshot.state !== "available" || needsSignIn(railInstance)) && (
        <div className="border-b border-hairline px-2 pb-2.5">
          <EngineSetup instance={railInstance} />
        </div>
      )}
      {railInstance.models.options.map((option) => {
        const current =
          selection.instanceId === railInstance.instanceId && selection.model === option.id;
        const disabled =
          railInstance.snapshot.state !== "available" ||
          railInstance.snapshot.authenticated === false;
        return (
          <button
            key={option.id}
            disabled={disabled}
            onClick={() => pick(railInstance, option.id)}
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-lg px-2 text-left text-[13px]",
              isMobile ? "min-h-[46px] py-2.5" : "py-1.5",
              disabled ? "cursor-not-allowed text-ink-secondary/50" : "text-ink hover:bg-raised/60",
              current && "bg-raised",
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate font-mono tracking-tight">{option.label}</span>
              {option.id === railInstance.models.default && (
                <span className="shrink-0 rounded bg-inset px-1 py-px font-mono text-[10px] tracking-tight text-ink-secondary">
                  default
                </span>
              )}
            </span>
            {current && <Check size={14} weight="fill" className="shrink-0 text-accent" />}
          </button>
        );
      })}
    </>
  ) : (
    <div className="px-2 py-3 text-[13px] text-ink-secondary">
      No providers — is the server running?
    </div>
  );

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        onClick={() => {
          setRailId(selection.instanceId);
          setOpen((o) => !o);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Provider and model — currently ${modelLabel(active, selection.model)}`}
        className="flex min-h-[36px] items-center gap-1.5 rounded-md border border-accent bg-raised/60 py-1 pl-2 pr-2.5 text-[13px] text-ink hover:bg-raised"
        title={active ? `${active.displayName} · ${modelLabel(active, selection.model)}` : selection.model}
      >
        {active && <ProviderMark driverKind={active.driverKind} gateway={active.gateway} displayName={active.displayName} size={14} />}
        {/* The label is the first thing squeezed out of a 360px header, so it
            gets a tighter cap on phones and keeps the provider mark. */}
        <span className="max-w-[92px] truncate font-mono tracking-tight sm:max-w-[160px]">
          {modelLabel(active, selection.model)}
        </span>
        <CaretDown size={14} weight="bold" className="text-ink-secondary" />
      </button>

      {open &&
        (isMobile ? (
          <Sheet
            title="Provider and model"
            subtitle="Which engine this bot runs on"
            onClose={() => setOpen(false)}
          >
            <div data-model-picker-content>
              <div className="flex gap-1.5 overflow-x-auto border-b border-hairline px-1 pb-2.5">{rail}</div>
              <div className="pt-2">{models}</div>
            </div>
          </Sheet>
        ) : (
          <div
            data-model-picker-content
            className="absolute right-0 top-full z-30 mt-2 flex w-[320px] overflow-hidden rounded-xl border border-hairline bg-card"
          >
            {/* instance rail */}
            <div className="flex flex-col gap-1 border-r border-hairline bg-panel p-2">{rail}</div>
            {/* model list for the rail-selected instance */}
            <div className="min-w-0 flex-1 p-2">{models}</div>
          </div>
        ))}
    </div>
  );
}
