import { useEffect, useState } from "react";
import { X } from "@phosphor-icons/react";
import { useStore, type Message } from "@/state/store";
import { cn } from "@/lib/cn";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export function OptionCard({
  botId,
  message,
}: {
  botId: string;
  message: Message;
}) {
  const { dispatch } = useStore();
  const [custom, setCustom] = useState("");
  const card = message.card;
  const options = card?.options ?? [];
  const settled = Boolean(!card || card.answered || card.dismissed);

  const answer = (text: string) => {
    if (!text.trim()) return;
    dispatch({ type: "answerCard", botId, messageId: message.id, answer: text.trim() });
    // Nothing keeps the value after it has been sent, here included: the
    // field would otherwise sit on screen holding a credential.
    if (card?.secret) setCustom("");
  };
  // Number keys pick an option without reaching for the mouse. Scoped to the
  // document rather than the card because the caret is usually in the composer
  // when a question arrives, and a shortcut you have to click into first is
  // not a shortcut. Anything typed into a field is left alone.
  useEffect(() => {
    if (settled || options.length === 0) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const typing =
        target?.isContentEditable ||
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA";
      if (typing) return;
      const index = Number(event.key) - 1;
      if (!Number.isInteger(index) || index < 0 || index >= options.length) return;
      event.preventDefault();
      answer(options[index]!);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  if (!card || card.dismissed) return null;

  return (
    <div className="w-full max-w-[840px] rounded-xl border border-hairline bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[16px] font-semibold text-ink">{card.title}</div>
          <div className="mt-0.5 text-[14px] text-ink-secondary">
            {card.subtitle}
          </div>
        </div>
        <button
          onClick={() =>
            dispatch({ type: "dismissCard", botId, messageId: message.id })
          }
          className="rounded-md p-1 text-ink-secondary hover:bg-raised hover:text-ink"
        >
          <X size={16} weight="bold" />
        </button>
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border border-hairline">
        {card.options.map((opt, i) => (
          <button
            key={opt}
            disabled={!!card.answered}
            onClick={() => answer(opt)}
            className={cn(
              "flex w-full items-center gap-3 px-3 py-3 text-left text-[15px] text-ink",
              i > 0 && "border-t border-hairline",
              card.answered === opt
                ? "bg-raised"
                : "hover:bg-raised/60 disabled:hover:bg-transparent",
            )}
          >
            <span className="flex size-6 items-center justify-center rounded-md bg-raised text-[12px] font-medium text-ink-secondary">
              {i < 9 ? i + 1 : LETTERS[i]}
            </span>
            {opt}
          </button>
        ))}
      </div>

      {/* a permission ask has no free-text answer — the broker only accepts
          allow/deny, so typing here used to fail silently */}
      {!card.answered && !card.tool && (
        <>
          <input
            type={card.secret ? "password" : "text"}
            autoComplete={card.secret ? "off" : undefined}
            spellCheck={card.secret ? false : undefined}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && answer(custom)}
            placeholder={card.secret ? "Paste the credential" : "Type your own answer"}
            className="mt-3 w-full rounded-lg border border-hairline bg-inset px-3 py-2.5 text-[15px] text-ink placeholder:text-ink-secondary focus:outline-none focus:border-hairline"
          />
          {card.secret && (
            <p className="mt-1.5 text-[11.5px] leading-[1.5] text-ink-secondary">
              Handed to the bot for this turn only. It is not written into this conversation, so it
              will not be in the transcript afterwards.
            </p>
          )}
        </>
      )}
    </div>
  );
}
