// Shared plumbing for the mobile layouts. Every layout renders the same
// facts — who is working, what is blocked on you — so the queue, the
// titles and the layout preference live here rather than in each skin.
import { useCallback, useSyncExternalStore } from "react";
import { visibleMessages, type Bot, type Message } from "@/state/store";
import { pendingApprovals, pendingQuestion } from "@/components/PendingApproval";

export type MobileLayout = "rail" | "zen" | "simple";

export const mobileLayouts: Array<{ id: MobileLayout; name: string; hint: string }> = [
  { id: "rail", name: "Karar rayı", hint: "Bekleyen tek karar, yanında botların şerit rayı." },
  { id: "zen", name: "Monospace zen", hint: "Koyu konsol, telemetri sayaçları ve komut satırı." },
  { id: "simple", name: "Sade kumanda", hint: "Alt gezinme çubuklu klasik görünüm." },
];

const KEY = "mauscrew.mobileLayout";
const DEFAULT: MobileLayout = "rail";
const listeners = new Set<() => void>();

function read(): MobileLayout {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && mobileLayouts.some((item) => item.id === saved)) return saved as MobileLayout;
  } catch {
    // private mode or a blocked store — fall through to the default
  }
  return DEFAULT;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    removeEventListener("storage", listener);
  };
}

/**
 * Which mobile skin this device uses. It is a per-device choice — the phone
 * picks how it wants to look without changing the desktop or any other
 * paired device — so it lives in localStorage, not in synced app state.
 */
export function useMobileLayout(): [MobileLayout, (next: MobileLayout) => void] {
  const layout = useSyncExternalStore(subscribe, read, () => DEFAULT);
  const set = useCallback((next: MobileLayout) => {
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // preference is not persisted, but the session still switches
    }
    for (const listener of [...listeners]) listener();
  }, []);
  return [layout, set];
}

export function botWaiting(bot: Bot): boolean {
  const messages = visibleMessages(bot);
  return pendingApprovals(messages).length > 0 || Boolean(pendingQuestion(messages));
}

export function taskTitle(bot: Bot): string {
  return (
    bot.tasks?.find((task) => task.threadId === bot.threadId)?.title ||
    visibleMessages(bot).find((message) => message.role === "user")?.text ||
    "Henüz görev verilmedi"
  );
}

/** What the bot is doing right now, in its own words. */
export function currentActivity(bot: Bot): string | undefined {
  const last = visibleMessages(bot)
    .filter((message) => message.kind === "activity")
    .at(-1);
  return last?.tool?.spoken || last?.tool?.name;
}

export type DecisionKind = "approval" | "question";

export interface MobileDecision {
  id: string;
  bot: Bot;
  kind: DecisionKind;
  /** the question in one line */
  title: string;
  /** the raw thing being approved — shown in full, never truncated */
  detail: string;
  tool?: string;
  /** why auto mode stopped to ask anyway */
  held?: string;
  risk?: string;
  /** a question's own answers; approvals use allow/deny */
  options: string[];
  requestId: string;
  messageId: string;
  at: number;
}

const toolLabel: Record<string, string> = {
  Bash: "Komut çalıştırmak istiyor",
  shell: "Komut çalıştırmak istiyor",
  Read: "Dosya okumak istiyor",
  Write: "Dosya yazmak istiyor",
  Edit: "Dosya değiştirmek istiyor",
  edit: "Dosya değiştirmek istiyor",
  cordis_run: "Eklenti çalıştırmak istiyor",
};

function approvalTitle(tool: string): string {
  return toolLabel[tool] ?? `${tool} kullanmak istiyor`;
}

/** Everything blocked on you, oldest first, across every bot. */
export function collectDecisions(bots: Bot[]): MobileDecision[] {
  const out: MobileDecision[] = [];
  for (const bot of bots) {
    const messages = visibleMessages(bot);
    for (const pending of pendingApprovals(messages)) {
      out.push({
        id: `${bot.id}:${pending.requestId}`,
        bot,
        kind: "approval",
        title: approvalTitle(pending.tool),
        detail: pending.detail,
        tool: pending.tool,
        held: pending.held,
        risk: pending.message.card?.policy?.risk,
        options: [],
        requestId: pending.requestId,
        messageId: pending.message.id,
        at: pending.message.at,
      });
    }
    const question: Message | undefined = pendingQuestion(messages);
    if (question?.card?.requestId) {
      out.push({
        id: `${bot.id}:${question.card.requestId}`,
        bot,
        kind: "question",
        title: question.card.title || "Bir sorusu var",
        detail: question.card.subtitle,
        options: question.card.options,
        requestId: question.card.requestId,
        messageId: question.id,
        at: question.at,
      });
    }
  }
  return out;
}

/** Deferred decisions keep their place in the queue — at the back of it. */
export function orderDecisions(all: MobileDecision[], deferred: string[]): MobileDecision[] {
  const rank = (item: MobileDecision) => {
    const at = deferred.indexOf(item.id);
    return at === -1 ? -1 : at;
  };
  return [...all].sort((a, b) => {
    const left = rank(a), right = rank(b);
    if (left === right) return 0;
    if (left === -1) return -1;
    if (right === -1) return 1;
    return left - right;
  });
}

export function relativeTime(at: number): string {
  const minutes = Math.round((Date.now() - at) / 60000);
  if (minutes < 1) return "az önce";
  if (minutes < 60) return `${minutes} dakika önce`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} saat önce`;
  return `${Math.round(hours / 24)} gün önce`;
}
