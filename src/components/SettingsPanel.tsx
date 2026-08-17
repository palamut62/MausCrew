import { BookOpen, ChevronLeft, Crown, FolderOpen, Puzzle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { api, useStore, type Bot } from "@/state/store";
import { MausAvatar } from "./Avatar";
import {
  PICKABLE_STATES,
  stateForBot,
  MAUS_COLORS,
  MAUS_COLOR_NAMES,
} from "@/lib/mascot";
import { ModelPicker } from "./ModelPicker";
import { cn } from "@/lib/cn";
import { requestNotificationPermission } from "@/lib/notify";
import { SkillManager } from "./SkillManager";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[13px] text-ink-secondary">{label}</div>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-hairline/40 bg-inset px-3 py-2.5 text-[15px] text-ink placeholder:text-ink-secondary focus:outline-none focus:border-hairline";

export function SettingsPanel({ bot }: { bot: Bot }) {
  const { state, dispatch } = useStore();
  const [workspaceDraft, setWorkspaceDraft] = useState(bot.workspacePath ?? "");
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [voices, setVoices] = useState<Array<{ id: string; label: string; description?: string }>>([]);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const patch = (
    p: Partial<
      Pick<
        Bot,
        | "name"
        | "title"
        | "description"
        | "notifications"
        | "computer"
        | "color"
        | "mascotExpression"
        | "autoApprove"
        | "speakReplies"
        | "voice"
        | "chiefOfStaff"
        | "approvePeerComms"
        | "modelSelection"
        | "workspacePath"
        | "dynamicCordis"
      >
    >,
  ) => dispatch({ type: "updateBot", botId: bot.id, patch: p });
  const activeState = stateForBot(bot);
  const mascotMotion = state.mascotMotion?.botId === bot.id ? state.mascotMotion : null;
  const engine = state.instances.find((instance) => instance.instanceId === bot.modelSelection.instanceId);
  const canCoordinate = engine?.capabilities?.agentsMcp === true;
  const currentChief = state.bots.find((candidate) => candidate.chiefOfStaff);

  useEffect(() => {
    setWorkspaceDraft(bot.workspacePath ?? "");
  }, [bot.id, bot.workspacePath]);

  const saveWorkspace = () => {
    const workspacePath = workspaceDraft.trim();
    setWorkspaceDraft(workspacePath);
    if (workspacePath !== (bot.workspacePath ?? "")) patch({ workspacePath });
  };

  const chooseWorkspace = async () => {
    const workspacePath = await window.mauscrew?.chooseWorkspace?.();
    if (!workspacePath) return;
    setWorkspaceDraft(workspacePath);
    patch({ workspacePath });
  };

  useEffect(() => {
    if (!state.config?.tts?.configured) {
      setVoices([]);
      return;
    }
    let alive = true;
    setVoicesLoading(true);
    api("/api/tts/voices")
      .then((result: { voices?: typeof voices }) => alive && setVoices(result.voices ?? []))
      .catch(() => alive && setVoices([]))
      .finally(() => alive && setVoicesLoading(false));
    return () => {
      alive = false;
    };
  }, [state.config?.tts?.configured]);

  if (skillsOpen) return <SkillManager bot={bot} onClose={() => setSkillsOpen(false)} />;

  return (
    <aside className="animate-panel-in flex h-full w-[400px] shrink-0 flex-col border-l border-hairline/40 bg-panel max-md:absolute max-md:inset-0 max-md:z-50 max-md:w-full max-md:border-l-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={() => dispatch({ type: "toggleSettings", open: false })}
          className="rounded-md p-1 text-ink-secondary hover:bg-raised hover:text-ink"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-[15px] font-semibold text-ink">Settings</span>
        <button
          onClick={() => dispatch({ type: "toggleSettings", open: false })}
          className="rounded-md p-1 text-ink-secondary hover:bg-raised hover:text-ink"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-5">
        <div className="flex justify-center py-5">
          <MausAvatar
            color={bot.color}
            state={activeState}
            size={112}
            motion={mascotMotion?.kind ?? "none"}
            motionKey={mascotMotion?.nonce ?? 0}
          />
        </div>

        <div className="flex flex-col gap-4">
          <div className="overflow-hidden rounded-xl border border-hairline/40 bg-card">
            <div className="flex items-center justify-between border-b border-hairline/40 px-3 py-2.5">
              <span className="rounded-lg bg-raised px-3 py-1.5 text-[14px] font-medium text-ink">
                Bot
              </span>
              <button
                onClick={() => patch({ color: "green", mascotExpression: null })}
                className="rounded-md px-2 py-1.5 text-[13px] text-ink-secondary hover:bg-raised hover:text-ink"
              >
                Reset
              </button>
            </div>

            <div className="p-3">
              <div className="mb-2 text-[12px] font-medium uppercase tracking-[0.08em] text-ink-secondary">
                Expression
              </div>
              <div className="grid grid-cols-5 gap-2">
                {PICKABLE_STATES.map((expression) => (
                  <button
                    key={expression}
                    onClick={() => patch({ mascotExpression: expression })}
                    className={cn(
                      "flex h-[58px] items-center justify-center rounded-xl bg-inset transition-colors hover:bg-raised",
                      activeState === expression && "ring-2 ring-accent-border",
                    )}
                    title={expression}
                    aria-label={`Use ${expression} expression`}
                  >
                    <MausAvatar color={bot.color} state={expression} size={42} animated={false} />
                  </button>
                ))}
              </div>

              <div className="mb-2 mt-4 text-[12px] font-medium uppercase tracking-[0.08em] text-ink-secondary">
                Color
              </div>
              <div className="flex flex-wrap gap-2.5">
                {MAUS_COLOR_NAMES.map((color) => (
                  <button
                    key={color}
                    onClick={() => patch({ color })}
                    className={cn(
                      "size-8 rounded-full border-2 border-transparent transition-transform hover:scale-110",
                      bot.color === color && "ring-2 ring-accent-border ring-offset-2 ring-offset-card",
                    )}
                    style={{ backgroundColor: MAUS_COLORS[color] }}
                    title={color}
                    aria-label={`Use ${color} mascot color`}
                  />
                ))}
              </div>
            </div>
          </div>

          <Field label="Name">
            <input
              className={inputCls}
              value={bot.name}
              onChange={(e) => patch({ name: e.target.value })}
            />
          </Field>
          <Field label="Title">
            <input
              className={inputCls}
              placeholder="Describe what your agent does"
              value={bot.title}
              onChange={(e) => patch({ title: e.target.value })}
            />
          </Field>
          <Field label="Description">
            <textarea
              className={cn(inputCls, "min-h-[96px] resize-none")}
              placeholder="What this agent is for"
              value={bot.description}
              onChange={(e) => patch({ description: e.target.value })}
            />
          </Field>

          <div className="block">
            <div className="mb-1.5 text-[13px] text-ink-secondary">Workspace directory</div>
            <div className="flex gap-2">
              <input
                aria-label="Workspace directory"
                className={inputCls}
                placeholder="Private bot workspace (default)"
                value={workspaceDraft}
                onChange={(event) => setWorkspaceDraft(event.target.value)}
                onBlur={saveWorkspace}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
              />
              <button
                type="button"
                onClick={chooseWorkspace}
                disabled={!window.mauscrew?.chooseWorkspace}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-hairline/40 bg-card px-3 text-[13px] text-ink-secondary hover:bg-raised hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                title={window.mauscrew?.chooseWorkspace ? "Choose a folder" : "Enter an absolute path in the browser"}
              >
                <FolderOpen size={15} />
                Choose
              </button>
            </div>
            <div className="mt-1.5 text-[11.5px] leading-relaxed text-ink-secondary">
              Coding engines work in this absolute host folder. Leave blank to use a private workspace scoped to this bot.
            </div>
          </div>

          <div className={cn(
            "rounded-xl border p-4",
            bot.chiefOfStaff ? "border-accent/40 bg-accent/10" : "border-hairline/40 bg-card",
          )}>
            <div className="flex items-center gap-3">
              <span className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg",
                bot.chiefOfStaff ? "bg-accent text-white" : "bg-raised text-ink-secondary",
              )}>
                <Crown size={17} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-medium text-ink">Chief of Staff</div>
                <div className="text-[11.5px] text-ink-secondary">One per workspace</div>
              </div>
              <button
                role="switch"
                aria-checked={Boolean(bot.chiefOfStaff)}
                aria-label="Chief of Staff"
                disabled={!bot.chiefOfStaff && !canCoordinate}
                onClick={() => patch({ chiefOfStaff: !bot.chiefOfStaff })}
                title={!bot.chiefOfStaff && !canCoordinate ? "This engine cannot contact other bots" : undefined}
                className={cn(
                  "relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                  bot.chiefOfStaff ? "bg-accent" : "bg-raised",
                )}
              >
                <span
                  className={cn(
                    "absolute top-[3px] size-5 rounded-full bg-white transition-all",
                    bot.chiefOfStaff ? "left-[21px]" : "left-[3px]",
                  )}
                />
              </button>
            </div>
            <div className="mt-3 text-[13px] leading-relaxed text-ink-secondary">
              {bot.chiefOfStaff && !canCoordinate
                ? "This bot still holds the role, but its current engine cannot contact teammates. Choose a Claude or ACP engine to restore coordination."
                : bot.chiefOfStaff
                  ? "This is your primary contact. It can coordinate the other bots and combine their work into one answer."
                : !canCoordinate
                  ? "Choose a Claude or ACP engine to let this bot coordinate teammates."
                  : currentChief
                    ? `Make this bot your primary contact and hand the role over from ${currentChief.name}.`
                    : "Make this bot your primary contact for work that may involve several bots."}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl bg-card p-4">
            <div>
              <div className="text-[15px] font-medium text-ink">
                Ask me before contacting other bots
              </div>
              <div className="mt-0.5 text-[13px] text-ink-secondary">
                {bot.approvePeerComms
                  ? "This bot will stop and ask before it reaches out to another bot."
                  : "Let this bot talk to teammates on its own, without a confirmation step."}
              </div>
            </div>
            <button
              role="switch"
              aria-checked={Boolean(bot.approvePeerComms)}
              aria-label="Ask me before contacting other bots"
              disabled={!bot.approvePeerComms && !canCoordinate}
              onClick={() => patch({ approvePeerComms: !bot.approvePeerComms })}
              title={!bot.approvePeerComms && !canCoordinate ? "This engine cannot contact other bots" : undefined}
              className={cn(
                "relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                bot.approvePeerComms ? "bg-accent" : "bg-raised",
              )}
            >
              <span
                className={cn(
                  "absolute top-[3px] size-5 rounded-full bg-white transition-all",
                  bot.approvePeerComms ? "left-[21px]" : "left-[3px]",
                )}
              />
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl bg-card p-4">
            <div>
              <div className="text-[15px] font-medium text-ink">Model</div>
              <div className="mt-0.5 text-[13px] text-ink-secondary">
                Which provider and model this bot runs on
              </div>
            </div>
            <ModelPicker bot={bot} />
          </div>

          {engine?.driverKind === "deepseek-harness" && (
            <>
              <div className="rounded-xl border border-hairline/40 bg-card p-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-raised text-ink-secondary">
                    <BookOpen size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-medium text-ink">Skills</div>
                    <div className="text-[11.5px] text-ink-secondary">Reusable workspace instructions</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSkillsOpen(true)}
                    className="rounded-lg border border-hairline/40 bg-raised px-3 py-1.5 text-[12.5px] font-medium text-ink hover:bg-raised-hover"
                  >
                    Manage
                  </button>
                </div>
                <div className="mt-3 text-[13px] leading-relaxed text-ink-secondary">
                  Create and edit SKILL.md workflows this bot can discover automatically or invoke by name.
                </div>
              </div>

              <div className={cn(
                "rounded-xl border p-4",
                bot.dynamicCordis ? "border-accent/40 bg-accent/10" : "border-hairline/40 bg-card",
              )}>
                <div className="flex items-center gap-3">
                <span className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg",
                  bot.dynamicCordis ? "bg-accent text-white" : "bg-raised text-ink-secondary",
                )}>
                  <Puzzle size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-medium text-ink">Dynamic Cordis plugins</div>
                  <div className="text-[11.5px] text-ink-secondary">Experimental · DeepSeek only</div>
                </div>
                <button
                  role="switch"
                  aria-checked={Boolean(bot.dynamicCordis)}
                  aria-label="Dynamic Cordis plugins"
                  onClick={() => patch({ dynamicCordis: !bot.dynamicCordis })}
                  className={cn(
                    "relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors",
                    bot.dynamicCordis ? "bg-accent" : "bg-raised",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-[3px] size-5 rounded-full bg-white transition-all",
                      bot.dynamicCordis ? "left-[21px]" : "left-[3px]",
                    )}
                  />
                </button>
                </div>
                <div className="mt-3 text-[13px] leading-relaxed text-ink-secondary">
                  Lets this bot inspect and define temporary host-side Cordis plugins. Running plugin code always asks
                  for one-time approval, even in Auto mode. Browser UI plugins are blocked, and every temporary plugin
                  disappears when the DeepSeek runtime restarts.
                </div>
              </div>
            </>
          )}

          {!!engine?.capabilities?.effortLevels?.length && (
            <div className="rounded-xl bg-card p-4">
              <div className="text-[15px] font-medium text-ink">Effort</div>
              {/* Says what the app does, not what the engine ends up at:
                  Codex applies a level to the whole thread and has no way to
                  take one back, so "currently: engine default" was a promise
                  we could not keep for a thread that had already been sent
                  one. Sending nothing is true on every engine. */}
              <div className="mt-0.5 text-[13px] text-ink-secondary">
                How hard this bot thinks{bot.modelSelection.effort ? "" : " (Default: no level is sent)"}
              </div>
              <div className="mt-3 flex overflow-hidden rounded-lg border border-hairline/40">
                {([undefined, ...engine.capabilities.effortLevels] as const).map((level, i) => (
                  <button
                    key={level ?? "default"}
                    aria-pressed={bot.modelSelection.effort === level}
                    onClick={() => patch({ modelSelection: { ...bot.modelSelection, effort: level } })}
                    className={cn(
                      "flex-1 py-1.5 text-[13px] capitalize",
                      i > 0 && "border-l border-hairline/40",
                      bot.modelSelection.effort === level
                        ? "bg-raised text-ink"
                        : "text-ink-secondary hover:bg-raised/60 hover:text-ink",
                    )}
                  >
                    {/* the others capitalize cleanly; "xhigh" would read "Xhigh" */}
                    {level === "xhigh" ? "X-High" : (level ?? "Default")}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl bg-card p-4">
            <div className="text-[15px] font-medium text-ink">Computer</div>
            <div className="mt-0.5 text-[13px] text-ink-secondary">
              Where this bot's computer runs{bot.computer ? "" : " (currently: auto)"}
            </div>
            <div className="mt-3 flex overflow-hidden rounded-lg border border-hairline/40">
              {(["cloud", "local", "off"] as const).map((mode, i) => (
                <button
                  key={mode}
                  onClick={() => patch({ computer: mode })}
                  className={cn(
                    "flex-1 py-1.5 text-[13px] capitalize",
                    i > 0 && "border-l border-hairline/40",
                    bot.computer === mode
                      ? "bg-raised text-ink"
                      : "text-ink-secondary hover:bg-raised/60 hover:text-ink",
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl bg-card p-4">
            <div>
              <div className="text-[15px] font-medium text-ink">Auto mode</div>
              <div className="mt-0.5 text-[13px] text-ink-secondary">
                {bot.autoApprove
                  ? "Keeps going on its own — you'll still be asked about anything destructive, and about questions it asks you."
                  : "Approve each action yourself. Turn on to let this bot keep working without stopping to ask."}
              </div>
            </div>
            <button
              role="switch"
              aria-checked={Boolean(bot.autoApprove)}
              aria-label="Auto mode"
              onClick={() => patch({ autoApprove: !bot.autoApprove })}
              className={cn(
                "relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors",
                bot.autoApprove ? "bg-accent" : "bg-raised",
              )}
            >
              <span
                className={cn(
                  "absolute top-[3px] size-5 rounded-full bg-white transition-all",
                  bot.autoApprove ? "left-[21px]" : "left-[3px]",
                )}
              />
            </button>
          </div>

          {state.config?.tts?.configured && (
            <div className="rounded-xl bg-card p-4">
              <div className="text-[15px] font-medium text-ink">Bot voice</div>
              <div className="mt-0.5 text-[13px] text-ink-secondary">
                Use a distinct voice for calls and spoken replies, or inherit the app default
              </div>
              <select
                value={bot.voice ?? ""}
                onChange={(e) => patch({ voice: e.target.value })}
                aria-label={`${bot.name}'s voice`}
                className="mt-3 w-full rounded-lg border border-hairline/40 bg-inset px-3 py-2 text-[13px] text-ink focus:border-hairline focus:outline-none"
              >
                <option value="">App default</option>
                {bot.voice && !voices.some((voice) => voice.id === bot.voice) && (
                  <option value={bot.voice}>Current bot voice</option>
                )}
                {voices.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.label}{voice.description ? ` — ${voice.description}` : ""}
                  </option>
                ))}
              </select>
              {voicesLoading && <div className="mt-1.5 text-[11.5px] text-ink-secondary">Loading voices…</div>}
            </div>
          )}

          <div className="flex items-center justify-between gap-4 rounded-xl bg-card p-4">
            <div>
              <div className="text-[15px] font-medium text-ink">Read replies aloud</div>
              <div className="mt-0.5 text-[13px] text-ink-secondary">
                Speak this bot's answers as they arrive, even when you're in another chat
              </div>
            </div>
            <button
              role="switch"
              aria-checked={Boolean(bot.speakReplies)}
              aria-label="Read this bot's replies aloud"
              onClick={() => patch({ speakReplies: !bot.speakReplies })}
              className={cn(
                "relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors",
                bot.speakReplies ? "bg-accent" : "bg-raised",
              )}
            >
              <span
                className={cn(
                  "absolute top-[3px] size-5 rounded-full bg-white transition-all",
                  bot.speakReplies ? "left-[21px]" : "left-[3px]",
                )}
              />
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl bg-card p-4">
            <div>
              <div className="text-[15px] font-medium text-ink">
                Notifications
              </div>
              <div className="mt-0.5 text-[13px] text-ink-secondary">
                Get notified when this agent finishes or needs input
              </div>
            </div>
            <button
              role="switch"
              aria-checked={bot.notifications}
              onClick={() => {
                const enabled = !bot.notifications;
                if (enabled) void requestNotificationPermission();
                patch({ notifications: enabled });
              }}
              className={cn(
                "relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors",
                bot.notifications ? "bg-accent" : "bg-raised",
              )}
            >
              <span
                className={cn(
                  "absolute top-[3px] size-5 rounded-full bg-white transition-all",
                  bot.notifications ? "left-[21px]" : "left-[3px]",
                )}
              />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
