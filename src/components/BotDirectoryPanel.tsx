import { useEffect, useRef, useState } from "react";
import { Spin } from "./Spin";
import { ArrowLeft, ArrowRight, ArrowSquareOut, Check, MagnifyingGlass, Plus, Robot, X } from "@phosphor-icons/react";
import { api, useStore, type Bot, type Group } from "@/state/store";
import { cn } from "@/lib/cn";
import { CREW_TEMPLATES, crewManifest, type CrewTemplate } from "@/lib/crew-templates";
import { track } from "@/lib/analytics";

interface DirectorySource {
  kind: string;
  url: string;
}

interface DirectoryBot {
  slug: string;
  name: string;
  category: string;
  integrations: string[];
  prompt: string;
  contributor: string;
  detailUrl: string;
  /** ISO timestamp. Optional: the directory has not always sent one. */
  addedAt?: string | null;
  sources?: DirectorySource[];
}

/** The directory's own date, shown as the reader's date. An unparseable value
 * is not worth a broken line in the UI — drop it instead. */
function addedOn(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString();
}

interface DirectoryResponse {
  bots: DirectoryBot[];
  pagination: { page: number; total: number; totalPages: number; hasNext: boolean; hasPrevious: boolean };
}

export function BotDirectoryPanel({ onClose }: { onClose: () => void }) {
  const { dispatch } = useStore();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<DirectoryResponse | null>(null);
  const [selected, setSelected] = useState<DirectoryBot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState<string | null>(null);
  const [imported, setImported] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setLoading(true);
      setError(null);
    });
    const params = new URLSearchParams({ page: String(page), limit: "24", sort: "name" });
    if (submittedQuery) params.set("q", submittedQuery);
    api(`/api/bot-directory?${params}`, { signal: controller.signal })
      .then((data: DirectoryResponse) => {
        if (!active) return;
        setResult(data);
        setSelected((current) => data.bots.find((bot) => bot.slug === current?.slug) ?? data.bots[0] ?? null);
      })
      .catch((cause) => {
        if (active && cause?.name !== "AbortError") setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
      controller.abort();
    };
  }, [page, submittedQuery]);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.querySelector<HTMLElement>("input")?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [onClose]);

  /** A whole crew at once: several bots, plus the room they work in. Goes in
   * through the same import endpoint a shared team file uses, so what lands
   * is editable and re-exportable rather than a special built-in. */
  const importCrew = async (template: CrewTemplate) => {
    setImporting(`crew:${template.id}`);
    setError(null);
    try {
      const response = (await api("/api/teams/import", {
        method: "POST",
        body: JSON.stringify(crewManifest(template)),
      })) as { bots: Bot[]; group: Group };
      for (const bot of response.bots) dispatch({ type: "botAdded", bot });
      dispatch({ type: "groupPatched", group: response.group });
      track("team_imported", { members: response.bots.length });
      dispatch({ type: "select", id: response.group.id });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setImporting(null);
    }
  };

  const importBot = async (entry: DirectoryBot) => {
    setImporting(entry.slug);
    setError(null);
    let createdId: string | null = null;
    try {
      const created = await api("/api/bots", { method: "POST" });
      createdId = created.bot.id;
      const description = [
        entry.prompt,
        entry.integrations.length ? `Suggested connected apps: ${entry.integrations.join(", ")}.` : "",
        `Template source: ${entry.detailUrl}`,
      ].filter(Boolean).join("\n\n");
      const patched = await api(`/api/bots/${created.bot.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: entry.name, title: entry.category || "Directory bot", description }),
      });
      dispatch({ type: "botAdded", bot: { ...created.bot, ...patched.bot, messages: [] } as Bot });
      setImported(entry.slug);
      window.setTimeout(() => setImported((slug) => slug === entry.slug ? null : slug), 2500);
    } catch (cause) {
      if (createdId) await api(`/api/bots/${createdId}`, { method: "DELETE" }).catch(() => {});
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setImporting(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm max-md:p-0 md:p-5" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="directory-title" className="animate-pop-in flex h-[min(820px,calc(100dvh-1.5rem))] w-full max-w-[980px] flex-col overflow-hidden rounded-xl border border-hairline bg-panel max-md:h-full max-md:rounded-none max-md:pb-[var(--safe-bottom)] max-md:pt-[env(safe-area-inset-top)]">
        <header className="flex items-start justify-between gap-4 border-b border-hairline px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <Robot size={20} weight="fill" className="text-accent" />
              <h1 id="directory-title" className="text-[18px] font-semibold text-ink">Ready-made bots</h1>
            </div>
            <p className="mt-1 text-[13px] text-ink-secondary">Live templates from botdirectory.ai. Review the instructions, then add one to your team.</p>
          </div>
          <button onClick={onClose} aria-label="Close bot directory" className="rounded-md p-1.5 text-ink-secondary hover:bg-raised hover:text-ink"><X size={18} weight="bold" /></button>
        </header>

        <section className="border-b border-hairline px-5 py-3">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h2 className="font-mono text-[11px] uppercase tracking-wider text-ink-secondary">Ready-made crews</h2>
            <span className="text-[11.5px] text-ink-secondary">A whole team and its room, in one click</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {CREW_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                disabled={Boolean(importing)}
                onClick={() => void importCrew(template)}
                title={template.blurb}
                className="flex min-w-[190px] flex-1 items-start gap-2 rounded-xl border border-hairline bg-card px-3 py-2 text-left hover:border-accent/50 disabled:opacity-40"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-ink">{template.label}</div>
                  <div className="mt-0.5 line-clamp-2 text-[11.5px] leading-4 text-ink-secondary">{template.blurb}</div>
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-wide text-ink-secondary">
                    {template.members.length} {template.members.length === 1 ? "bot" : "bots"}
                  </div>
                </div>
                {importing === `crew:${template.id}` ? <Spin size={14} weight="fill" className="mt-1" /> : <Plus size={14} weight="bold" className="mt-1 shrink-0 text-ink-secondary" />}
              </button>
            ))}
          </div>
        </section>

        <form className="border-b border-hairline px-5 py-3" onSubmit={(event) => { event.preventDefault(); setPage(1); setSubmittedQuery(query.trim()); }}>
          <div className="flex items-center gap-2 rounded-lg border border-hairline bg-inset px-3 py-2">
            <MagnifyingGlass size={16} weight="bold" className="text-ink-secondary" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search bots, categories, prompts, or integrations" className="min-w-0 flex-1 bg-transparent text-[14px] text-ink placeholder:text-ink-secondary focus:outline-none" />
            {query && <button type="button" onClick={() => { setQuery(""); setSubmittedQuery(""); setPage(1); }} className="text-[12px] text-ink-secondary hover:text-ink">Clear</button>}
          </div>
        </form>

        {error && <div className="mx-5 mt-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] text-danger">{error}</div>}
        <div className="grid min-h-0 flex-1 md:grid-cols-[360px_minmax(0,1fr)]">
          <section className="min-h-0 overflow-y-auto border-b border-hairline md:border-b-0 md:border-r">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-[13px] text-ink-secondary"><Spin size={15} weight="fill" /> Loading directory...</div>
            ) : result?.bots.length ? result.bots.map((bot) => (
              // Row and add button are siblings, not nested: a button inside a
              // button is invalid, and the add action must be reachable without
              // reading the detail pane first.
              <div key={bot.slug} className={cn("flex items-start gap-2 border-b border-hairline pr-3", selected?.slug === bot.slug ? "bg-raised" : "bg-card hover:bg-raised/60")}>
                <button onClick={() => setSelected(bot)} aria-current={selected?.slug === bot.slug} className="min-w-0 flex-1 py-3 pl-4 text-left">
                  <div className="flex items-start justify-between gap-3"><span className="text-[14px] font-semibold text-ink">{bot.name}</span><span className="shrink-0 rounded-full bg-inset px-2 py-0.5 font-mono text-[10px] text-ink-secondary">{bot.category}</span></div>
                  <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-ink-secondary">{bot.prompt}</p>
                  {bot.integrations.length > 0 && <div className="mt-2 truncate text-[11px] text-accent">{bot.integrations.join(" · ")}</div>}
                </button>
                <button
                  type="button"
                  disabled={Boolean(importing)}
                  onClick={() => void importBot(bot)}
                  title={`Add ${bot.name} to my bots`}
                  aria-label={`Add ${bot.name} to my bots`}
                  className="mt-3 flex size-8 shrink-0 items-center justify-center rounded-lg border border-hairline bg-panel text-ink-secondary hover:border-accent/50 hover:text-accent disabled:opacity-40"
                >
                  {importing === bot.slug ? <Spin size={13} weight="fill" /> : imported === bot.slug ? <Check size={14} weight="bold" className="text-accent" /> : <Plus size={15} weight="bold" />}
                </button>
              </div>
            )) : <div className="py-12 text-center text-[13px] text-ink-secondary">No templates found.</div>}
          </section>

          <section className="min-h-0 overflow-y-auto bg-card p-5">
            {selected ? <div className="mx-auto max-w-[560px]">
              <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-raised px-2.5 py-1 text-[11px] font-medium text-ink-secondary">{selected.category}</span><span className="text-[11px] text-ink-secondary">by @{selected.contributor}</span>{addedOn(selected.addedAt) && <span className="text-[11px] text-ink-secondary">· added {addedOn(selected.addedAt)}</span>}</div>
              <h2 className="mt-3 text-[22px] font-semibold text-ink">{selected.name}</h2>
              <h3 className="mt-5 font-mono text-[11px] uppercase tracking-wider text-ink-secondary">Bot instructions</h3>
              <div className="mt-2 whitespace-pre-wrap rounded-xl border border-hairline bg-inset p-4 text-[13px] leading-6 text-ink">{selected.prompt}</div>
              <h3 className="mt-5 font-mono text-[11px] uppercase tracking-wider text-ink-secondary">Suggested apps</h3>
              <div className="mt-2 flex flex-wrap gap-2">{selected.integrations.length ? selected.integrations.map((item) => <span key={item} className="rounded-lg border border-hairline bg-panel px-2.5 py-1.5 text-[12px] text-ink">{item}</span>) : <span className="text-[13px] text-ink-secondary">No connected apps required.</span>}</div>
              {selected.sources && selected.sources.length > 0 && <>
                <h3 className="mt-5 font-mono text-[11px] uppercase tracking-wider text-ink-secondary">Where it came from</h3>
                <div className="mt-2 flex flex-wrap gap-2">{selected.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-lg border border-hairline bg-panel px-2.5 py-1.5 text-[12px] text-ink hover:border-accent/50">{source.kind} <ArrowSquareOut size={12} weight="bold" className="text-ink-secondary" /></a>)}</div>
              </>}
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button disabled={Boolean(importing)} onClick={() => void importBot(selected)} className="flex min-w-[150px] items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-60">{importing === selected.slug ? <><Spin size={14} weight="fill" /> Adding...</> : imported === selected.slug ? <><Check size={15} weight="bold" /> Added</> : "Add to my bots"}</button>
                <a href={selected.detailUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[12px] text-ink-secondary hover:text-ink">View source <ArrowSquareOut size={13} weight="bold" /></a>
              </div>
              <p className="mt-3 text-[12px] leading-5 text-ink-secondary">The template becomes this bot's persistent instructions. Connect any suggested apps separately from Plugins.</p>
            </div> : <div className="flex h-full items-center justify-center text-[13px] text-ink-secondary">Select a bot template.</div>}
          </section>
        </div>

        <footer className="flex items-center justify-between border-t border-hairline px-5 py-3 text-[12px] text-ink-secondary">
          <span>{result ? `${result.pagination.total} templates · Page ${result.pagination.page} of ${result.pagination.totalPages}` : "botdirectory.ai"}</span>
          <div className="flex gap-1"><button disabled={!result?.pagination.hasPrevious || loading} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-md p-1.5 hover:bg-raised disabled:opacity-30" aria-label="Previous page"><ArrowLeft size={16} weight="bold" /></button><button disabled={!result?.pagination.hasNext || loading} onClick={() => setPage((value) => value + 1)} className="rounded-md p-1.5 hover:bg-raised disabled:opacity-30" aria-label="Next page"><ArrowRight size={16} weight="bold" /></button></div>
        </footer>
      </div>
    </div>
  );
}
