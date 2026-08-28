// The "⋯" menu in the chat header, below xl.
//
// Everything in here used to be desktop-only. Tasks, calls and the model
// picker sat behind `max-xl:hidden`, and bot settings were reachable only by
// discovering that the bot's name in the header is a button — so on a phone
// the app was a chat window with no controls at all. The model picker now
// stays in the header; the rest lives here, as 48px rows a thumb can hit.
import { useState } from "react";
import {
  CalendarDots,
  Chats,
  Gear,
  Monitor,
  Phone,
  PhoneSlash,
  Plus,
  PuzzlePiece,
  SlidersHorizontal,
  Trash,
} from "@phosphor-icons/react";
import { formatTime, useStore, type Bot } from "@/state/store";
import { endCall, startCall, useOnCall } from "@/lib/call";
import { useCallAvailability } from "./CallView";
import { Sheet, SheetDivider, SheetItem } from "./Sheet";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/cn";

/** Task switcher as a sheet. The desktop TaskPicker is a 300px dropdown
 * anchored to a header button — inside a sheet it would clip, and its rows
 * are half a thumb tall. */
function TaskSheet({ bot, onClose }: { bot: Bot; onClose: () => void }) {
  const { dispatch } = useStore();
  const tasks = bot.tasks ?? [];
  return (
    <Sheet title="Tasks" subtitle={`Separate contexts on ${bot.name}`} onClose={onClose}>
      {tasks.map((task) => {
        const active = task.threadId === bot.threadId;
        return (
          <div key={task.threadId} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                if (!active) dispatch({ type: "switchTask", botId: bot.id, threadId: task.threadId });
                onClose();
              }}
              className={cn(
                "flex min-h-[48px] min-w-0 flex-1 flex-col justify-center rounded-xl px-3 py-2 text-left",
                active ? "bg-raised" : "hover:bg-raised/60",
              )}
            >
              <span className="truncate text-[15px] text-ink">{task.title}</span>
              <span className="font-mono text-[11px] tracking-tight text-ink-secondary">
                {formatTime(task.createdAt)}
                {active ? " · current" : ""}
              </span>
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "deleteTask", botId: bot.id, threadId: task.threadId })}
              disabled={bot.busy && active}
              aria-label={`Delete task ${task.title}`}
              className="flex size-11 shrink-0 items-center justify-center rounded-lg text-ink-secondary hover:bg-raised hover:text-danger disabled:opacity-30"
            >
              <Trash size={16} weight="bold" />
            </button>
          </div>
        );
      })}
      <SheetDivider />
      <SheetItem
        icon={<Plus size={18} weight="bold" />}
        label="New task"
        hint={bot.busy ? "Let this turn finish first" : "A fresh context on this bot"}
        disabled={bot.busy}
        onClick={() => {
          dispatch({ type: "newTask", botId: bot.id });
          onClose();
        }}
      />
    </Sheet>
  );
}

export function MobileActions({ bot, className }: { bot: Bot; className?: string }) {
  const { state, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const onCall = useOnCall() === bot.id;
  const call = useCallAvailability([bot.voice], onCall);
  const tasks = bot.tasks ?? [];

  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="More actions"
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-md text-ink-secondary hover:bg-raised hover:text-ink",
          className,
        )}
      >
        <SlidersHorizontal size={19} weight="bold" />
      </button>

      {open && (
        <Sheet title={bot.name} subtitle={bot.title || "Bot actions"} onClose={close}>
          <SheetItem
            icon={<Gear size={18} weight="bold" />}
            label="Bot settings"
            hint="Name, model, auto mode, skills, memory"
            onClick={() => {
              close();
              dispatch({ type: "toggleSettings", open: true });
            }}
          />
          <SheetItem
            icon={<Monitor size={18} weight="bold" />}
            label="Bot's computer"
            hint="Watch and take over what it is doing"
            active={state.computerOpen}
            onClick={() => {
              close();
              dispatch({ type: "toggleComputer", open: true });
            }}
          />
          <SheetItem
            icon={<Chats size={18} weight="bold" />}
            label={tasks.length > 1 ? `Tasks · ${tasks.length}` : "New task"}
            hint={
              tasks.length > 1
                ? "Switch between this bot's contexts"
                : bot.busy
                  ? "Let this turn finish first"
                  : "A fresh context on this bot"
            }
            disabled={tasks.length <= 1 && bot.busy}
            onClick={() => {
              if (tasks.length > 1) {
                close();
                setTasksOpen(true);
                return;
              }
              close();
              dispatch({ type: "newTask", botId: bot.id });
            }}
          />
          <SheetItem
            icon={onCall ? <PhoneSlash size={18} weight="fill" /> : <Phone size={18} weight="bold" />}
            label={onCall ? `Hang up on ${bot.name}` : `Call ${bot.name}`}
            // A disabled row with no explanation is the mobile version of the
            // dimmed icon this replaces — say why, and where to fix it.
            hint={onCall ? "End the voice call" : call.unavailable ? call.reason : "Talk to this bot out loud"}
            disabled={call.unavailable}
            danger={onCall}
            onClick={() => {
              close();
              if (onCall) {
                endCall(bot.id);
                return;
              }
              track("call_started", { driver: bot.modelSelection?.instanceId });
              startCall(bot.id);
            }}
          />
          {call.voiceSetupRequired && (
            <SheetItem
              icon={<Gear size={18} weight="bold" />}
              label="Open Voice settings"
              hint="Pick a voice so calls can start"
              onClick={() => {
                close();
                dispatch({ type: "toggleAppSettings", open: true, section: "voice" });
              }}
            />
          )}

          <SheetDivider />

          <SheetItem
            icon={<CalendarDots size={18} weight="bold" />}
            label="Automations"
            hint="Schedules, webhooks and routines"
            onClick={() => {
              close();
              dispatch({ type: "showRoutines" });
            }}
          />
          <SheetItem
            icon={<PuzzlePiece size={18} weight="bold" />}
            label="Plugins"
            hint="Tools and MCP servers your bots can use"
            onClick={() => {
              close();
              dispatch({ type: "togglePlugins", open: true });
            }}
          />
          <SheetItem
            icon={<Gear size={18} weight="bold" />}
            label="App settings"
            hint="Providers, API keys, voice, security"
            onClick={() => {
              close();
              dispatch({ type: "toggleAppSettings", open: true });
            }}
          />
        </Sheet>
      )}

      {tasksOpen && <TaskSheet bot={bot} onClose={() => setTasksOpen(false)} />}
    </>
  );
}
