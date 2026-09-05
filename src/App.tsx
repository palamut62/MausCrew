import { RecoveryNotice } from "./components/RecoveryNotice";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { List } from "@phosphor-icons/react";
import { StoreProvider, useStore } from "@/state/store";
import { NoBots } from "@/components/NoBots";
import { emailGateDone, initAnalytics } from "@/lib/analytics";
import { Sidebar } from "@/components/Sidebar";
import { ChatView } from "@/components/ChatView";
import { DesktopCapabilitiesProvider } from "@/components/DesktopCapabilities";
import { NoEngines } from "@/components/NoEngines";
import { useDeepLinkBotImport } from "@/lib/deep-link";
import { waitingBots } from "@/lib/tray";
import { useMediaQuery } from "@/lib/use-media";
import { MobileShell } from "@/components/MobileShell";

// Chat is the launch path; secondary workspaces and modal surfaces are loaded
// only when opened. Keeping them out of the startup chunk removes hundreds of
// kilobytes from every ordinary launch without changing any route or state.
const GroupView = lazy(() => import("@/components/GroupView").then((m) => ({ default: m.GroupView })));
const SettingsPanel = lazy(() => import("@/components/SettingsPanel").then((m) => ({ default: m.SettingsPanel })));
const PluginsPanel = lazy(() => import("@/components/PluginsPanel").then((m) => ({ default: m.PluginsPanel })));
const ComputerPanel = lazy(() => import("@/components/ComputerPanel").then((m) => ({ default: m.ComputerPanel })));
const SettingsModal = lazy(() => import("@/components/SettingsModal").then((m) => ({ default: m.SettingsModal })));
const RoutinesPage = lazy(() => import("@/components/RoutinesPage").then((m) => ({ default: m.RoutinesPage })));
const BotDirectoryPanel = lazy(() => import("@/components/BotDirectoryPanel").then((m) => ({ default: m.BotDirectoryPanel })));
const ReviewQueuePage = lazy(() => import("@/components/ReviewQueuePage").then((m) => ({ default: m.ReviewQueuePage })));
const WorkflowsPage = lazy(() => import("@/components/WorkflowsPage").then((m) => ({ default: m.WorkflowsPage })));
const OrgChartPage = lazy(() => import("@/components/OrgChartPage").then((m) => ({ default: m.OrgChartPage })));
const ImportBotDialog = lazy(() => import("@/components/ImportBotDialog").then((m) => ({ default: m.ImportBotDialog })));
const Onboarding = lazy(() => import("@/components/Onboarding").then((m) => ({ default: m.Onboarding })));

