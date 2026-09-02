import { track } from "@/lib/analytics";
import { Spin } from "./Spin";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowClockwise, ArrowLineDown, BellRinging, CalendarDots, CaretDown, CaretRight, Check, ClipboardText, Copy, Crown, EyeSlash, FileArrowUp, FolderPlus, Gear, MagnifyingGlass, Pencil, Plus, PushPin, PushPinSlash, PuzzlePiece, Robot as BotIcon, ShareNetwork, Trash, TreeStructure, Users, UsersThree, X } from "@phosphor-icons/react";
import { api, useStore, formatTime, visibleMessages, type Bot, type Group, type Message, type Project } from "@/state/store";
import { MausAvatar, InitialsAvatar } from "./Avatar";
import { stateForBot } from "@/lib/mascot-motion";
import { botShareLink } from "@/lib/share-bot";
import { useUpdaterState } from "@/lib/updater";
import { cn } from "@/lib/cn";
import { downloadSelectedTeam } from "@/lib/team-files";
import { useDesktopCapabilities } from "./DesktopCapabilities";
import { SidebarUpdateCard } from "./UpdateBanner";

/** "Kerem Yildiz" → "KY", "kerem" → "K", "you@x.dev" → "Y", unset → "?" */
function profileInitials(profile?: { name?: string; email?: string }): string {
  const name = profile?.name?.trim();
  if (name) {
    const words = name.split(/\s+/);
    return words
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("");
  }
  const email = profile?.email?.trim();
  return email ? email[0]!.toUpperCase() : "?";
}

/** Manual update check, next to the settings gear. Packaged app only (no
 * bridge in dev/browser). One button, state-dependent: check → download →
 * restart, with a brief "up to date" tick when a check finds nothing so a
 * click is never silent. Actionable states are shown in the sidebar card. */
function UpdateButton() {
  const s = useUpdaterState();
  const [checkedAt, setCheckedAt] = useState(0);
  const updater = window.mauscrew?.updater;
  const status = s?.status ?? "idle";
  // download and install both round-trip through main before the status
  // changes — spin on the click itself, and let the new status clear it
  const [pending, setPending] = useState(false);
  useEffect(() => queueMicrotask(() => setPending(false)), [status]);
  // a check that found nothing lands back on idle — acknowledge it for 3s
  const upToDate = Boolean(checkedAt) && (!s || s.status === "idle") && Date.now() - checkedAt < 3000;
  useEffect(() => {
    if (!upToDate) return;
    const timer = setTimeout(() => setCheckedAt(0), 3000);
    return () => clearTimeout(timer);
  }, [upToDate]);
  if (!updater) return null;
  if (["available", "downloading", "downloaded", "installing", "error"].includes(status)) return null;

  const working =
    pending || status === "checking" || status === "downloading" || status === "installing";
  const label =
    status === "available"
      ? `Version ${s?.version ?? ""} available — download`
      : status === "downloading"
        ? s?.percent == null
          ? "Starting download…"
          : `Downloading… ${Math.round(s.percent)}%`
        : status === "downloaded"
          ? `Version ${s?.version ?? ""} ready — restart to update`
          : status === "installing"
            ? "Restarting to update…"
            : status === "checking"
              ? "Checking for updates…"
              : upToDate
                ? "You're up to date"
                : "Check for updates";

  return (
    <button
      onClick={() => {
        if (status === "downloaded") {
          setPending(true);
          return void updater.install();
        }
        if (status === "available") {
          setPending(true);
          return void updater.download();
        }
        setCheckedAt(Date.now());
        void updater.check();
      }}
      disabled={working}
      title={label}
      aria-label={label}
      className="relative rounded-md p-2 text-accent hover:bg-raised disabled:opacity-60"
    >
      {working ? (
        <Spin size={18} weight="fill" />
      ) : upToDate ? (
        <Check size={18} weight="fill" />
      ) : status === "available" ? (
        <ArrowLineDown size={18} weight="bold" />
      ) : (
        <ArrowClockwise size={18} weight="bold" />
      )}
      {status === "downloaded" && (
        <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-accent" />
      )}
    </button>
  );
}

function preview(bot: Bot, visible: Message[]): string {
  if (bot.busy) return "Working…";
  // the visible branch's tail — bot.messages holds every fork, so its last
  // entry can belong to a version the user switched away from. The walk is
  // the caller's to memoize; this used to rebuild it per call.
  const last = visible.at(-1);
  if (!last) return "";
  if (last.kind === "options" && last.card) return last.card.title;
  if (last.kind === "activity" && last.tool) return last.tool.name;
  if (last.kind === "screen") return "Screen frame";
  return last.text ?? "";
}

function messageSearchText(message: Message): string {
  return [
    message.text,
    message.card?.title,
    message.card?.subtitle,
    ...(message.card?.options ?? []),
    message.tool?.name,
    message.tool?.spoken,
    message.from?.name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

interface MenuState {
  botId: string;
  x: number;
  y: number;
}

function groupPreview(group: Group, bots: Bot[]): string {
  if (group.busyBotId) {
    return `${bots.find((b) => b.id === group.busyBotId)?.name ?? "A bot"} is working…`;
  }
  const last = group.messages.at(-1);
  if (!last) return "No messages yet";
  const text = last.kind === "activity" && last.tool ? last.tool.name : (last.text ?? "");
  if (last.role === "user") return `You: ${text}`;
  return last.from ? `${last.from.name}: ${text}` : text;
}

/** Room avatar: 2–3 overlapping mauses in the same 36px slot a bot gets. */
function StackedMauses({ members }: { members: Bot[] }) {
  if (members.length <= 1) {
    const b = members[0];
    return (
      <div className="flex size-9 shrink-0 items-center justify-center">
        {b ? <MausAvatar color={b.color} name={b.name} seed={b.id} shape={b.shape} image={b.avatarImage} size={36} /> : <Users size={18} className="text-ink-secondary" />}
      </div>
    );
  }
  const shown = members.slice(0, 3);
  const extra = members.length - shown.length;
  return (
    <div className="flex size-9 shrink-0 items-center justify-center">
      <div className="flex items-center -space-x-2">
        {shown.map((b) => (
          <MausAvatar key={b.id} color={b.color} name={b.name} size={20} />
        ))}
        {extra > 0 && (
          <span className="z-10 flex size-[15px] items-center justify-center rounded-full border border-hairline bg-raised font-mono text-[9px] font-medium tracking-tight text-ink-secondary">
            +{extra}
          </span>
        )}
      </div>
    </div>
  );
}

function GroupListItem({ group, onMenu }: { group: Group; onMenu: (menu: { groupId: string; x: number; y: number }) => void }) {
  const { state, dispatch } = useStore();
  const selected = state.activeView === "chat" && state.selectedId === group.id;
  const members = group.memberIds
    .map((id) => state.bots.find((b) => b.id === id))
    .filter((b): b is Bot => Boolean(b));
  const last = group.messages.at(-1);
  return (
    <button
      onClick={() => dispatch({ type: "select", id: group.id })}
      onContextMenu={(e) => {
        e.preventDefault();
        onMenu({ groupId: group.id, x: e.clientX, y: e.clientY });
      }}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left",
        selected ? "bg-raised" : "hover:bg-raised/60",
      )}
    >
      <StackedMauses members={members} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[15px] font-semibold text-ink">{group.name}</span>
          {selected && last && <span className="shrink-0 font-mono text-xs tracking-tight text-ink-secondary">{formatTime(last.at)}</span>}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[13px] text-ink-secondary">{groupPreview(group, state.bots)}</span>
          {group.unread && <span className="size-2 shrink-0 rounded-full bg-accent" role="img" aria-label="Unread messages" />}
        </div>
      </div>
    </button>
  );
}

