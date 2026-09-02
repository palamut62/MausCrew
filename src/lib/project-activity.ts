// What a project has been up to, without opening it.
//
// A project in the sidebar is a heading with its rooms underneath. The rooms
// each say who spoke last, but the heading says nothing — so a project you
// have collapsed, or one holding four rooms, gives no sign that anything
// happened in it. The one thing you want from a project row is the same thing
// a chat row gives you: who moved last, what they said, and whether you have
// seen it.
import type { Bot, Group, Project } from "@/state/store";

export interface ProjectActivity {
  /** "Reviewer: the diff is fine" — or a working line while a bot runs. */
  preview: string;
  /** Newest message time across the project's rooms, or 0 when silent. */
  at: number;
  /** Any room in the project has unread messages. */
  unread: boolean;
  /** A member is mid-turn somewhere in the project. */
  working: boolean;
}

/**
 * @param rooms every room the app knows; the project's own are selected here
 * so callers cannot pass a filtered list that quietly drops a hidden room.
 */
export function projectActivity(project: Project, rooms: Group[], bots: Bot[]): ProjectActivity {
  const own = rooms.filter((room) => project.roomIds.includes(room.id));
  const unread = own.some((room) => room.unread);

  // A bot mid-turn outranks the last settled message: it is the more recent
  // fact, and it is the one that changes on its own while you watch.
  const busy = own.find((room) => room.busyBotId);
  if (busy) {
    const name = bots.find((bot) => bot.id === busy.busyBotId)?.name ?? "A bot";
    return { preview: `${name} is working…`, at: busy.messages.at(-1)?.at ?? 0, unread, working: true };
  }

  let newest: { room: Group; at: number } | null = null;
  for (const room of own) {
    const last = room.messages.at(-1);
    if (!last) continue;
    if (!newest || last.at > newest.at) newest = { room, at: last.at };
  }
  if (!newest) return { preview: own.length ? "No messages yet" : "No rooms yet", at: 0, unread, working: false };

  const last = newest.room.messages.at(-1)!;
  const text = last.kind === "activity" && last.tool ? last.tool.name : (last.text ?? "");
  // Same shape as a room row, so scanning the sidebar reads one way whether
  // the line belongs to a project or to a single room.
  const preview = last.role === "user" ? `You: ${text}` : last.from ? `${last.from.name}: ${text}` : text;
  return { preview, at: newest.at, unread, working: false };
}
