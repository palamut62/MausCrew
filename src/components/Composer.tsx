import { track } from "@/lib/analytics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowBendUpLeft, ArrowUp, Clock, Microphone, Plus, Square, Users, X } from "@phosphor-icons/react";
import { useStore, visibleMessages, type Bot, type Group, type Message } from "@/state/store";
import { cn } from "@/lib/cn";
import { useComposerDraft } from "@/lib/drafts";
import { MausAvatar } from "./Avatar";
import { ComposerAttachments } from "./ComposerAttachments";
import {
  composeMessage,
  isLongPaste,
  pasteAttachment,
  type Attachment,
} from "@/lib/composer-attachments";
import { groupComposerHint } from "@/lib/group-routing";
import {
  PendingApprovalActions,
  PendingApprovalPanel,
  pendingApprovals,
  pendingQuestion,
} from "./PendingApproval";
import { useDesktopCapabilities } from "./DesktopCapabilities";
import { useMediaQuery } from "@/lib/use-media";

/** The active @mention query at the caret: the text between an `@` that
 * starts a word and the caret. null = no mention being typed. */
function mentionQueryAt(text: string, caret: number): { start: number; query: string } | null {
  const upto = text.slice(0, caret);
  const at = upto.lastIndexOf("@");
  if (at === -1) return null;
  if (at > 0 && !/\s/.test(upto[at - 1])) return null; // user@host, not a tag
  const query = upto.slice(at + 1);
  if (query.length > 24 || query.includes("@") || query.includes("\n")) return null;
  return { start: at, query };
}

type MentionChoice = { id: string; name: string; bot?: Bot };

