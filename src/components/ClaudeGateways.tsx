// Claude gateways: the endpoints the `claude` CLI talks to instead of
// api.anthropic.com. The CLI speaks to one endpoint per process, so each
// gateway is a separate engine in the picker rather than a mode of the Claude
// one — DeepSeek and OpenRouter are not alternatives to each other, and
// neither replaces the plain claude.ai sign-in. Hence a list, not one form.
import { useState } from "react";
import { Check, Spinner, Warning } from "@phosphor-icons/react";
import { api, useStore, type ConfigStatus } from "@/state/store";

/** Starting points for the endpoints people actually use. Model ids are
 * seeded because a gateway with none offers Claude ids it will reject. */
const PRESETS: { id: string; label: string; baseUrl: string; models: string }[] = [
  {
    id: "deepseek",
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/anthropic",
    models: "deepseek-v4-pro, deepseek-v4-flash",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    // Not /api/v1: the CLI appends `/v1/messages` to whatever this names, so
    // pasting OpenRouter's OpenAI base here asks for /api/v1/v1/messages and
    // every turn 404s.
    baseUrl: "https://openrouter.ai/api",
    models: "anthropic/claude-sonnet-5, deepseek/deepseek-v4-pro",
  },
  { id: "kimi", label: "Kimi", baseUrl: "https://api.moonshot.ai/anthropic", models: "kimi-k2-turbo" },
  { id: "local", label: "Local proxy", baseUrl: "http://127.0.0.1:8317", models: "" },
];

interface GatewayDraft {
  id: string;
  label: string;
  baseUrl: string;
  models: string;
  /** null = leave the stored token alone; "" = clear it. */
  token: string | null;
  configured: boolean;
}

/** Endpoints that serve many vendors and therefore namespace their model ids
 * (`deepseek/deepseek-v4-pro`). A vendor's own endpoint serves bare ones. The
 * two conventions look interchangeable and are not: the wrong one is accepted
 * by this form, saved, and then rejected by every single turn. */
const AGGREGATORS = /(^|\.)(openrouter\.ai|llmgateway\.io|together\.xyz)$/i;

const hostOf = (url: string): string => {
  try {
    return new URL(url.trim()).hostname;
  } catch {
    return "";
  }
};

/** What is wrong with this row's model ids, in one sentence, or null. Advice
 * rather than a block: an unknown proxy may well accept either convention, and
 * only the operator knows. */
function modelIdWarning(baseUrl: string, models: string): string | null {
  const host = hostOf(baseUrl);
  if (!host) return null;
  const ids = models
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  if (!ids.length) return null;
  if (AGGREGATORS.test(host)) {
    const bare = ids.filter((id) => !id.includes("/"));
    return bare.length ? `${host} namespaces model ids by vendor — ${bare.join(", ")} needs a "vendor/" prefix.` : null;
  }
  // A vendor endpoint answers a namespaced id with "the supported API model
  // names are deepseek-v4-pro, deepseek-v4-flash, …".
  const namespaced = ids.filter((id) => id.includes("/"));
  if (!namespaced.length) return null;
  const bare = namespaced[0].split("/").slice(1).join("/");
  return `${host} serves bare model ids. ${namespaced.join(", ")} is OpenRouter naming — drop the prefix ("${bare}").`;
}

/** The CLI appends `/v1/messages` itself, so a base URL that already ends in a
 * version segment produces `/v1/v1/messages` and 404s on every turn. */
function baseUrlWarning(baseUrl: string): string | null {
  const url = baseUrl.trim();
  if (!url || !hostOf(url) || !/\/v\d+\/?$/.test(url)) return null;
  return `The Claude CLI adds /v1/messages itself — a base URL ending in /v1 becomes /v1/v1/messages. Try ${url.replace(/\/v\d+\/?$/, "")}.`;
}