function RoomContextMenu({
  menu,
  onClose,
}: {
  menu: { groupId: string; x: number; y: number };
  onClose: () => void;
}) {
  const { state, dispatch } = useStore();
  const group = state.groups.find((g) => g.id === menu.groupId);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-room-menu]")) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("blur", onClose);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);

  if (!group) return null;
  const top = Math.min(menu.y, window.innerHeight - 164);
  const left = Math.min(menu.x, window.innerWidth - 240);
  return createPortal(
    <div
      data-room-menu
      style={{ top, left }}
      className="fixed z-40 w-[228px] overflow-hidden rounded-xl border border-hairline bg-card py-1.5"
    >
      <button
        onClick={() => {
          void navigator.clipboard?.writeText(group.threadId);
          onClose();
        }}
        className="flex w-full items-center gap-3 px-3.5 py-2 text-left text-[14px] text-ink hover:bg-raised/70"
      >
        <ClipboardText size={16} weight="bold" className="text-ink-secondary" />
        Copy conversation ID
      </button>
      <button
        onClick={() => {
          dispatch({ type: "deleteGroup", groupId: group.id });
          onClose();
        }}
        className="flex w-full items-center gap-3 px-3.5 py-2 text-left text-[14px] text-danger hover:bg-raised/70"
      >
        <Trash size={16} weight="bold" />
        Delete Room
      </button>
    </div>,
    document.body,
  );
}

interface PendingTeamImport {
  manifest: unknown;
  name: string;
  roomName: string;
  members: Array<{ name: string; title: string }>;
}

function importPreview(manifest: unknown): PendingTeamImport {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error("This file does not contain a team.");
  }
  const root = manifest as Record<string, unknown>;
  if (root.format !== "mauscrew.team" && root.format !== "openmaus.team") {
    throw new Error("This is not a MausCrew team file.");
  }
  if (root.version !== 1) throw new Error(`Team file version ${String(root.version)} is not supported.`);
  if (!root.team || typeof root.team !== "object" || Array.isArray(root.team)) {
    throw new Error("This team file is missing its team definition.");
  }
  const team = root.team as Record<string, unknown>;
  if (typeof team.name !== "string" || !team.name.trim()) throw new Error("This team does not have a name.");
  if (!Array.isArray(team.members) || team.members.length === 0) throw new Error("This team has no members.");
  const members = team.members.map((member, index) => {
    if (!member || typeof member !== "object" || Array.isArray(member)) {
      throw new Error(`Team member ${index + 1} is invalid.`);
    }
    const value = member as Record<string, unknown>;
    if (typeof value.name !== "string" || !value.name.trim()) {
      throw new Error(`Team member ${index + 1} does not have a name.`);
    }
    return {
      name: value.name.trim(),
      title: typeof value.title === "string" ? value.title.trim() : "",
    };
  });
  const room = team.room;
  const roomName =
    room && typeof room === "object" && !Array.isArray(room) && typeof (room as Record<string, unknown>).name === "string"
      ? String((room as Record<string, unknown>).name).trim()
      : team.name.trim();
  return { manifest, name: team.name.trim(), roomName, members };
}