export function Composer({
  bot,
  group,
  members,
  onEditLast,
  replyTo,
  onClearReply,
}: {
  bot?: Bot;
  group?: Group;
  members?: Bot[];
  onEditLast?: () => void;
  /** The message the next send quotes, chosen from the transcript. */
  replyTo?: Message | null;
  onClearReply?: () => void;
}) {
  const { state, dispatch } = useStore();
  const { capabilities } = useDesktopCapabilities();
  // Touch, not width: a soft keyboard is what changes what Enter should do,
  // and a narrow desktop window still has a real one.
  const touchKeyboard = useMediaQuery("(pointer: coarse)");
  // Unified target: a 1:1 bot thread or a room. In a room the @ picker
  // offers members plus @everyone; explicit mentions override the room's
  // configured default responder.
  const busy = group ? Boolean(group.busyBotId) : Boolean(bot?.busy);
  // a pending approval blocks the prompt until it is answered
  const threadId = group?.threadId ?? bot?.threadId ?? "";
  // the VISIBLE branch only — an approval left on a branch you edited away
  // from must not keep blocking the composer
  const threadMessages = group ? group.messages : bot ? visibleMessages(bot) : [];
  const approvals = pendingApprovals(threadMessages);
  const approval = approvals[0];
  // A question the bot is waiting on. Typing an answer here is the obvious
  // thing to do, so it is made to work: the reply goes to the request instead
  // of starting a new message the bot will never read as an answer.
  const pending = bot ? pendingQuestion(threadMessages) : undefined;
  // A credential must arrive through the card's masked field. Routing it
  // through the composer would put it in a plain text box, in the draft that
  // outlives this component, and briefly in the message the user can see.
  const question = pending?.card?.secret ? undefined : pending;
  const secretPending = pending?.card?.secret ? pending : undefined;
  const approvalBot = group
    ? members?.find((b) => b.id === approval?.message.from?.botId) ??
      members?.find((b) => b.id === group.busyBotId)
    : bot;
  const busyName = group
    ? (members?.find((b) => b.id === group.busyBotId)?.name ?? "A bot")
    : (bot?.name ?? "The bot");
  // Per-thread draft: switching bots unmounts this component, so both the
  // text and its attachment chips have to outlive it (see lib/drafts).
  const [text, setText, attachments, setAttachments] = useComposerDraft(
    group ? `group:${group.id}` : `bot:${bot?.id ?? ""}`,
  );
  const addAttachments = useCallback(
    (next: Attachment[]) => setAttachments((prev) => [...prev, ...next]),
    [setAttachments],
  );
  const removeAttachment = useCallback(
    (id: string) => setAttachments((prev) => prev.filter((a) => a.id !== id)),
    [setAttachments],
  );
  const [recording, setRecording] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [caret, setCaret] = useState(0);
  const [highlight, setHighlight] = useState(0);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null); // Esc'd this @
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // what was typed before the mic went on — partials append after it
  const baseText = useRef("");

  // ── @mention picker (tag another bot; the agent reaches it via ask_bot) ──
  const mention = mentionQueryAt(text, caret);
  const candidates = useMemo(() => {
    if (!mention || mention.start === dismissedAt) return [];
    const pool: MentionChoice[] = group
      ? [
          { id: "__everyone__", name: "everyone" },
          ...(members ?? []).map((member) => ({ id: member.id, name: member.name, bot: member })),
        ]
      : state.bots
          .filter((member) => member.id !== bot?.id && !member.hidden)
          .map((member) => ({ id: member.id, name: member.name, bot: member }));
    const q = mention.query.trim().toLowerCase();
    // "@Scout " — the full name plus a space — is a COMPLETED tag, not a
    // search: keep the picker closed so Enter sends instead of re-picking
    if (mention.query.endsWith(" ") && pool.some((b) => b.name.toLowerCase() === q)) return [];
    return pool.filter((b) => !q || b.name.toLowerCase().includes(q)).slice(0, 6);
  }, [mention, dismissedAt, state.bots, bot?.id, group, members]);
  const pickerOpen = candidates.length > 0;

  useEffect(() => queueMicrotask(() => setHighlight(0)), [mention?.start, mention?.query]);

  // grow the textarea with its content (capped by max-h in the className)
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  const pickMention = (peer: MentionChoice) => {
    if (!mention) return;
    const after = text.slice(caret);
    const next = `${text.slice(0, mention.start)}@${peer.name} ${after}`;
    setText(next);
    const newCaret = mention.start + peer.name.length + 2;
    setCaret(newCaret);
    // picking completes this tag — close the popup so the next Enter sends
    setDismissedAt(mention.start);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(newCaret, newCaret);
    });
  };

  // Rooms still serialize member turns here. A direct bot message uses the
  // server-side steer queue so it can interrupt the live turn and survive
  // closing this window while the local harness keeps running.
  const [queued, setQueued] = useState<string | null>(null);
  // a chip on its own is a message: the send control has to appear for it
  const hasContent = Boolean(text.trim()) || attachments.length > 0;
  const send = () => {
    const t = composeMessage(text, attachments);
    if (!t) return;
    if (question && bot) {
      dispatch({ type: "answerCard", botId: bot.id, messageId: question.id, answer: t });
      setText("");
      setAttachments([]);
      return;
    }
    if (busy) {
      if (bot) {
        dispatch({ type: "steer", botId: bot.id, text: t });
        track("message_sent", { redirected: true, driver: bot.modelSelection?.instanceId });
      } else {
        setQueued(t);
      }
      setText("");
      setAttachments([]);
      return;
    }
    if (group) {
      dispatch({ type: "sendGroup", groupId: group.id, text: t });
      track("message_sent", { room: true });
    } else if (bot) {
      // A reply only rides an ordinary send: a steered message joins a turn
      // already in flight, where quoting one earlier line would be noise.
      dispatch({ type: "send", botId: bot.id, text: t, ...(replyTo ? { replyTo: replyTo.id } : {}) });
      track("message_sent", { driver: bot.modelSelection?.instanceId, reply: Boolean(replyTo) });
    }
    onClearReply?.();
    setText("");
    setAttachments([]);
  };
  useEffect(() => {
    if (!busy && queued) {
      queueMicrotask(() => {
        if (group) dispatch({ type: "sendGroup", groupId: group.id, text: queued });
        else if (bot) dispatch({ type: "send", botId: bot.id, text: queued });
        track("message_sent", { queued: true });
        setQueued(null);
      });
    }
  }, [busy, queued, bot, group, dispatch]);

  // native dictation: partials stream into the input while the Swift
  // helper runs; the final transcript stays in the box, ready to edit/send
  useEffect(() => {
    if (!recording) return;
    const bridge = window.mauscrew;
    if (!bridge) {
      queueMicrotask(() => setRecording(false));
      return;
    }
    queueMicrotask(() => setSpeechError(null));
    const offTranscript = bridge.onSpeechTranscript((line) => {
      if (typeof line.text === "string") {
        const base = baseText.current;
        setText(base ? `${base} ${line.text}` : line.text);
      }
    });
    const offEnd = bridge.onSpeechEnd(({ code }) => {
      setRecording(false);
      if (code === 2) {
        setSpeechError("Dictation isn't available on this platform.");
      } else if (code === 1) {
        setSpeechError("Dictation couldn't start — check your system's microphone privacy settings.");
      }
    });
    void bridge.speechStart();
    return () => {
      offTranscript();
      offEnd();
      void bridge.speechStop();
    };
  }, [recording]);

  const toggleMic = () => {
    if (!capabilities.dictation.available || !window.mauscrew) {
      setSpeechError("Dictation isn't available in this build.");
      return;
    }
    baseText.current = text.trim();
    setRecording((r) => !r);
  };

  return (
    // The bottom edge of a phone belongs to the home indicator; --safe-bottom
    // is 0px everywhere else, so this is the desktop `pb-4` until it isn't.
    <div className="px-4 pb-[max(1rem,var(--safe-bottom))] pt-2">
      {speechError && (
        <div className="mx-auto mb-2 max-w-[900px] rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-[12px] text-warning">
          {speechError}
        </div>
      )}
      <div className="relative mx-auto max-w-[760px]">
        {replyTo && (
          <div className="mb-2 flex items-start gap-2 rounded-lg border border-hairline bg-panel px-3 py-2 text-[12.5px] text-ink-secondary">
            <ArrowBendUpLeft size={13} weight="bold" className="mt-0.5 shrink-0 text-accent" />
            <span className="min-w-0 flex-1">
              <span className="text-ink">Replying to {replyTo.role === "user" ? "your message" : "this reply"}</span>
              <span className="ml-1.5 line-clamp-1 opacity-80">{(replyTo.text ?? "").replace(/\s+/g, " ").slice(0, 160)}</span>
            </span>
            <button
              onClick={onClearReply}
              aria-label="Cancel reply"
              className="rounded p-0.5 hover:bg-raised hover:text-ink"
            >
              <X size={13} weight="bold" />
            </button>
          </div>
        )}
        {queued && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-hairline bg-panel px-3 py-2 text-[12.5px] text-ink-secondary">
            <Clock size={13} weight="bold" className="shrink-0" />
            <span className="min-w-0 flex-1 truncate">
              Queued — sends when {busyName} finishes: “{queued}”
            </span>
            <button
              onClick={() => setQueued(null)}
              aria-label="Discard queued message"
              className="rounded p-0.5 hover:bg-raised hover:text-ink"
            >
              <X size={13} weight="bold" />
            </button>
          </div>
        )}
        {pickerOpen && (
          <div
            role="listbox"
            aria-label="Tag a bot"
            className="absolute bottom-full left-2 z-20 mb-2 w-72 overflow-hidden rounded-xl border border-hairline bg-raised"
          >
            {candidates.map((peer, i) => (
              <button
                key={peer.id}
                role="option"
                aria-selected={i === highlight}
                onClick={() => pickMention(peer)}
                onMouseEnter={() => setHighlight(i)}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3 py-2 text-left",
                  i === highlight ? "bg-raised-hover" : "",
                )}
              >
                {peer.bot ? (
                  <MausAvatar
                    color={peer.bot.color}
                    name={peer.name}
                    size={24}
                  />
                ) : (
                  <span className="flex size-6 items-center justify-center rounded-full bg-raised text-ink-secondary">
                    <Users size={14} weight="bold" aria-hidden="true" />
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">{peer.name}</span>
                <span className="shrink-0 font-mono text-xs tracking-tight text-ink-secondary">{peer.bot ? "Agent" : "Room"}</span>
              </button>
            ))}
          </div>
        )}
        {secretPending && (
          <div className="mb-2 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-[12.5px] text-ink">
            <span className="text-ink-secondary">Waiting for a credential — </span>
            {secretPending.card?.title ?? "enter it in the card above"}. Type it into the masked
            field on that card, not here.
          </div>
        )}
        {/* A question does not take the composer over — typing an answer is
            exactly what it wants — but it has to be obvious that the next
            Enter replies to the bot instead of starting a new message. */}
        {question && !approval && (
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-[12.5px] text-ink">
            <span className="min-w-0 flex-1 truncate">
              <span className="text-ink-secondary">Answering — </span>
              {question.card?.title}
            </span>
            <button
              type="button"
              onClick={() =>
                bot && dispatch({ type: "dismissCard", botId: bot.id, messageId: question.id })
              }
              className="shrink-0 rounded-md px-1.5 py-0.5 text-[11.5px] text-ink-secondary hover:bg-raised hover:text-ink"
            >
              Dismiss
            </button>
          </div>
        )}
        {/* An approval takes over the composer: you answer it before you
            can type again, so a waiting bot is impossible to miss. */}
        {approval && (
          <div className="mb-2 overflow-hidden rounded-xl border border-accent/40 bg-card">
            <PendingApprovalPanel pending={approval} count={approvals.length} index={0} />
            <PendingApprovalActions
              pending={approval}
              threadId={threadId}
              bot={approvalBot}
              onCancelTurn={() => {
                if (group) dispatch({ type: "interruptGroup", groupId: group.id });
                else if (bot) dispatch({ type: "interrupt", botId: bot.id });
              }}
            />
          </div>
        )}
        <ComposerAttachments
          items={attachments}
          onAdd={addAttachments}
          onRemove={removeAttachment}
        />
        <div className="flex items-end gap-2 rounded-3xl border border-hairline bg-raised focus-within:border-ink-secondary/60 py-2 pl-3 pr-2 shadow-[0_8px_28px_rgba(0,0,0,0.28)]">
          <label
            htmlFor="mauscrew-attachment-picker"
            aria-label="Attach files"
            title="Attach files"
            className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-inset text-ink-secondary hover:bg-raised-hover hover:text-ink md:size-8"
          >
            <Plus size={20} weight="bold" />
          </label>
          <textarea
          ref={inputRef}
          rows={1}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setCaret(e.target.selectionStart ?? e.target.value.length);
            setDismissedAt(null);
          }}
          onPaste={(e) => {
            // a wall of text becomes a chip instead of burying the input
            const pasted = e.clipboardData.getData("text/plain");
            if (!isLongPaste(pasted)) return;
            e.preventDefault();
            // Preserve native paste replacement semantics: if text was
            // selected, the attachment replaces that selection.
            const start = e.currentTarget.selectionStart;
            const end = e.currentTarget.selectionEnd;
            if (start !== end) {
              setText(`${text.slice(0, start)}${text.slice(end)}`);
              setCaret(start);
            }
            setAttachments((prev) => [...prev, pasteAttachment(pasted)]);
          }}
          onKeyUp={(e) => setCaret((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
          onClick={(e) => setCaret((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
          onKeyDown={(e) => {
            if (pickerOpen) {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                const delta = e.key === "ArrowDown" ? 1 : -1;
                setHighlight((h) => (h + delta + candidates.length) % candidates.length);
                return;
              }
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                pickMention(candidates[highlight]);
                return;
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setDismissedAt(mention?.start ?? null);
                return;
              }
            }
            // an empty composer + ArrowUp = edit your last message (like a chat app)
            if (e.key === "ArrowUp" && !hasContent && onEditLast) {
              e.preventDefault();
              onEditLast();
              return;
            }
            // Shift+Enter inserts a newline; plain Enter sends.
            //
            // Not on a touch keyboard, where the return key is the ONLY way
            // to type a newline and there is no Shift to hold: there, Enter
            // breaks the line and the send button sends, like every other
            // chat app on a phone.
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !touchKeyboard) {
              e.preventDefault();
              send();
            }
            if (e.key === "Escape" && recording) setRecording(false);
          }}
          disabled={Boolean(approval)}
          placeholder={
            approval
              ? "Answer the approval above to continue"
              : question
                ? `Answering: ${question.card?.title ?? "the question above"}`
              : recording
              ? "Listening…"
              : busy
                ? bot
                  ? `${busyName} is working — sending redirects the task`
                  : `${busyName} is working — sending queues your message`
                : group
                  ? `Message ${group.name} — ${groupComposerHint(group, members ?? [])}`
                  : `Message ${bot?.name ?? ""}`
          }
          aria-label={`Message ${group ? group.name : (bot?.name ?? "")}`}
          // 16px below md is not a style choice: iOS Safari zooms the whole
          // page whenever a focused field is smaller, and never zooms back.
          className="max-h-40 w-full resize-none self-center bg-transparent py-1 text-[16px] leading-6 text-ink placeholder:text-ink-secondary focus:outline-none md:text-[15px]"
          enterKeyHint={touchKeyboard ? "enter" : "send"}
        />
        {busy && (
          <button
            onClick={() => {
              if (group) dispatch({ type: "interruptGroup", groupId: group.id });
              else if (bot) dispatch({ type: "interrupt", botId: bot.id });
            }}
            aria-label="Stop this turn"
            className="flex size-10 shrink-0 items-center justify-center rounded-md text-ink-secondary hover:bg-raised hover:text-ink md:size-8"
            title="Stop"
          >
            <Square size={14} weight="fill" />
          </button>
        )}
        {!busy && !hasContent && capabilities.dictation.available && (
          <button
            onClick={toggleMic}
            aria-label={recording ? "Stop dictation" : "Start dictation"}
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-md md:size-8",
              recording
                ? "animate-pulse bg-danger/20 text-danger"
                : "bg-white text-black hover:bg-white/90",
            )}
            title={recording ? "Stop dictation (Esc)" : "Dictate"}
          >
            <Microphone size={18} weight={recording ? "fill" : "bold"} />
          </button>
        )}
        {hasContent && (
          <button
            onClick={send}
            aria-label={busy ? (bot ? "Redirect task" : "Queue message") : "Send message"}
            title={busy ? (bot ? "Redirect — stops the current turn and applies this instruction" : "Queue — sends when the bot finishes") : "Send"}
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-md md:size-8",
              busy ? "bg-inset text-ink-secondary hover:bg-raised-hover" : "bg-white text-black hover:bg-white/90",
            )}
          >
            {busy ? <Clock size={15} weight="bold" /> : <ArrowUp size={17} weight="fill" />}
          </button>
        )}
        </div>
      </div>
    </div>
  );
}