const trimmedUrl = (url: string) => url.trim();
const isLoopback = (url: string) => /^https?:\/\/(localhost|127\.0\.0\.1)\b/i.test(trimmedUrl(url));
const isRemote = (url: string) => Boolean(trimmedUrl(url)) && !isLoopback(url);
const isPlaintext = (url: string) => /^http:\/\//i.test(trimmedUrl(url)) && !isLoopback(url);

export function ClaudeGateways() {
  const { state, dispatch, refreshInstances } = useStore();
  const saved = state.config?.claudeGateways;
  // null means "showing what is saved" — a draft exists only once edited, so
  // a config refresh cannot overwrite half-typed input.
  const [draft, setDraft] = useState<GatewayDraft[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows: GatewayDraft[] =
    draft ??
    (saved ?? []).map((gw) => ({
      id: gw.id,
      label: gw.label,
      baseUrl: gw.baseUrl,
      models: gw.models.join(", "),
      token: null,
      configured: gw.configured,
    }));

  const edit = (index: number, patch: Partial<GatewayDraft>) =>
    setDraft(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const add = (preset?: (typeof PRESETS)[number]) => {
    // The id becomes an instance id, which bots store — so it is generated
    // once, shown, and never editable afterwards. A collision gets a suffix
    // rather than silently merging into the existing gateway.
    const base = preset?.id ?? "gateway";
    let id = base;
    for (let n = 2; rows.some((row) => row.id === id); n++) id = `${base}-${n}`;
    setDraft([
      ...rows,
      {
        id,
        label: preset?.label ?? "",
        baseUrl: preset?.baseUrl ?? "",
        models: preset?.models ?? "",
        token: null,
        configured: false,
      },
    ]);
  };

  const save = () => {
    setSaving(true);
    setError(null);
    api("/api/config", {
      method: "PUT",
      body: JSON.stringify({
        claudeGateways: rows.map((row) => ({
          id: row.id,
          label: row.label.trim(),
          baseUrl: row.baseUrl.trim(),
          // Omitting the token keeps the stored one — the form never sees it,
          // so sending "" on every save would clear what it cannot show.
          ...(row.token === null ? {} : { authToken: row.token.trim() }),
          models: row.models
            .split(",")
            .map((m) => m.trim())
            .filter(Boolean),
        })),
      }),
    })
      .then((status: ConfigStatus) => {
        dispatch({ type: "configStatus", config: status });
        setDraft(null);
        // The fleet was just rebuilt server-side; re-probe so the new engine
        // shows up now rather than whenever the picker next happens to.
        void refreshInstances();
      })
      .catch((e) => setError(e.message))
      .finally(() => setSaving(false));
  };

  const field =
    "w-full rounded-lg border border-hairline bg-inset px-2.5 py-1.5 text-[12.5px] text-ink placeholder:text-ink-secondary focus:outline-none";

  return (
    <div className="space-y-3">
      <div className="text-[12px] leading-[1.5] text-ink-secondary">
        Point the Claude Code engine at any endpoint that speaks the Anthropic API — DeepSeek, OpenRouter, Kimi, or a
        proxy on your own machine. Each one becomes its own engine in the model picker, beside the normal Claude
        sign-in.
      </div>

      {rows.map((row, index) => (
        <div key={row.id} className="rounded-xl border border-hairline bg-inset/40 p-3">
          <div className="mb-2 flex items-center gap-2">
            <input
              value={row.label}
              onChange={(e) => edit(index, { label: e.target.value })}
              placeholder="Name (shown in the picker)"
              className={`${field} min-w-0 flex-1 text-[13px]`}
            />
            <span
              className="shrink-0 rounded bg-inset px-1.5 py-1 font-mono text-[10.5px] tracking-tight text-ink-secondary"
              title="The engine id bots route by. Fixed once created, so a rename cannot orphan a bot."
            >
              claude-{row.id}
            </span>
            <button
              onClick={() => setDraft(rows.filter((_, i) => i !== index))}
              className="shrink-0 rounded-lg px-2 py-1.5 text-[12px] text-danger hover:bg-danger/10"
            >
              Remove
            </button>
          </div>

          <input
            type="url"
            inputMode="url"
            value={row.baseUrl}
            onChange={(e) => edit(index, { baseUrl: e.target.value })}
            placeholder="https://api.deepseek.com/anthropic"
            autoComplete="off"
            className={`${field} mb-2 font-mono tracking-tight placeholder:font-sans`}
          />

          <input
            value={row.models}
            onChange={(e) => edit(index, { models: e.target.value })}
            placeholder="Model ids, comma-separated — first is the default"
            autoComplete="off"
            className={`${field} mb-2`}
          />

          <input
            type="password"
            value={row.token ?? ""}
            onChange={(e) => edit(index, { token: e.target.value })}
            placeholder={row.configured ? "•••••••• token saved (type to replace)" : "Token this gateway expects"}
            autoComplete="off"
            className={field}
          />

          {isPlaintext(row.baseUrl) ? (
            <div className="mt-2 flex gap-1.5 rounded-lg border border-danger/25 bg-danger/10 px-2 py-1.5 text-[11px] leading-[1.4] text-danger">
              <Warning size={13} weight="bold" className="mt-px shrink-0" aria-hidden="true" />
              <span>Plain HTTP to a remote host is refused — the token would travel unencrypted. Use https.</span>
            </div>
          ) : (
            isRemote(row.baseUrl) && (
              <div className="mt-2 flex gap-1.5 rounded-lg border border-warning/25 bg-warning/10 px-2 py-1.5 text-[11px] leading-[1.4] text-warning">
                <Warning size={13} weight="bold" className="mt-px shrink-0" aria-hidden="true" />
                <span>
                  This host receives the token and every turn&apos;s full conversation. Only use a gateway you trust.
                </span>
              </div>
            )
          )}
          {row.baseUrl.trim() && !row.models.trim() && (
            <div className="mt-2 flex gap-1.5 rounded-lg border border-warning/25 bg-warning/10 px-2 py-1.5 text-[11px] leading-[1.4] text-warning">
              <Warning size={13} weight="bold" className="mt-px shrink-0" aria-hidden="true" />
              <span>Without model ids the picker offers Claude models, which this gateway will reject.</span>
            </div>
          )}
          {/* Both of these are settings that look right and fail on every turn
              — a path that 404s, an id the endpoint has never heard of. Said
              here, beside the field, rather than as a provider error in a chat
              thread an hour later. */}
          {[baseUrlWarning(row.baseUrl), modelIdWarning(row.baseUrl, row.models)]
            .filter((text): text is string => Boolean(text))
            .map((text) => (
              <div
                key={text}
                className="mt-2 flex gap-1.5 rounded-lg border border-warning/25 bg-warning/10 px-2 py-1.5 text-[11px] leading-[1.4] text-warning"
              >
                <Warning size={13} weight="bold" className="mt-px shrink-0" aria-hidden="true" />
                <span>{text}</span>
              </div>
            ))}
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[12px] text-ink-secondary">Add:</span>
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => add(preset)}
            className="rounded-lg border border-hairline px-2 py-1 text-[12px] text-ink hover:bg-raised"
          >
            {preset.label}
          </button>
        ))}
        <button
          onClick={() => add()}
          className="rounded-lg border border-hairline px-2 py-1 text-[12px] text-ink-secondary hover:bg-raised hover:text-ink"
        >
          Blank
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={save}
          disabled={saving || draft === null}
          className="flex w-[72px] shrink-0 items-center justify-center gap-1.5 rounded-lg bg-raised py-2 text-[13px] text-ink hover:bg-raised-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? (
            <Spinner size={13} weight="fill" className="animate-spin" />
          ) : (
            <>
              <Check size={13} weight="fill" />
              Save
            </>
          )}
        </button>
        <span className="text-[11px] leading-[1.45] text-ink-secondary">
          Vision matters: a gateway model that cannot read images cannot use the computer or Local VM, even though the
          engine otherwise works.
        </span>
      </div>

      {error && <div className="text-[12px] text-danger">{error}</div>}
    </div>
  );
}
