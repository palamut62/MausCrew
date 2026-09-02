// What the tray says while the window is hidden.
//
// A hidden window is exactly when an approval is easiest to miss: the banner
// is gone in five seconds and the sidebar badge is behind a window nobody is
// looking at. The tray is the one surface that stays, so it carries the same
// fact — which bots are blocked on you, and on what.
import type { Bot } from "@/state/store";

export interface TrayWaiting {
  id: string;
  name: string;
  kind: "approval" | "question";
}

/** Bots with an unanswered card, most recent first.
 *
 * Mirrors pendingApprovals/pendingQuestion in PendingApproval.tsx: a card is
 * live when it has a requestId and has been neither answered nor dismissed,
 * and it is an approval rather than a question when it names a tool. */
export function waitingBots(bots: Bot[]): TrayWaiting[] {
  const waiting: Array<TrayWaiting & { at: number }> = [];
  for (const bot of bots) {
    if (bot.hidden) continue;
    let newest = 0;
    let open = false;
    // An approval outranks a question on the same bot: it is the one holding
    // a tool call open, so that is what the menu entry should say.
    let approval = false;
    for (const message of bot.messages ?? []) {
      const card = message.kind === "options" ? message.card : undefined;
      if (!card?.requestId || card.answered || card.dismissed) continue;
      open = true;
      if (card.tool) approval = true;
      newest = Math.max(newest, message.at);
    }
    if (open) waiting.push({ id: bot.id, name: bot.name, kind: approval ? "approval" : "question", at: newest });
  }
  return waiting.sort((a, b) => b.at - a.at).map(({ at: _at, ...bot }) => bot);
}
