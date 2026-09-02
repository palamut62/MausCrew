// A room: several bots + you in one shared thread. The sidebar and call view
// carry the personality; avatars inside the room stay still so a busy group
// does not become a wall of competing motion. Plain messages go to the room's
// default responder; @mentions override that routing.
import { memo, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, CaretDown, PushPin } from "@phosphor-icons/react";
import {
  useStore,
  useStreaming,
  formatTime,
  type Bot,
  type Group,
  type GroupDefaultResponder,
} from "@/state/store";
import { MausAvatar } from "./Avatar";
import { effectiveDefaultResponder, groupResponseHint } from "@/lib/group-routing";
import { ChatMarkdown } from "./ChatMarkdown";
import { Composer } from "./Composer";
import { GroupCallButton, GroupCallOverlay } from "./GroupCallView";
import { ReactionBar, ReactionChips } from "./Reactions";
import { ApprovalCard } from "./ApprovalCard";
import { cn } from "@/lib/cn";

function dayLabel(at: number): string {
  const d = new Date(at);
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

/** 16px maus + mono role stamp ("ADA · 10:34"), once per sender cluster —
 * the group counterpart of ChatView's RoleStamp. */
function ClusterLabel({ bot, name, color, at }: { bot?: Bot; name: string; color: string; at?: number }) {
  return (
    <div className="mt-1 mb-1 flex items-center gap-1.5 pl-0.5">
      <MausAvatar
        color={(bot?.color ?? color) as Bot["color"]}
        name={name}
        size={16}
      />
      <span className="font-mono text-[10.5px] tracking-tight text-ink-secondary uppercase">
        {name}
        {at !== undefined && ` · ${formatTime(at)}`}
      </span>
    </div>
  );
}

const Transcript = memo(function Transcript({
  group,
  members,
}: {
  group: Group;
  members: Bot[];
}) {
  const memberOf = (id?: string) => members.find((b) => b.id === id);
  const textMessages = group.messages;
  return (
    <>
      {textMessages.map((m, i) => {
        const prev = textMessages[i - 1];
        const newDay = !prev || new Date(prev.at).toDateString() !== new Date(m.at).toDateString();
        const user = m.role === "user";
        const newCluster = !prev || prev.role !== m.role || prev.from?.botId !== m.from?.botId || newDay;
        const row =
          // a member can hit a permission ask mid-turn; without this the
          // card never rendered here and the bot waited out its timeout.
          // `tool` distinguishes a permission from a QUESTION — a question
          // only accepts an "answer", so routing it here would offer an
          // Allow the broker rejects
          m.kind === "options" && m.card?.requestId && m.card.tool ? (
            <div className="flex justify-start">
              <ApprovalCard bot={memberOf(m.from?.botId)} message={m} />
            </div>
          ) : m.kind === "activity" && m.tool ? (
            <div className="flex justify-start">
              <div
                className={cn(
                  "flex min-w-0 items-center gap-2 rounded-md border border-hairline bg-panel px-3 py-1.5 text-[13px]",
                  m.tool.ok === false ? "text-danger" : "text-ink-secondary",
                )}
              >
                <span className="min-w-0 max-w-[480px] truncate font-mono">{m.tool.name}</span>
              </div>
            </div>
          ) : m.kind === "text" && m.text ? (
            <div className={cn("group flex w-full flex-col", user ? "items-end" : "items-start")}>
              <div className={cn("flex w-full items-end gap-1.5", user ? "justify-end" : "justify-start")}>
                {user && <ReactionBar threadId={group.threadId} message={m} />}
                <div
                  className={cn(
                    "text-[14px] leading-snug",
                    user
                      ? "max-w-[72%] rounded-2xl bg-bubble-user px-4 py-2.5 whitespace-pre-wrap text-ink"
                      : "max-w-[78%] rounded-2xl bg-raised px-4 py-3 text-ink",
                  )}
                  title={new Date(m.at).toLocaleString()}
                >
                  {user ? m.text : <ChatMarkdown text={m.text} />}
                </div>
                {!user && <ReactionBar threadId={group.threadId} message={m} />}
                {/* bot rows carry their time in the cluster stamp already */}
                {user && (
                  <span className="self-end pb-1 font-mono text-[11px] tabular-nums tracking-tight text-ink-secondary/70 opacity-0 pointer-coarse:opacity-100 transition-opacity group-hover:opacity-100">
                    {formatTime(m.at)}
                  </span>
                )}
              </div>
              <ReactionChips threadId={group.threadId} message={m} members={members} align={user ? "right" : "left"} />
            </div>
          ) : null;
        if (!row) return null;
        return (
          <div key={m.id} className="contents">
            {newDay && (
              <div className="py-3 text-center font-mono text-[13px] tracking-tight text-ink-secondary">
                {dayLabel(m.at)} {formatTime(m.at)}
              </div>
            )}
            {!user && m.from && newCluster && (
              <ClusterLabel bot={memberOf(m.from.botId)} name={m.from.name} color={m.from.color} at={m.at} />
            )}
            {row}
          </div>
        );
      })}
    </>
  );
});

function StreamingBubble({ text }: { text: string }) {
  const deferred = useDeferredValue(text);
  return (
    <div className="flex w-full justify-start">
      <div className="max-w-[78%] rounded-2xl bg-raised px-4 py-3 text-[14px] leading-snug text-ink">
        <ChatMarkdown text={deferred} streaming />
        <span className="animate-caret ml-0.5 inline-block h-[14px] w-[2px] bg-ink align-middle" />
      </div>
    </div>
  );
}

function DefaultResponderSelect({ group, members }: { group: Group; members: Bot[] }) {
  const { dispatch } = useStore();
  const responder = effectiveDefaultResponder(group, members);
  const value = responder.kind === "member" ? `member:${responder.botId}` : responder.kind;
  const lead = responder.kind === "member" ? members.find((member) => member.id === responder.botId) : undefined;
  const title =
    responder.kind === "everyone"
      ? "Plain messages go to every room member; @mentions override this"
      : responder.kind === "mentions"
        ? "Only explicitly @mentioned bots respond"
        : `Plain messages go to ${lead?.name ?? "the lead bot"}; @mentions override this`;

  const change = (nextValue: string) => {
    let next: GroupDefaultResponder;
    if (nextValue === "everyone") next = { kind: "everyone" };
    else if (nextValue === "mentions") next = { kind: "mentions" };
    else next = { kind: "member", botId: nextValue.slice("member:".length) };
    dispatch({ type: "patchGroup", groupId: group.id, patch: { defaultResponder: next } });
  };

  return (
    <div className="relative shrink-0" title={title}>
      <select
        aria-label="Default responder"
        value={value}
        onChange={(event) => change(event.target.value)}
        className="h-8 max-w-[190px] appearance-none truncate rounded-md border border-hairline bg-raised/60 py-1 pl-3 pr-7 text-[12.5px] font-medium text-ink outline-none hover:bg-raised focus:border-accent"
      >
        <optgroup label="Room lead">
          {members.map((member) => (
            <option key={member.id} value={`member:${member.id}`}>
              Lead: {member.name}
            </option>
          ))}
        </optgroup>
        <optgroup label="Room behavior">
          <option value="everyone">Everyone responds</option>
          <option value="mentions">Mentions only</option>
        </optgroup>
      </select>
      <CaretDown
        size={13} weight="bold"
        aria-hidden="true"
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-secondary"
      />
    </div>
  );
}

export function GroupView({ group }: { group: Group }) {
  const { state, dispatch } = useStore();
  const stream = useStreaming();
  const streaming = stream.streaming[group.threadId];
  const scrollRef = useRef<HTMLDivElement>(null);
  const [follow, setFollow] = useState(true);
  const touchY = useRef(0);
  const [bulletinOpen, setBulletinOpen] = useState(false);
  const [bulletinDraft, setBulletinDraft] = useState(group.bulletin);

  const members = useMemo(
    () => group.memberIds.map((id) => state.bots.find((b) => b.id === id)).filter((b): b is Bot => Boolean(b)),
    [group.memberIds, state.bots],
  );
  const speaker = members.find((b) => b.id === group.busyBotId);
  // Mirrors the max-sm:hidden rule on the header roster below: the working
  // bot is never one of the faces that gets folded into the "+N".
  const hiddenBelowSm = members.filter((b, index) => index >= 2 && group.busyBotId !== b.id).length;

  useEffect(() => setFollow(true), [group.id]);
  useEffect(() => setBulletinDraft(group.bulletin), [group.id, group.bulletin]);
  useEffect(() => {
    if (follow) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [group.id, group.messages.length, streaming, group.busyBotId, follow]);

  const atEnd = () => {
    const el = scrollRef.current;
    return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  };

  const saveBulletin = () => {
    setBulletinOpen(false);
    if (bulletinDraft !== group.bulletin) {
      dispatch({ type: "patchGroup", groupId: group.id, patch: { bulletin: bulletinDraft } });
    }
  };

  const isWin = window.mauscrew?.platform === "win32";
  const drag = isWin ? ({ WebkitAppRegion: "drag" } as React.CSSProperties) : undefined;
  const noDrag = isWin ? ({ WebkitAppRegion: "no-drag" } as React.CSSProperties) : undefined;

  return (
    <main className="relative flex h-full min-w-0 flex-1 flex-col bg-app">
      <GroupCallOverlay group={group} members={members} />
      {/* Header: static member mauses; a ring + dot marks the working bot. */}
      <div
        className={cn(
          "flex min-h-[52px] items-center justify-between border-b border-hairline/70 px-4 py-2",
          // Room for the drawer button, which overlays this corner below md.
          "pl-11 md:pl-4",
          isWin && "pr-[148px]",
        )}
        style={drag}
      >
        <span className="min-w-0 truncate text-[15px] font-semibold text-ink">{group.name}</span>
        <div className="flex shrink-0 items-center gap-1.5" style={noDrag}>
          <GroupCallButton group={group} members={members} />
          {!group.dm && <DefaultResponderSelect group={group} members={members} />}
          {/* Every member's face plus a lead picker plus a call button does
              not fit a 375px header. Below sm the roster collapses to the
              working bot and a count — the full list is in the room's own
              members panel either way. */}
          {members.map((b, index) => (
            <span
              key={b.id}
              title={`${b.name}${group.busyBotId === b.id ? " — working…" : ""}`}
              className={cn(
                "relative inline-flex rounded-full",
                index >= 2 && group.busyBotId !== b.id && "max-sm:hidden",
                group.busyBotId === b.id && "ring-2 ring-accent/50 ring-offset-1 ring-offset-app",
              )}
            >
              <MausAvatar color={b.color} name={b.name} seed={b.id} shape={b.shape} image={b.avatarImage} size={24} />
              {group.busyBotId === b.id && (
                <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full border border-app bg-accent" />
              )}
            </span>
          ))}
          {hiddenBelowSm > 0 && (
            <span
              className="font-mono text-[11px] tracking-tight text-ink-secondary sm:hidden"
              title={members.map((b) => b.name).join(", ")}
            >
              +{hiddenBelowSm}
            </span>
          )}
        </div>
      </div>

      {/* Bulletin: one pinned line; click to edit */}
      <div className="mx-auto w-full max-w-[760px] px-4">
        {bulletinOpen ? (
          <div className="mb-1 rounded-lg border border-hairline bg-panel p-2">
            <textarea
              autoFocus
              value={bulletinDraft}
              onChange={(e) => setBulletinDraft(e.target.value)}
              onBlur={saveBulletin}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveBulletin();
                if (e.key === "Escape") {
                  setBulletinDraft(group.bulletin);
                  setBulletinOpen(false);
                }
              }}
              placeholder="Room instructions — every bot in this room follows them (who does what, tone, goals, a task checklist…)"
              rows={4}
              className="w-full resize-none bg-transparent text-[13px] leading-relaxed text-ink placeholder:text-ink-secondary focus:outline-none"
            />
          </div>
        ) : (
          <button
            onClick={() => setBulletinOpen(true)}
            className="mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-raised/40"
            title="Room bulletin — shared instructions for every bot here"
          >
            <PushPin size={12} weight="bold" className="shrink-0 text-ink-secondary" />
            <span className={cn("truncate text-[12.5px]", group.bulletin ? "text-ink-secondary" : "text-ink-secondary/60")}>
              {group.bulletin.split("\n")[0] || "Add room instructions…"}
            </span>
          </button>
        )}
      </div>

      {/* Transcript */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 [overflow-anchor:none]"
        onWheel={(e) => {
          if (e.deltaY < 0) setFollow(false);
          else if (atEnd()) setFollow(true);
        }}
        onTouchStart={(e) => (touchY.current = e.touches[0]?.clientY ?? 0)}
        onTouchMove={(e) => {
          const y = e.touches[0]?.clientY ?? 0;
          if (y > touchY.current + 4) setFollow(false);
          else if (atEnd()) setFollow(true);
        }}
        onScroll={() => {
          if (!follow && atEnd()) setFollow(true);
        }}
      >
        <div
          className="mx-auto flex max-w-[760px] flex-col gap-1.5 pb-4 pt-5"
          role="log"
          aria-live="polite"
          aria-label={`Room ${group.name}`}
        >
          {group.messages.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center">
              <div className="flex -space-x-2">
                {members.slice(0, 3).map((b) => (
                  <MausAvatar key={b.id} color={b.color} name={b.name} size={44} />
                ))}
              </div>
              <div className="text-[17px] font-semibold text-ink">{group.name}</div>
              <div className="max-w-[380px] text-[14px] text-ink-secondary">
                {groupResponseHint(group, members)}
              </div>
            </div>
          )}
          <Transcript group={group} members={members} />
          {speaker && !streaming && (
            <>
              <ClusterLabel bot={speaker} name={speaker.name} color={speaker.color} />
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-xl bg-raised px-4 py-3">
                  <span className="size-1.5 animate-bounce rounded-full bg-ink-secondary [animation-delay:0ms]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-ink-secondary [animation-delay:150ms]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-ink-secondary [animation-delay:300ms]" />
                </div>
              </div>
            </>
          )}
          {speaker && streaming && (
            <>
              <ClusterLabel bot={speaker} name={speaker.name} color={speaker.color} />
              <StreamingBubble text={streaming} />
            </>
          )}
        </div>
      </div>

      {!follow && (
        <button
          onClick={() => {
            setFollow(true);
            scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
          }}
          aria-label="Jump to latest messages"
          className="animate-pop-in absolute bottom-24 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-md border border-hairline bg-raised px-3 py-1.5 text-[12.5px] text-ink hover:bg-raised-hover"
        >
          <ArrowDown size={13} weight="bold" /> Jump to latest
        </button>
      )}

      <Composer key={group.id} group={group} members={members} />
    </main>
  );
}