function Shell() {
  const { state, dispatch } = useStore();
  const compactScreen = useMediaQuery("(max-width: 767px)");
  const mobile = compactScreen && !window.mauscrew;
  // Mobile-only drawer state. Above md, none of these properties are emitted
  // at all — Sidebar scopes every mobile class with max-md: rather than
  // cancelling them with md:, which would still emit a translate value and
  // turn the aside into a containing block for its fixed descendants (see
  // Sidebar.tsx's className comment).
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [deepLinkBot, clearDeepLinkBot] = useDeepLinkBotImport();
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
    queueMicrotask(() => setDrawerOpen(false));
  }, [state.selectedId, state.activeView, state.pluginsOpen, state.settingsOpen]);

  if ((state.loading || state.loadError) && !state.bots.length) return <div className="flex h-full flex-col items-center justify-center gap-4 bg-app p-6 text-ink"><p role={state.loadError ? "alert" : "status"}>{state.loadError ? `Uygulama verileri yüklenemedi: ${state.loadError}` : "Veriler yükleniyor…"}</p><button className="rounded border border-hairline p-3" onClick={() => window.dispatchEvent(new Event("mauscrew:retry-load"))}>Tekrar dene</button><button onClick={() => dispatch({ type: "toggleAppSettings", open: true, section: "recovery" })}>Kurtarma merkezi</button><Suspense>{state.appSettingsOpen && <SettingsModal />}</Suspense></div>;

  if (mobile) return (
    <Suspense fallback={<div className="p-5 text-ink-secondary">Yükleniyor…</div>}>
      <MobileShell onBrowseDirectory={() => setDirectoryOpen(true)}>
        {state.activeView === "routines" ? <RoutinesPage />
          : state.activeView === "reviews" ? <ReviewQueuePage />
          : state.activeView === "workflows" ? <WorkflowsPage />
          : state.activeView === "org" ? <OrgChartPage />
          : noEngines ? <NoEngines />
          : group ? <GroupView key={group.id} group={group} />
          : bot ? <ChatView bot={bot} />
          : <NoBots onBrowseDirectory={() => setDirectoryOpen(true)} />}
      </MobileShell>
      {state.settingsOpen && bot && <SettingsPanel bot={bot} />}
      {state.computerOpen && bot && <ComputerPanel bot={bot} />}
      {state.appSettingsOpen && <SettingsModal />}
      {state.pluginsOpen && <PluginsPanel />}
      {directoryOpen && <BotDirectoryPanel onClose={() => setDirectoryOpen(false)} />}
      {deepLinkBot && <ImportBotDialog bot={deepLinkBot} onClose={clearDeepLinkBot} />}
    </Suspense>
  );

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
      <Suspense fallback={<div className="flex min-w-0 flex-1 items-center justify-center text-sm text-ink-secondary">Loading…</div>}>
        {state.activeView === "routines" ? (
          <RoutinesPage />
        ) : state.activeView === "reviews" ? (
          <ReviewQueuePage />
        ) : state.activeView === "workflows" ? (
          <WorkflowsPage />
        ) : state.activeView === "org" ? (
          <OrgChartPage />
        ) : noEngines ? (
          <NoEngines />
        ) : group ? (
          <GroupView key={group.id} group={group} />
        ) : bot ? (
          <ChatView bot={bot} />
        ) : (
          <NoBots onBrowseDirectory={() => setDirectoryOpen(true)} />
        )}
        {state.settingsOpen && bot && <SettingsPanel bot={bot} />}
        {state.computerOpen && bot && <ComputerPanel bot={bot} />}
        {state.appSettingsOpen && <SettingsModal />}
        {state.pluginsOpen && <PluginsPanel />}
        {directoryOpen && <BotDirectoryPanel onClose={() => setDirectoryOpen(false)} />}
        {deepLinkBot && <ImportBotDialog bot={deepLinkBot} onClose={clearDeepLinkBot} />}
      </Suspense>
      </div>
    </div>
  );
}

/** Keeps the tray in step with who is blocked on the user, and opens the bot
 * chosen from its menu. Browser builds have no `window.mauscrew`, so both
 * halves no-op there rather than being conditionally imported. */
function TrayBridge() {
  const { state, dispatch } = useStore();
  const waiting = waitingBots(state.bots);
  // The list is small and its identity changes every render, so the effect is
  // keyed on the content instead — otherwise every incoming token would push
  // an identical menu to the main process.
  const fingerprint = waiting.map((bot) => `${bot.id}:${bot.kind}`).join(",");
  useEffect(() => {
    window.mauscrew?.setTrayStatus?.(waiting);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the fingerprint above
  }, [fingerprint]);
  useEffect(() => window.mauscrew?.onTraySelectBot?.((botId) => dispatch({ type: "select", id: botId })), [dispatch]);
  return null;
}

/** Analytics starts only after the harness says it may, so it lives inside the
 * store rather than in App's mount effect — someone who turned it off must not
 * have PostHog loaded for the one render before the config lands. */
function AnalyticsGate() {
  const { state } = useStore();
  const enabled = state.config?.analytics?.enabled;
  useEffect(() => {
    void initAnalytics(enabled === true).catch(() => {});
  }, [enabled]);
  return null;
}

export default function App() {
  const [gated, setGated] = useState(() => !emailGateDone());
  return (
    <DesktopCapabilitiesProvider>
      <StoreProvider>
        <AnalyticsGate />
        <TrayBridge />
        <Shell />
        <RecoveryNotice />
        <Suspense fallback={null}>
          {gated && <Onboarding onDone={() => setGated(false)} />}
        </Suspense>
      </StoreProvider>
    </DesktopCapabilitiesProvider>
  );
}