function ImportTeamPanel({
  pending,
  onClose,
  onImported,
  returnFocusRef,
}: {
  pending: PendingTeamImport;
  onClose: () => void;
  onImported: (name: string) => void;
  returnFocusRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const { dispatch } = useStore();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
    return () => returnFocusRef.current?.focus();
  }, [returnFocusRef]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !working) {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose, working]);

  const importTeam = async () => {
    setWorking(true);
    setError("");
    try {
      const response = (await api("/api/teams/import", {
        method: "POST",
        body: JSON.stringify(pending.manifest),
      })) as { bots: Bot[]; group: Group };
      for (const bot of response.bots) dispatch({ type: "botAdded", bot });
      dispatch({ type: "groupPatched", group: response.group });
      dispatch({ type: "select", id: response.group.id });
      track("team_imported", { members: response.bots.length });
      onImported(pending.name);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setWorking(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45"
      onMouseDown={(event) => event.target === event.currentTarget && !working && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-team-title"
        tabIndex={-1}
        className="w-[420px] max-w-[calc(100vw-32px)] rounded-xl border border-hairline bg-card p-5"
      >
        <div id="import-team-title" className="text-[17px] font-semibold text-ink">Import {pending.name}?</div>
        <div className="mt-1 text-[13px] text-ink-secondary">
          This creates {pending.members.length} new {pending.members.length === 1 ? "bot" : "bots"} and the room “{pending.roomName}”.
        </div>
        <div className="mt-4 max-h-64 space-y-1 overflow-y-auto rounded-xl bg-raised/50 p-2">
          {pending.members.map((member, index) => (
            <div key={`${member.name}-${index}`} className="flex items-baseline gap-2 rounded-lg px-2.5 py-2">
              <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">{member.name}</span>
              <span className="max-w-[190px] truncate text-[12.5px] text-ink-secondary">
                {member.title || "General assistant"}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 text-[12.5px] leading-relaxed text-ink-secondary">
          The bots will use your default engine. Conversations, permissions, and computer access are never imported.
        </div>
        {error && <div role="alert" className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-[12.5px] text-danger">{error}</div>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={working}
            className="rounded-lg px-3.5 py-2 text-[13.5px] text-ink-secondary hover:bg-raised disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            onClick={() => void importTeam()}
            disabled={working}
            className="flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-[13.5px] font-medium text-app hover:bg-accent/90 disabled:opacity-60"
          >
            {working ? <Spin size={15} weight="fill" /> : <FileArrowUp size={15} weight="bold" />}
            {working ? "Importing…" : "Import Team"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ExportTeamPanel({
  onClose,
  onExported,
  returnFocusRef,
}: {
  onClose: () => void;
  onExported: (name: string) => void;
  returnFocusRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const { state } = useStore();
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const bots = state.bots.filter((bot) => !bot.hidden);
  const dialogRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
    return () => returnFocusRef.current?.focus();
  }, [returnFocusRef]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !working) {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose, working]);

  const toggle = (id: string) => {
    setPicked((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else if (next.size < 50) next.add(id);
      return next;
    });
  };

  const exportTeam = async () => {
    const teamName = name.trim();
    if (!teamName || picked.size === 0) return;
    setWorking(true);
    setError("");
    try {
      const exported = await downloadSelectedTeam(teamName, [...picked]);
      track("team_exported", { members: exported.members });
      onExported(exported.name);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setWorking(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45"
      onMouseDown={(event) => event.target === event.currentTarget && !working && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-team-title"
        tabIndex={-1}
        className="w-[380px] max-w-[calc(100vw-32px)] rounded-xl border border-hairline bg-card p-5"
      >
        <div id="export-team-title" className="text-[17px] font-semibold text-ink">Export Team</div>
        <div className="mt-1 text-[13px] text-ink-secondary">
          Choose any bots to share. You do not need to create a room first.
        </div>
        <input
          ref={nameRef}
          value={name}
          maxLength={100}
          disabled={working}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void exportTeam();
          }}
          placeholder="Team name"
          aria-label="Team name"
          className="mt-4 w-full rounded-lg bg-raised/70 px-3 py-2 text-[14px] text-ink placeholder:text-ink-secondary focus:outline-none disabled:opacity-60"
        />
        <div className="mt-3 flex max-h-64 flex-col gap-0.5 overflow-y-auto rounded-xl bg-raised/30 p-1.5">
          {bots.length === 0 && (
            <div className="px-2 py-5 text-center text-[13px] text-ink-secondary">
              Create a bot first, then it can be shared as part of a team.
            </div>
          )}
          {bots.map((bot) => {
            const selected = picked.has(bot.id);
            const capped = !selected && picked.size >= 50;
            return (
              <button
                key={bot.id}
                type="button"
                aria-pressed={selected}
                disabled={working || capped}
                onClick={() => toggle(bot.id)}
                className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-raised/70 disabled:opacity-40"
              >
                <MausAvatar color={bot.color} name={bot.name} seed={bot.id} shape={bot.shape} image={bot.avatarImage} size={28} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] text-ink">{bot.name}</span>
                  {bot.title && <span className="block truncate text-[11.5px] text-ink-secondary">{bot.title}</span>}
                </span>
                <span
                  className={cn(
                    "flex size-[18px] shrink-0 items-center justify-center rounded-md border",
                    selected ? "border-accent bg-accent text-app" : "border-hairline",
                  )}
                >
                  {selected && <Check size={12} weight="fill" />}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 text-[12.5px] leading-relaxed text-ink-secondary">
          Messages, permissions, credentials, engines, and computer access are never included.
        </div>
        {error && (
          <div role="alert" className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-[12.5px] text-danger">
            {error}
          </div>
        )}
        <div className="mt-5 flex items-center justify-between gap-3">
          <span className="text-[12.5px] text-ink-secondary">
            {picked.size} {picked.size === 1 ? "bot" : "bots"} selected
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={working}
              className="rounded-lg px-3.5 py-2 text-[13.5px] text-ink-secondary hover:bg-raised disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void exportTeam()}
              disabled={working || !name.trim() || picked.size === 0}
              className="flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-[13.5px] font-medium text-app hover:bg-accent/90 disabled:opacity-40"
            >
              {working ? <Spin size={15} weight="fill" /> : <ArrowLineDown size={15} weight="bold" />}
              {working ? "Exporting…" : "Export"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function parseProjectResources(value: string): Array<{ label: string; value: string }> {
  return value
    .split(/\r?\n/)
    .map((line) => {
      const separator = line.indexOf(":");
      if (separator < 1) return null;
      const label = line.slice(0, separator).trim();
      const resourceValue = line.slice(separator + 1).trim();
      return label && resourceValue ? { label, value: resourceValue } : null;
    })
    .filter((resource): resource is { label: string; value: string } => Boolean(resource));
}

/** Pick members → Create. The room name is optional; the server defaults it. */
function NewRoomPanel({ onClose, defaultProjectId }: { onClose: () => void; defaultProjectId?: string }) {
  const { state, dispatch } = useStore();
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState(defaultProjectId ?? "");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const cardRef = useRef<HTMLDivElement>(null);
  const bots = state.bots.filter((b) => !b.hidden);
  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  // Modal keyboard containment: Escape closes from anywhere in the dialog
  // (capture phase, so handlers behind the overlay don't also fire), and Tab
  // wraps inside the card instead of escaping to the sidebar beneath.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const focusables = cardRef.current?.querySelectorAll<HTMLElement>(
        'input, button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables?.length) return;
      const list = [...focusables];
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !cardRef.current?.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);
  const create = () => {
    if (!picked.size) return;
    dispatch({ type: "createGroup", memberIds: [...picked], name: name.trim() || undefined, projectId: projectId || undefined });
    track("room_created", { members: picked.size });
    onClose();
  };
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label="New Room"
        className="w-[340px] rounded-xl border border-hairline bg-card p-4"
      >
        <div className="mb-3 text-[15px] font-semibold text-ink">New Room</div>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") create();
          }}
          placeholder="Room name (optional)"
          className="mb-3 w-full rounded-lg bg-raised/70 px-3 py-2 text-[14px] text-ink placeholder:text-ink-secondary focus:outline-none"
        />
        {state.projects.length > 0 && (
          <label className="mb-3 block">
            <span className="mb-1 block text-[11px] font-medium text-ink-secondary">Project boundary</span>
            <select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="w-full rounded-lg border border-hairline bg-raised/70 px-3 py-2 text-[12.5px] text-ink focus:outline-none">
              <option value="">No project — standalone room</option>
              {state.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </label>
        )}
        <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
          {bots.length === 0 && (
            <div className="px-2 py-4 text-center text-[13px] text-ink-secondary">Create a bot first — rooms are made of bots.</div>
          )}
          {bots.map((b) => (
            <button
              key={b.id}
              onClick={() => toggle(b.id)}
              className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-raised/50"
            >
              <MausAvatar color={b.color} name={b.name} seed={b.id} shape={b.shape} image={b.avatarImage} size={28} />
              <span className="min-w-0 flex-1 truncate text-[14px] text-ink">{b.name}</span>
              <span
                className={cn(
                  "flex size-[18px] shrink-0 items-center justify-center rounded-md border",
                  picked.has(b.id) ? "border-accent bg-accent text-app" : "border-hairline",
                )}
              >
                {picked.has(b.id) && <Check size={12} weight="fill" />}
              </span>
            </button>
          ))}
        </div>
        <button
          onClick={create}
          disabled={!picked.size}
          className="mt-3 w-full rounded-lg bg-accent py-2 text-[14px] font-medium text-app hover:brightness-110 disabled:opacity-40"
        >
          Create Room{picked.size ? ` · ${picked.size} ${picked.size === 1 ? "bot" : "bots"}` : ""}
        </button>
      </div>
    </div>
  );
}

function NewProjectPanel({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useStore();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [workspacePath, setWorkspacePath] = useState("");
  const [instructions, setInstructions] = useState("");
  const [resources, setResources] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const bots = state.bots.filter((bot) => !bot.hidden);
  const toggle = (id: string) => setPicked((previous) => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const create = () => {
    if (!name.trim() || !picked.size) return;
    dispatch({
      type: "createProject",
      input: {
        name: name.trim(),
        description: description.trim() || undefined,
        workspacePath: workspacePath.trim() || undefined,
        instructions: instructions.trim() || undefined,
        resources: parseProjectResources(resources),
        memberIds: [...picked],
      },
    });
    onClose();
  };
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="New Project" className="max-h-[90vh] w-full max-w-[520px] overflow-y-auto rounded-xl border border-hairline bg-card p-5">
        <div className="flex items-center justify-between gap-3"><div><div className="text-[16px] font-semibold text-ink">New Project</div><div className="mt-0.5 text-[11.5px] text-ink-secondary">A private room, workspace, instructions, and team in one boundary.</div></div><button onClick={onClose} className="rounded-lg p-2 text-ink-secondary hover:bg-raised hover:text-ink"><X size={16} /></button></div>
        <div className="mt-4 grid gap-3">
          <label><span className="mb-1 block text-[11px] font-medium text-ink-secondary">Name</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="MausCrew Project" className="w-full rounded-lg border border-hairline bg-raised/60 px-3 py-2 text-[13px] text-ink focus:outline-none" /></label>
          <label><span className="mb-1 block text-[11px] font-medium text-ink-secondary">Description</span><input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What this team owns" className="w-full rounded-lg border border-hairline bg-raised/60 px-3 py-2 text-[13px] text-ink focus:outline-none" /></label>
          <label><span className="mb-1 block text-[11px] font-medium text-ink-secondary">Workspace</span><div className="flex gap-2"><input value={workspacePath} onChange={(event) => setWorkspacePath(event.target.value)} placeholder="C:\\projects\\mauscrew" className="min-w-0 flex-1 rounded-lg border border-hairline bg-raised/60 px-3 py-2 font-mono text-[11.5px] text-ink focus:outline-none" /><button onClick={async () => { const pickedPath = await window.mauscrew?.chooseWorkspace?.(); if (pickedPath) setWorkspacePath(pickedPath); }} className="rounded-lg border border-hairline px-3 text-[11.5px] text-ink-secondary hover:bg-raised hover:text-ink">Browse</button></div></label>
          <label><span className="mb-1 block text-[11px] font-medium text-ink-secondary">Shared instructions</span><textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} rows={3} placeholder="Rules every member should follow in this project" className="w-full resize-y rounded-lg border border-hairline bg-raised/60 px-3 py-2 text-[12px] text-ink focus:outline-none" /></label>
          <label><span className="mb-1 block text-[11px] font-medium text-ink-secondary">Resources</span><textarea value={resources} onChange={(event) => setResources(event.target.value)} rows={3} placeholder={"Design: https://…\nBrief: C:\\projects\\brief.md"} className="w-full resize-y rounded-lg border border-hairline bg-raised/60 px-3 py-2 font-mono text-[11.5px] text-ink focus:outline-none" /><span className="mt-1 block text-[10.5px] text-ink-secondary">One Label: value resource per line. Every room member receives it as project context.</span></label>
        </div>
        <div className="mt-4 text-[11px] font-medium text-ink-secondary">Team</div>
        <div className="mt-1.5 grid max-h-56 gap-1 overflow-y-auto sm:grid-cols-2">{bots.map((bot) => <button key={bot.id} onClick={() => toggle(bot.id)} className="flex items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-raised"><MausAvatar color={bot.color} name={bot.name} seed={bot.id} shape={bot.shape} image={bot.avatarImage} size={25} /><span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{bot.name}</span><span className={cn("flex size-4 items-center justify-center rounded border", picked.has(bot.id) ? "border-accent bg-accent text-app" : "border-hairline")}>{picked.has(bot.id) && <Check size={10} weight="fill" />}</span></button>)}</div>
        <button disabled={!name.trim() || !picked.size} onClick={create} className="mt-4 w-full rounded-lg bg-accent py-2.5 text-[13px] font-semibold text-app hover:brightness-110 disabled:opacity-40">Create project and room</button>
      </div>
    </div>,
    document.body,
  );
}

function ProjectSettingsPanel({ project, onClose }: { project: Project; onClose: () => void }) {
  const { dispatch } = useStore();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [workspacePath, setWorkspacePath] = useState(project.workspacePath ?? "");
  const [instructions, setInstructions] = useState(project.instructions);
  const [resources, setResources] = useState(() => project.resources.map((resource) => `${resource.label}: ${resource.value}`).join("\n"));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const save = () => {
    if (!name.trim()) return;
    dispatch({ type: "updateProject", projectId: project.id, patch: { name: name.trim(), description: description.trim(), workspacePath: workspacePath.trim(), instructions: instructions.trim(), resources: parseProjectResources(resources).map((resource, index) => ({ id: project.resources[index]?.id ?? `resource-${index}`, ...resource })) } });
    onClose();
  };
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={`Edit ${project.name}`} className="w-full max-w-[520px] rounded-xl border border-hairline bg-card p-5">
        <div className="flex items-center justify-between"><div><div className="text-[16px] font-semibold text-ink">Project settings</div><div className="mt-0.5 text-[11px] text-ink-secondary">Changes apply only inside this project's rooms.</div></div><button onClick={onClose} className="rounded-lg p-2 text-ink-secondary hover:bg-raised hover:text-ink"><X size={16} /></button></div>
        <div className="mt-4 grid gap-3">
          <label><span className="mb-1 block text-[11px] text-ink-secondary">Name</span><input value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-lg border border-hairline bg-raised/60 px-3 py-2 text-[13px] text-ink focus:outline-none" /></label>
          <label><span className="mb-1 block text-[11px] text-ink-secondary">Description</span><input value={description} onChange={(event) => setDescription(event.target.value)} className="w-full rounded-lg border border-hairline bg-raised/60 px-3 py-2 text-[13px] text-ink focus:outline-none" /></label>
          <label><span className="mb-1 block text-[11px] text-ink-secondary">Workspace</span><div className="flex gap-2"><input value={workspacePath} onChange={(event) => setWorkspacePath(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-hairline bg-raised/60 px-3 py-2 font-mono text-[11.5px] text-ink focus:outline-none" /><button onClick={async () => { const pickedPath = await window.mauscrew?.chooseWorkspace?.(); if (pickedPath) setWorkspacePath(pickedPath); }} className="rounded-lg border border-hairline px-3 text-[11px] text-ink-secondary hover:bg-raised hover:text-ink">Browse</button></div></label>
          <label><span className="mb-1 block text-[11px] text-ink-secondary">Shared instructions</span><textarea rows={4} value={instructions} onChange={(event) => setInstructions(event.target.value)} className="w-full resize-y rounded-lg border border-hairline bg-raised/60 px-3 py-2 text-[12px] text-ink focus:outline-none" /></label>
          <label><span className="mb-1 block text-[11px] text-ink-secondary">Resources</span><textarea rows={3} value={resources} onChange={(event) => setResources(event.target.value)} placeholder="Label: URL or local path" className="w-full resize-y rounded-lg border border-hairline bg-raised/60 px-3 py-2 font-mono text-[11.5px] text-ink focus:outline-none" /></label>
        </div>
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-hairline pt-4">
          {confirmDelete ? <div className="flex items-center gap-2"><span className="text-[11px] text-danger">Keep rooms, remove project?</span><button onClick={() => { dispatch({ type: "deleteProject", projectId: project.id }); onClose(); }} className="rounded-lg bg-danger px-2.5 py-1.5 text-[11px] font-medium text-white">Remove</button><button onClick={() => setConfirmDelete(false)} className="px-2 py-1.5 text-[11px] text-ink-secondary">Cancel</button></div> : <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[11.5px] text-danger hover:bg-danger/10"><Trash size={13} />Remove project</button>}
          <button disabled={!name.trim()} onClick={save} className="rounded-lg bg-accent px-4 py-2 text-[12px] font-semibold text-app hover:brightness-110 disabled:opacity-40">Save</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function BotContextMenu({ menu, onClose }: { menu: MenuState; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const bot = state.bots.find((b) => b.id === menu.botId);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-bot-menu]")) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("blur", onClose);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);

  if (!bot) return null;
  const engine = state.instances.find((instance) => instance.instanceId === bot.modelSelection.instanceId);
  const canCoordinate = engine?.capabilities?.agentsMcp === true;
  // keep the menu on-screen near the click
  const top = Math.max(8, Math.min(menu.y, window.innerHeight - 380));
  const left = Math.min(menu.x, window.innerWidth - 240);

  const item = (
    icon: React.ReactNode,
    label: string,
    onClick?: () => void,
    opts?: { danger?: boolean; disabled?: boolean; hint?: string },
  ) => (
    <button
      key={label}
      disabled={opts?.disabled}
      onClick={() => {
        onClick?.();
        onClose();
      }}
      title={opts?.hint}
      className={cn(
        "flex w-full items-center gap-3 px-3.5 py-2 text-left text-[14px]",
        opts?.danger ? "text-danger" : "text-ink",
        opts?.disabled ? "cursor-default opacity-40" : "hover:bg-raised/70",
      )}
    >
      {icon}
      {label}
    </button>
  );
  const divider = (key: string) => <div key={key} className="mx-2 my-1 border-t border-hairline" />;

  return (
    <div
      data-bot-menu
      style={{ top, left }}
      className="fixed z-40 w-[228px] overflow-hidden rounded-xl border border-hairline bg-card py-1.5"
    >
      {[
        item(
          bot.pinned ? <PushPinSlash size={16} weight="bold" className="text-ink-secondary" /> : <PushPin size={16} weight="bold" className="text-ink-secondary" />,
          bot.pinned ? "Unpin" : "Pin",
          () => dispatch({ type: "updateBot", botId: bot.id, patch: { pinned: !bot.pinned } }),
        ),
        item(
          <Crown size={16} weight={bot.chiefOfStaff ? "fill" : "bold"} className={bot.chiefOfStaff ? "text-accent" : "text-ink-secondary"} />,
          bot.chiefOfStaff ? "Remove Chief of Staff" : "Make Chief of Staff",
          () => dispatch({ type: "updateBot", botId: bot.id, patch: { chiefOfStaff: !bot.chiefOfStaff } }),
          {
            disabled: !bot.chiefOfStaff && !canCoordinate,
            hint: !bot.chiefOfStaff && !canCoordinate ? "Choose a Claude or ACP engine first" : undefined,
          },
        ),
        item(<FolderPlus size={16} weight="bold" className="text-ink-secondary" />, "Move to new section", undefined, {
          disabled: true,
          hint: "Coming soon",
        }),
        item(<BellRinging size={16} weight="bold" className="text-ink-secondary" />, "Mark as Unread", () =>
          dispatch({ type: "markUnread", botId: bot.id }),
        ),
        divider("d1"),
        item(<Pencil size={16} weight="bold" className="text-ink-secondary" />, "Edit Profile", () => {
          dispatch({ type: "select", id: bot.id });
          dispatch({ type: "toggleSettings", open: true });
        }),
        item(<Copy size={16} weight="bold" className="text-ink-secondary" />, "Duplicate", () =>
          dispatch({ type: "duplicateBot", botId: bot.id }),
        ),
        divider("d2"),
        item(<ClipboardText size={16} weight="bold" className="text-ink-secondary" />, "Copy conversation ID", () => {
          void navigator.clipboard?.writeText(bot.threadId);
        }),
        // Carries the profile only. The recipient reviews it in the import
        // dialog before any bot is created on their side.
        item(<ShareNetwork size={16} weight="bold" className="text-ink-secondary" />, "Copy share link", () => {
          void navigator.clipboard?.writeText(botShareLink(bot));
        }),
        divider("d3"),
        item(
          <EyeSlash size={16} weight="bold" className="text-ink-secondary" />,
          "Hide from sidebar",
          () => dispatch({ type: "updateBot", botId: bot.id, patch: { hidden: true } }),
          {
            disabled: Boolean(bot.chiefOfStaff),
            hint: bot.chiefOfStaff ? "Choose another Chief of Staff first" : undefined,
          },
        ),
        item(<Trash size={16} weight="bold" />, "Delete", () => dispatch({ type: "deleteBot", botId: bot.id }), {
          danger: true,
        }),
      ]}
    </div>
  );
}

function BotListItem({ bot, onMenu }: { bot: Bot; onMenu: (menu: MenuState) => void }) {
  const { state, dispatch } = useStore();
  const selected = state.activeView === "chat" && state.selectedId === bot.id;
  // the visible branch, so a version switch changes the row with the chat.
  // Memoized on the bot record: a row re-renders on every store change (the
  // context is whole-state), and an unmemoized walk rebuilt its parent Map
  // over the full fork tree three times per render — here plus two preview
  // calls that each walked again.
  const visible = useMemo(() => visibleMessages(bot), [bot]);
  const last = visible.at(-1);
  const previewText = preview(bot, visible);
  return (
    <button
      data-bot-id={bot.id}
      onClick={() => dispatch({ type: "select", id: bot.id })}
      onContextMenu={(e) => {
        e.preventDefault();
        onMenu({ botId: bot.id, x: e.clientX, y: e.clientY });
      }}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left",
        bot.chiefOfStaff
          ? selected
            ? "bg-raised"
            : "hover:bg-raised/60"
          : selected
            ? "bg-raised"
            : "hover:bg-raised/60",
      )}
    >
      <MausAvatar color={bot.color} name={bot.name} seed={bot.id} shape={bot.shape} image={bot.avatarImage} state={stateForBot(bot)} size={36} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5 truncate text-[15px] font-semibold text-ink">
            {bot.pinned && (
              <PushPin size={12} weight={selected ? "fill" : "bold"} className="shrink-0 text-ink-secondary" />
            )}
            <span className="truncate">{bot.name}</span>
          </span>
          {selected && last && (
            <span className="shrink-0 font-mono text-xs tracking-tight text-ink-secondary">
              {formatTime(last.at)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5 truncate text-[13px] text-ink-secondary">
            {bot.chiefOfStaff && (
              <span className="flex shrink-0 items-center gap-1 font-mono text-[11.5px] font-medium tracking-tight text-accent">
                <Crown size={11} weight="fill" /> Chief of Staff
              </span>
            )}
            {bot.chiefOfStaff && previewText && <span className="shrink-0 text-ink-secondary/60">·</span>}
            <span className="truncate">{previewText}</span>
          </span>
          {bot.unread && (
            <span className="size-2 shrink-0 rounded-full bg-accent" role="img" aria-label="Unread messages" />
          )}
        </div>
      </div>
    </button>
  );
}

export function Sidebar({ open, onClose, onOpenDirectory }: { open: boolean; onClose: () => void; onOpenDirectory: () => void }) {
  const { state, dispatch } = useStore();
  const { capabilities } = useDesktopCapabilities();
  const importInputRef = useRef<HTMLInputElement>(null);
  const importReturnRef = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [roomMenu, setRoomMenu] = useState<{ groupId: string; x: number; y: number } | null>(null);
  const [plusOpen, setPlusOpen] = useState(false);
  const [newRoom, setNewRoom] = useState(false);
  const [newRoomProjectId, setNewRoomProjectId] = useState<string | undefined>();
  const [newProject, setNewProject] = useState(false);
  const [editProjectId, setEditProjectId] = useState<string | null>(null);
  const [exportTeamOpen, setExportTeamOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<PendingTeamImport | null>(null);
  const [teamFeedback, setTeamFeedback] = useState<{ error: boolean; text: string } | null>(null);
  const [query, setQuery] = useState("");
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem("mauscrew.sidebar.collapsed-sections") ?? "[]"));
    } catch {
      return new Set();
    }
  });

  // Esc closes the drawer, mirroring ApiKeys.tsx:75-85. Bound only while the
  // drawer is open — on mobile, exactly when a bot/room context menu or the
  // New Room panel can be open on top of it, so the same Escape press closes
  // them together. Fine, since both directions are "get me out of here."
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose]);

  useEffect(() => {
    if (!teamFeedback) return;
    const timer = window.setTimeout(() => setTeamFeedback(null), 5000);
    return () => window.clearTimeout(timer);
  }, [teamFeedback]);

  const chooseTeamFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (file.size > 1_000_000) {
      setTeamFeedback({ error: true, text: "That team file is too large." });
      return;
    }
    try {
      const manifest: unknown = JSON.parse(await file.text());
      setPendingImport(importPreview(manifest));
      setTeamFeedback(null);
    } catch (cause) {
      setTeamFeedback({
        error: true,
        text: cause instanceof SyntaxError ? "That team file is not valid JSON." : cause instanceof Error ? cause.message : String(cause),
      });
    }
  };

  const macInset = capabilities.windowChrome === "mac-inset";

  const q = query.trim().toLowerCase();
  const matchingBots = state.bots
    .filter((b) => !b.hidden)
    .filter(
      (b) =>
        !q ||
        b.name.toLowerCase().includes(q) ||
        (b.title ?? "").toLowerCase().includes(q) ||
        (b.section ?? "").toLowerCase().includes(q) ||
        (b.tasks ?? []).some((task) => task.title.toLowerCase().includes(q)) ||
        visibleMessages(b).some((message) => messageSearchText(message).includes(q)),
    );
  const chiefBot = matchingBots.find((bot) => bot.chiefOfStaff);
  const visibleBots = matchingBots
    .filter((bot) => !bot.chiefOfStaff)
    .sort((a, b) => Number(b.pinned ?? false) - Number(a.pinned ?? false));
  const visibleGroups = state.groups.filter(
    (group) =>
      !q ||
      group.name.toLowerCase().includes(q) ||
      group.bulletin.toLowerCase().includes(q) ||
      group.messages.some((message) => messageSearchText(message).includes(q)),
  );
  const projectRoomIds = new Set(state.projects.flatMap((project) => project.roomIds));
  const looseGroups = visibleGroups.filter((group) => !projectRoomIds.has(group.id));
  const sectionedBots = new Map<string, Bot[]>();
  for (const bot of visibleBots) {
    const section = bot.section?.trim() || "Unassigned";
    const members = sectionedBots.get(section) ?? [];
    members.push(bot);
    sectionedBots.set(section, members);
  }
  const orderedSections = [...sectionedBots.entries()].sort(([left], [right]) => {
    if (left === "Unassigned") return 1;
    if (right === "Unassigned") return -1;
    return left.localeCompare(right);
  });
  const toggleSection = (section: string) => {
    setCollapsedSections((previous) => {
      const next = new Set(previous);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      localStorage.setItem("mauscrew.sidebar.collapsed-sections", JSON.stringify([...next]));
      return next;
    });
  };

  return (
    <aside
      className={cn(
        "flex h-full w-[280px] shrink-0 flex-col border-r border-hairline bg-panel",
        // Below md only: the sidebar leaves the flow and slides in over the chat.
        // Scoped with max-md: rather than cancelled with md: on purpose — Tailwind
        // v4 emits the native `translate` property, and any value other than
        // `none` turns this element into a containing block for its `fixed`
        // descendants. Cancelling it with an `md:` prefix still emits a value, which
        // silently reparents NewRoomPanel's overlay and the "+" menu backdrop on
        // desktop.
        "max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:z-40",
        // A 280px drawer leaves a 80px sliver of chat on a 360px phone — too
        // narrow to read, wide enough to look like a mistake. Take most of
        // the screen and keep a strip of backdrop to tap on.
        "max-md:w-[min(86vw,340px)] max-md:shadow-[0_0_40px_rgba(0,0,0,0.5)]",
        "max-md:transition-transform max-md:duration-200",
        open ? "max-md:translate-x-0" : "max-md:-translate-x-full",
      )}
    >
      {/* macOS owns inset traffic lights, so reserve the space they occupy;
          Linux/Windows use native chrome. In a browser tab there is no window
          to control, and this used to paint imitation macOS traffic lights —
          three dead dots in another OS's colours, on every platform. */}
      <div
        className="flex h-[52px] items-center justify-between px-4 pb-1 pt-3.5"
        style={macInset ? ({ WebkitAppRegion: "drag" } as React.CSSProperties) : undefined}
      >
        {macInset ? (
          <div className="w-14" />
        ) : (
          // On a phone the drawer covers the chat, so it needs its own way
          // back. Above md it is a permanent column with nothing to close —
          // invisible rather than hidden, because it is also the spacer that
          // justify-between uses to push the "+" to the right edge.
          <button
            type="button"
            onClick={onClose}
            aria-label="Close bot list"
            className="-ml-2 flex size-10 items-center justify-center rounded-lg text-ink-secondary hover:bg-raised hover:text-ink md:invisible"
          >
            <X size={18} weight="bold" />
          </button>
        )}
        <div
          className="relative"
          style={macInset ? ({ WebkitAppRegion: "no-drag" } as React.CSSProperties) : undefined}
        >
          <button
            ref={importReturnRef}
            onClick={() => setPlusOpen((o) => !o)}
            className="rounded-lg p-1.5 text-ink-secondary hover:bg-raised hover:text-ink"
            title="New or share"
          >
            <Plus size={20} weight="bold" strokeWidth={2} />
          </button>
          {plusOpen && (
            <>
              <div className="fixed inset-0 z-30" onMouseDown={() => setPlusOpen(false)} />
              <div className="absolute right-0 top-full z-40 mt-1 w-44 overflow-hidden rounded-xl border border-hairline bg-card py-1.5">
                <button
                  onClick={() => {
                    setPlusOpen(false);
                    setNewProject(true);
                  }}
                  className="flex w-full items-center gap-3 px-3.5 py-2 text-left text-[14px] text-ink hover:bg-raised/70"
                >
                  <FolderPlus size={16} weight="bold" className="text-ink-secondary" />
                  New Project
                </button>
                <button
                  onClick={() => {
                    setPlusOpen(false);
                    track("bot_created");
                    dispatch({ type: "newBot" });
                  }}
                  className="flex w-full items-center gap-3 px-3.5 py-2 text-left text-[14px] text-ink hover:bg-raised/70"
                >
                  <BotIcon size={16} weight="bold" className="text-ink-secondary" />
                  New Bot
                </button>
                <button
                  onClick={() => {
                    setPlusOpen(false);
                    onOpenDirectory();
                  }}
                  className="flex w-full items-center gap-3 px-3.5 py-2 text-left text-[14px] text-ink hover:bg-raised/70"
                >
                  <MagnifyingGlass size={16} weight="bold" className="text-ink-secondary" />
                  Ready-made Bots
                </button>
                <button
                  onClick={() => {
                    setPlusOpen(false);
                    setNewRoomProjectId(undefined);
                    setNewRoom(true);
                  }}
                  className="flex w-full items-center gap-3 px-3.5 py-2 text-left text-[14px] text-ink hover:bg-raised/70"
                >
                  <Users size={16} weight="bold" className="text-ink-secondary" />
                  New Room
                </button>
                <button
                  onClick={() => {
                    setPlusOpen(false);
                    setExportTeamOpen(true);
                  }}
                  className="flex w-full items-center gap-3 px-3.5 py-2 text-left text-[14px] text-ink hover:bg-raised/70"
                >
                  <ArrowLineDown size={16} weight="bold" className="text-ink-secondary" />
                  Export Team
                </button>
                <button
                  onClick={() => {
                    setPlusOpen(false);
                    importInputRef.current?.click();
                  }}
                  className="flex w-full items-center gap-3 px-3.5 py-2 text-left text-[14px] text-ink hover:bg-raised/70"
                >
                  <FileArrowUp size={16} weight="bold" className="text-ink-secondary" />
                  Import Team
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <input
        ref={importInputRef}
        type="file"
        accept=".json,.mausteam.json,application/json"
        onChange={(event) => void chooseTeamFile(event)}
        className="hidden"
        aria-label="Choose a MausCrew team file"
      />

      {/* MagnifyingGlass */}
      <div className="px-3 pb-2 pt-1">
        <div className="flex items-center gap-2 rounded-xl bg-inset px-2.5 py-2">
          <MagnifyingGlass size={16} weight="bold" className="text-ink-secondary" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setQuery("")}
            placeholder="Search"
            aria-label="Search bots"
            className="w-full bg-transparent text-[14px] text-ink placeholder:text-ink-secondary focus:outline-none"
          />
        </div>
      </div>

      {/* Bot list */}
      <div className="flex-1 overflow-y-auto px-2.5">
        <div className="flex flex-col gap-1">
          {!chiefBot && visibleBots.length === 0 && visibleGroups.length === 0 && q && (
            <div className="px-3 py-6 text-center text-[13px] text-ink-secondary">Nothing matches “{query}”</div>
          )}
          {chiefBot && (
            <div className="mb-1.5">
              <BotListItem bot={chiefBot} onMenu={setMenu} />
            </div>
          )}
          {state.projects.map((project) => {
            const rooms = visibleGroups.filter((group) => project.roomIds.includes(group.id));
            if (!rooms.length && q) return null;
            return (
              <div key={project.id} className="mb-1 rounded-lg border border-hairline/60 bg-inset/20 p-1">
                <div className="flex items-center gap-1.5 px-2 py-1 text-[10.5px] font-medium uppercase tracking-[0.08em] text-ink-secondary">
                  <FolderPlus size={12} weight="bold" />
                  <span className="min-w-0 flex-1 truncate">{project.name}</span>
                  <button onClick={() => { setNewRoomProjectId(project.id); setNewRoom(true); }} aria-label={`Add room to ${project.name}`} className="rounded p-1 hover:bg-raised hover:text-ink"><Plus size={11} weight="bold" /></button>
                  <button onClick={() => setEditProjectId(project.id)} aria-label={`Edit ${project.name}`} className="rounded p-1 hover:bg-raised hover:text-ink"><Pencil size={11} weight="bold" /></button>
                </div>
                {rooms.map((group) => <GroupListItem key={group.id} group={group} onMenu={setRoomMenu} />)}
              </div>
            );
          })}
          {looseGroups.map((g) => (
            <GroupListItem key={g.id} group={g} onMenu={setRoomMenu} />
          ))}
          {orderedSections.map(([section, bots]) => {
            const collapsed = !q && collapsedSections.has(section);
            return (
              <div key={section} className="mt-1">
                <button
                  type="button"
                  onClick={() => toggleSection(section)}
                  className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-ink-secondary hover:bg-raised/50 hover:text-ink"
                  aria-expanded={!collapsed}
                >
                  {collapsed ? <CaretRight size={12} weight="bold" /> : <CaretDown size={12} weight="bold" />}
                  <span className="min-w-0 flex-1 truncate">{section}</span>
                  <span className="font-mono text-[10px] tracking-normal">{bots.length}</span>
                </button>
                {!collapsed && bots.map((bot) => <BotListItem key={bot.id} bot={bot} onMenu={setMenu} />)}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-hairline/70 px-3 pb-[max(0.75rem,var(--safe-bottom))] pt-2">
        <SidebarUpdateCard />
        <button
          onClick={() => dispatch({ type: "showReviews" })}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors",
            state.activeView === "reviews" ? "bg-raised text-ink" : "text-ink hover:bg-raised/50",
          )}
        >
          <ClipboardText size={20} weight={state.activeView === "reviews" ? "fill" : "bold"} className={state.activeView === "reviews" ? "text-accent" : "text-ink-secondary"} />
          <span className="flex-1 text-[14px]">Review queue</span>
          {state.reviews.filter((item) => item.status === "pending").length > 0 && (
            <span className="rounded-full bg-accent px-1.5 py-0.5 font-mono text-[10px] font-semibold text-app">{state.reviews.filter((item) => item.status === "pending").length}</span>
          )}
        </button>
        <button
          onClick={() => dispatch({ type: "showWorkflows" })}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors",
            state.activeView === "workflows" ? "bg-raised text-ink" : "text-ink hover:bg-raised/50",
          )}
        >
          <TreeStructure size={20} weight={state.activeView === "workflows" ? "fill" : "bold"} className={state.activeView === "workflows" ? "text-accent" : "text-ink-secondary"} />
          <span className="flex-1 text-[14px]">Workflows</span>
          {state.workflows.some((workflow) => workflow.status === "active" || workflow.status === "blocked") && (
            <span className="size-2 rounded-full bg-accent" />
          )}
        </button>
        <button
          onClick={() => dispatch({ type: "showOrgChart" })}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors",
            state.activeView === "org" ? "bg-raised text-ink" : "text-ink hover:bg-raised/50",
          )}
        >
          <UsersThree size={20} weight={state.activeView === "org" ? "fill" : "bold"} className={state.activeView === "org" ? "text-accent" : "text-ink-secondary"} />
          <span className="flex-1 text-[14px]">Org chart</span>
        </button>
        <button
          onClick={() => dispatch({ type: "showRoutines" })}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors",
            state.activeView === "routines" ? "bg-raised text-ink" : "text-ink hover:bg-raised/50",
          )}
        >
          <CalendarDots size={20} weight={state.activeView === "routines" ? "fill" : "bold"} className={state.activeView === "routines" ? "text-accent" : "text-ink-secondary"} />
          <span className="flex-1 text-[14px]">Automations</span>
          {state.routineRuns.some((run) => ["failed", "missed"].includes(run.status) && !run.seenAt) && (
            <span className="size-2 rounded-full bg-danger" />
          )}
        </button>
        <button
          onClick={() => dispatch({ type: "togglePlugins", open: true })}
          className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-raised/50"
        >
          <PuzzlePiece size={20} weight="bold" className="text-ink-secondary" />
          <span className="text-[14px] text-ink">Plugins</span>
        </button>
        <div className="flex items-center">
          <button
            onClick={() => dispatch({ type: "toggleAppSettings" })}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-raised/50"
          >
            <InitialsAvatar initials={profileInitials(state.config?.profile)} size={28} />
            <span className="truncate text-[14px] text-ink">
              {state.config?.profile?.name?.trim() || state.config?.profile?.email?.trim() || "You"}
            </span>
          </button>
          <UpdateButton />
          <button
            onClick={() => dispatch({ type: "toggleAppSettings" })}
            className="flex size-10 items-center justify-center rounded-md text-ink-secondary hover:bg-raised hover:text-ink"
            title="App settings"
            aria-label="App settings"
          >
            <Gear size={18} weight="bold" />
          </button>
        </div>
      </div>

      {menu && <BotContextMenu menu={menu} onClose={() => setMenu(null)} />}
      {roomMenu && (
        <RoomContextMenu
          menu={roomMenu}
          onClose={() => setRoomMenu(null)}
        />
      )}
      {newRoom && <NewRoomPanel defaultProjectId={newRoomProjectId} onClose={() => { setNewRoom(false); setNewRoomProjectId(undefined); }} />}
      {newProject && <NewProjectPanel onClose={() => setNewProject(false)} />}
      {editProjectId && state.projects.find((project) => project.id === editProjectId) && (
        <ProjectSettingsPanel project={state.projects.find((project) => project.id === editProjectId)!} onClose={() => setEditProjectId(null)} />
      )}
      {exportTeamOpen && (
        <ExportTeamPanel
          returnFocusRef={importReturnRef}
          onClose={() => setExportTeamOpen(false)}
          onExported={(name) => {
            setExportTeamOpen(false);
            setTeamFeedback({ error: false, text: `${name} exported` });
          }}
        />
      )}
      {pendingImport && (
        <ImportTeamPanel
          pending={pendingImport}
          returnFocusRef={importReturnRef}
          onClose={() => setPendingImport(null)}
          onImported={(name) => {
            setPendingImport(null);
            setTeamFeedback({ error: false, text: `${name} imported` });
          }}
        />
      )}
      {teamFeedback &&
        createPortal(
          <div
            role="status"
            className={cn(
              "fixed bottom-4 left-4 z-[60] max-w-[300px] rounded-xl border px-3.5 py-2.5 text-[13px]",
              teamFeedback.error
                ? "border-danger/30 bg-card text-danger"
                : "border-hairline bg-card text-ink",
            )}
          >
            {teamFeedback.text}
          </div>,
          document.body,
        )}
    </aside>
  );
}
