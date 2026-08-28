// Connected apps marketplace, backed by Composio Sessions. Catalog comes
// from /api/connectors/catalog — the full toolkit list with logos when a
// Composio API key is configured, a curated set otherwise. Icons resolve
// logo → favicon → monogram.
import { useCallback, useEffect, useRef, useState } from "react";
import { Spin } from "./Spin";
import { ArrowClockwise, ArrowSquareOut, Check, Copy, X } from "@phosphor-icons/react";
import { api, useStore } from "@/state/store";
import { cn } from "@/lib/cn";

const COMPOSIO_OAUTH_CALLBACK_URL = "https://backend.composio.dev/api/v3.1/toolkits/auth/callback";
const COMPOSIO_AUTH_CONFIGS_URL = "https://dashboard.composio.dev";
const X_DEVELOPER_CONSOLE_URL = "https://developer.x.com/en/portal/dashboard";

function needsCustomOAuthSetup(slug: string, message: string): boolean {
  return ["twitter", "x", "x-twitter"].includes(slug.trim().toLowerCase())
    && /custom OAuth Auth Config|does not manage auth|auth_config_override/i.test(message);
}

interface ToolkitCard {
  slug: string;
  label: string;
  blurb: string;
  logo: string | null;
  domain: string | null;
}

function ServiceIcon({ card }: { card: ToolkitCard }) {
  // The logo comes from the harness, not from Composio's CDN or Google's
  // favicon service. Two reasons: the app keeps an `img-src 'self'` CSP, and
  // browsing this list used to tell Google which apps you were looking at.
  // Server-side it is still logo → favicon → nothing; here it is just
  // picture-or-monogram.
  const [broken, setBroken] = useState(false);
  if (!broken && (card.logo || card.domain)) {
    return (
      <img
        src={`/api/connectors/${encodeURIComponent(card.slug)}/logo`}
        alt=""
        className="size-8 rounded-md"
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <div className="flex size-8 items-center justify-center rounded-md bg-raised text-[13px] font-semibold text-ink-secondary">
      {card.label.slice(0, 1).toUpperCase()}
    </div>
  );
}

export function PluginsPanel() {
  const { dispatch } = useStore();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [cards, setCards] = useState<ToolkitCard[] | null>(null);
  const [source, setSource] = useState<"api" | "curated">("curated");
  const [configured, setConfigured] = useState(true);
  const [status, setStatus] = useState<Record<string, { connected: boolean }>>({});
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupSlug, setSetupSlug] = useState<string | null>(null);
  const [callbackCopied, setCallbackCopied] = useState(false);
  const [search, setSearch] = useState("");

  const refreshStatus = useCallback((slugs: string[]): Promise<Record<string, { connected: boolean }>> => {
    if (!slugs.length) return Promise.resolve({});
    setRefreshing(true);
    return api(`/api/connectors?services=${slugs.join(",")}`)
      .then((r) => {
        const services: Record<string, { connected: boolean }> = r.services ?? {};
        setStatus(services);
        return services;
      })
      .catch(() => ({}))
      .finally(() => setRefreshing(false));
  }, []);

  useEffect(() => {
    let alive = true;
    api("/api/connectors/catalog")
      .then((r) => {
        if (!alive) return;
        setCards(r.cards ?? []);
        setSource(r.source ?? "curated");
        setConfigured(Boolean(r.configured));
        if (r.configured) void refreshStatus((r.cards ?? []).map((c: ToolkitCard) => c.slug).slice(0, 40));
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [refreshStatus]);

  useEffect(() => {
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );

    (dialog?.querySelector<HTMLElement>("input") ?? focusable()[0] ?? dialog)?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dispatch({ type: "togglePlugins", open: false });
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const items = focusable();
      if (items.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = items[0];
      const last = items.at(-1)!;
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      returnFocus?.focus();
    };
  }, [dispatch]);

  const connect = (slug: string) => {
    setBusySlug(slug);
    setError(null);
    setSetupSlug(null);
    api(`/api/connectors/${slug}/authorize`, { method: "POST" })
      .then(({ url }) => {
        window.open(url);
        // the user finishes OAuth in the browser; poll a few times to catch it.
        // check the freshly-fetched result, not the `status` captured in this
        // closure — that snapshot never updates, so it would always poll 6×
        let tries = 0;
        const timer = setInterval(() => {
          void refreshStatus([slug]).then((s) => {
            if (++tries >= 6 || s[slug]?.connected) clearInterval(timer);
          });
        }, 5000);
      })
      .catch((e) => {
        const message = e instanceof Error ? e.message : String(e);
        setError(message);
        if (needsCustomOAuthSetup(slug, message)) setSetupSlug(slug);
      })
      .finally(() => setBusySlug(null));
  };

  const copyCallbackUrl = () => {
    navigator.clipboard.writeText(COMPOSIO_OAUTH_CALLBACK_URL)
      .then(() => {
        setCallbackCopied(true);
        window.setTimeout(() => setCallbackCopied(false), 2000);
      })
      .catch(() => setCallbackCopied(false));
  };

  const disconnect = (slug: string) => {
    setBusySlug(slug);
    api(`/api/connectors/${slug}`, { method: "DELETE" })
      .then(() => refreshStatus([slug]))
      .catch((e) => setError(e.message))
      .finally(() => setBusySlug(null));
  };

  const visible = (cards ?? []).filter(
    (c) => !search || `${c.label} ${c.slug} ${c.blurb}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    // Click-outside-to-close is a pointer shortcut for this dialog's real
    // dismissal, which is Escape (keydown listener above). The backdrop is not
    // a control, so it stays unfocusable — and it must NOT get aria-hidden
    // either: the dialog is its child, so that would hide the whole modal from
    // assistive tech, which is far worse than the warning being silenced here.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-[2px] max-md:p-0 md:p-6"
      onClick={() => dispatch({ type: "togglePlugins", open: false })}
    >
      {/* stopPropagation keeps a click inside the dialog from reaching the
          backdrop's close handler. Event plumbing, not a control — the dialog
          itself is reached by focus, not by clicking this element. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="connected-apps-title"
        tabIndex={-1}
        className="animate-pop-in flex h-[calc(100dvh-3rem)] w-full max-w-[1100px] flex-col overflow-hidden rounded-2xl border border-hairline bg-panel p-8 shadow-[0_24px_80px_rgba(0,0,0,0.55)] max-md:h-full max-md:rounded-none max-md:px-4 max-md:pb-[max(1rem,env(safe-area-inset-bottom))] max-md:pt-[max(1rem,env(safe-area-inset-top))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div id="connected-apps-title" className="text-[18px] font-semibold text-ink">Plugins</div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => refreshStatus(visible.map((c) => c.slug).slice(0, 40))}
              className="rounded-md p-1 text-ink-secondary hover:bg-raised hover:text-ink"
              title="Refresh connection status"
            >
              <ArrowClockwise size={15} weight="bold" className={cn(refreshing && "maus-spin")} />
            </button>
            <button
              onClick={() => dispatch({ type: "togglePlugins", open: false })}
              aria-label="Close connected apps"
              className="rounded-md p-1 text-ink-secondary hover:bg-raised hover:text-ink"
            >
              <X size={18} weight="bold" />
            </button>
          </div>
        </div>
        <div className="mt-1 text-[13px] text-ink-secondary">
          Apps and services your bots can use through Composio.
        </div>

        {!configured && (
          <div className="mt-3 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-[13px] text-warning">
            Connect your own Composio project first —{" "}
            <button
              className="underline"
              onClick={() => {
                dispatch({ type: "togglePlugins", open: false });
                dispatch({ type: "toggleAppSettings", open: true });
              }}
            >
              add a project key in App Settings
            </button>{" "}
            to connect apps.
          </div>
        )}
        {configured && source === "curated" && (
          <div className="mt-3 text-[12px] text-ink-secondary">
            Showing a curated set.{" "}
            <button
              className="underline hover:text-ink"
              onClick={() => {
                dispatch({ type: "togglePlugins", open: false });
                dispatch({ type: "toggleAppSettings", open: true });
              }}
            >
              Add a Composio API key
            </button>{" "}
            to browse the full catalog.
          </div>
        )}
        {error && !setupSlug && (
          <div className="mt-2 rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-[12px] leading-relaxed text-danger">
            {error}
          </div>
        )}
        {error && setupSlug && (
          <div className="mt-3 rounded-xl border border-warning/30 bg-warning/10 p-4 text-[12px] leading-relaxed text-ink">
            <div className="text-[14px] font-semibold">X OAuth setup required</div>
            <p className="mt-1 text-ink-secondary">
              X does not provide Composio-managed OAuth. Create one X developer app and one Twitter Auth Config
              in the same Composio project as your saved project key.
            </p>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-ink-secondary">
              <li>
                Open the X Developer Console, create or select an app, and enable OAuth 2.0. Use a confidential
                web app so X provides a Client ID and Client Secret.
              </li>
              <li>
                Add this exact callback URI to the X app:
                <div className="mt-1 flex min-w-0 items-center gap-2 rounded-lg border border-hairline bg-inset px-2.5 py-2">
                  <code className="min-w-0 flex-1 break-all text-[11px] text-ink">{COMPOSIO_OAUTH_CALLBACK_URL}</code>
                  <button
                    type="button"
                    onClick={copyCallbackUrl}
                    className="shrink-0 rounded-md p-1 text-ink-secondary hover:bg-raised hover:text-ink"
                    aria-label="Copy Composio callback URL"
                    title="Copy callback URL"
                  >
                    {callbackCopied ? <Check size={15} weight="bold" /> : <Copy size={15} weight="bold" />}
                  </button>
                </div>
              </li>
              <li>
                In Composio, create an Auth Config for <strong className="text-ink">Twitter</strong>, choose
                <strong className="text-ink"> OAuth2</strong>, enable your own developer credentials, then enter
                the X Client ID and Client Secret.
              </li>
              <li>Return here and choose Retry. MausCrew will find the enabled Auth Config automatically.</li>
            </ol>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={X_DEVELOPER_CONSOLE_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-raised px-3 py-2 font-medium text-ink hover:bg-raised-hover"
              >
                X Developer Console <ArrowSquareOut size={13} weight="bold" />
              </a>
              <a
                href={COMPOSIO_AUTH_CONFIGS_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-raised px-3 py-2 font-medium text-ink hover:bg-raised-hover"
              >
                Composio Auth Configs <ArrowSquareOut size={13} weight="bold" />
              </a>
              <button
                type="button"
                onClick={() => connect(setupSlug)}
                disabled={busySlug === setupSlug}
                className="rounded-lg bg-accent px-3 py-2 font-semibold text-app hover:brightness-110 disabled:opacity-50"
              >
                {busySlug === setupSlug ? "Checking…" : "Retry X connection"}
              </button>
            </div>
          </div>
        )}

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search apps"
          placeholder="Search apps"
          className="mt-5 w-full rounded-xl border border-hairline bg-inset px-3.5 py-2.5 text-[13px] text-ink placeholder:text-ink-secondary focus:border-ink-secondary/60 focus:outline-none"
        />

        <div className="mt-4 grid min-h-0 flex-1 grid-cols-1 content-start gap-2 overflow-y-auto md:grid-cols-2">
          {cards === null ? (
            <div className="flex items-center justify-center gap-2 py-8 text-[13px] text-ink-secondary">
              <Spin size={14} weight="fill" /> Loading catalog…
            </div>
          ) : (
            visible.map((card) => {
              const connected = status[card.slug]?.connected;
              const busy = busySlug === card.slug;
              return (
                <div
                  key={card.slug}
                  className="flex items-center gap-3 rounded-xl bg-card px-4 py-3 hover:bg-raised/45"
                >
                  <ServiceIcon card={card} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[14px] font-medium text-ink">
                      {card.label}
                      {connected && <span className="size-1.5 rounded-full bg-success" />}
                    </div>
                    <div className="truncate text-[12px] text-ink-secondary">{card.blurb}</div>
                  </div>
                  <button
                    disabled={!configured || busy}
                    onClick={() => (connected ? disconnect(card.slug) : connect(card.slug))}
                    className={cn(
                      "w-[92px] rounded-lg py-1.5 text-[13px] disabled:opacity-50",
                      connected
                        ? "bg-raised text-ink-secondary hover:text-danger"
                        : "bg-raised text-ink hover:bg-raised-hover",
                    )}
                  >
                    {busy ? (
                      <Spin size={13} weight="fill" className="mx-auto" />
                    ) : connected ? (
                      "Disconnect"
                    ) : (
                      "Connect"
                    )}
                  </button>
                </div>
              );
            })
          )}
          {cards !== null && visible.length === 0 && (
            <div className="py-8 text-center text-[13px] text-ink-secondary">No apps match.</div>
          )}
        </div>
      </div>
    </div>
  );
}
