import { useEffect, useRef, useState } from "react";
import { List } from "@phosphor-icons/react";
import { StoreProvider, useStore } from "@/state/store";
import { NoBots } from "@/components/NoBots";
import { Onboarding } from "@/components/Onboarding";
import { emailGateDone, initAnalytics } from "@/lib/analytics";
import { Sidebar } from "@/components/Sidebar";
import { ChatView } from "@/components/ChatView";
import { GroupView } from "@/components/GroupView";
import { SettingsPanel } from "@/components/SettingsPanel";
import { PluginsPanel } from "@/components/PluginsPanel";
import { ComputerPanel } from "@/components/ComputerPanel";
import { SettingsModal } from "@/components/SettingsModal";
import { DesktopCapabilitiesProvider } from "@/components/DesktopCapabilities";
import { RoutinesPage } from "@/components/RoutinesPage";
import { NoEngines } from "@/components/NoEngines";
import { BotDirectoryPanel } from "@/components/BotDirectoryPanel";

function Shell() {
  const { state, dispatch } = useStore();
  // Mobile-only drawer state. Above md, none of these properties are emitted
  // at all — Sidebar scopes every mobile class with max-md: rather than
  // cancelling them with md:, which would still emit a translate value and
  // turn the aside into a containing block for its fixed descendants (see
  // Sidebar.tsx's className comment).
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const group = state.groups.find((g) => g.id === state.selectedId);
  const bot = group ? undefined : (state.bots.find((b) => b.id === state.selectedId) ?? state.bots[0]);

  // Nothing on this machine can run a bot. Wait for the first /api/instances
  // response before deciding — an empty list means "not asked yet", and
  // flashing the setup screen at every launch would be worse than the bug.
  const noEngines =
    state.connected &&
    state.instances.length > 0 &&
    !state.instances.some(
      (i) => i.snapshot.state === "available" && i.snapshot.authenticated !== false,
    );

  // App-wide shortcuts: ⌘N new bot · ⌘1–9 jump to bot · ⌘⇧[ / ⌘⇧] prev/next.
  // Kept deliberately small; every panel already closes on Esc.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const bots = state.bots.filter((b) => !b.hidden);
      if (e.key === "n" && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: "newBot" });
      } else if (/^[1-9]$/.test(e.key)) {
        const target = bots[Number(e.key) - 1];
        if (target) {
          e.preventDefault();
          dispatch({ type: "select", id: target.id });
        }
      } else if (e.shiftKey && (e.key === "[" || e.key === "]")) {
        const idx = bots.findIndex((b) => b.id === state.selectedId);
        const next = bots[(idx + (e.key === "]" ? 1 : -1) + bots.length) % bots.length];
        if (next) {
          e.preventDefault();
          dispatch({ type: "select", id: next.id });
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.bots, state.selectedId, dispatch]);

  // Picking a conversation closes the drawer: on a phone the chat is what you
  // asked for, and leaving the list up would hide it. Watching activeView too
  // catches re-selecting the bot that is already current from another view —
  // the reducer switches the view without changing selectedId. pluginsOpen
  // and settingsOpen cover the same idea from a different trigger: close the
  // drawer whenever an action opens something over the chat.
  useEffect(() => {
    setDrawerOpen(false);
  }, [state.selectedId, state.activeView, state.pluginsOpen, state.settingsOpen]);

  return (
    <div className="flex h-full flex-col">
      <div className="relative flex min-h-0 flex-1">
      <button
        type="button"
        ref={menuButtonRef}
        aria-label="Open bot list"
        aria-expanded={drawerOpen}
        onClick={() => setDrawerOpen(true)}
        className="absolute left-3 top-3 z-30 flex size-11 items-center justify-center rounded-md text-ink-secondary hover:bg-raised hover:text-ink md:hidden"
      >
        <List size={18} weight="bold" />
      </button>
      {drawerOpen && (
        <div
          aria-hidden
          onMouseDown={(e) => e.target === e.currentTarget && setDrawerOpen(false)}
          className="absolute inset-0 z-30 bg-black/50 md:hidden"
        />
      )}
      <Sidebar
        open={drawerOpen}
        onOpenDirectory={() => setDirectoryOpen(true)}
        onClose={() => {
          setDrawerOpen(false);
          menuButtonRef.current?.focus();
        }}
      />
      {state.activeView === "routines" ? (
        <RoutinesPage />
      ) : noEngines ? (
        <NoEngines />
      ) : group ? (
        <GroupView key={group.id} group={group} />
      ) : bot ? (
        <ChatView bot={bot} />
      ) : (
        <NoBots />
      )}
      {state.settingsOpen && bot && <SettingsPanel bot={bot} />}
      {state.computerOpen && bot && <ComputerPanel bot={bot} />}
      {state.appSettingsOpen && <SettingsModal />}
      {state.pluginsOpen && <PluginsPanel />}
      {directoryOpen && <BotDirectoryPanel onClose={() => setDirectoryOpen(false)} />}
      </div>
    </div>
  );
}

/** Analytics starts only after the harness says it may, so it lives inside the
 * store rather than in App's mount effect — someone who turned it off must not
 * have PostHog loaded for the one render before the config lands. */
function AnalyticsGate() {
  const { state } = useStore();
  const enabled = state.config?.analytics?.enabled;
  useEffect(() => {
    if (enabled) initAnalytics(true);
  }, [enabled]);
  return null;
}

export default function App() {
  const [gated, setGated] = useState(() => !emailGateDone());
  return (
    <DesktopCapabilitiesProvider>
      <StoreProvider>
        <AnalyticsGate />
        <Shell />
        {gated && <Onboarding onDone={() => setGated(false)} />}
      </StoreProvider>
    </DesktopCapabilitiesProvider>
  );
}
