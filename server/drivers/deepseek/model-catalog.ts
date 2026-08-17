// DeepSeek model catalog (spec §30, P2-05).
//
// Two layers. The static list is what the picker shows before anything has
// been asked of the network, and it is a convenience list rather than a
// whitelist — the runtime resolves model ids against whatever provider the
// composition names, so a configured defaultModel that is not in it is
// still offered.
//
// Discovery sits on top: an OpenAI-compatible `GET /models` against the
// configured endpoint, which is what a custom base URL is for. It is
// strictly additive. A discovery failure keeps the previous catalog instead
// of emptying the picker — an endpoint being briefly down should not make a
// user's configured model disappear from the UI.
import type { ModelCatalog } from "../../contracts.ts";
import { DEFAULT_MODEL } from "./config.ts";

const KNOWN: ReadonlyArray<{ id: string; label: string }> = [{ id: DEFAULT_MODEL, label: "DeepSeek V4 Flash" }];

export const MODELS: ModelCatalog = {
  default: DEFAULT_MODEL,
  options: [...KNOWN],
};

/** Catalog for one configured instance: the known models plus the user's
 * own default when it is something else, so a custom endpoint's model shows
 * up in the picker instead of silently falling back. */
export function catalogFor(defaultModel: string): ModelCatalog {
  const model = defaultModel || DEFAULT_MODEL;
  const options = KNOWN.some((m) => m.id === model) ? [...KNOWN] : [...KNOWN, { id: model, label: model }];
  return { default: model, options };
}

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DISCOVERY_TIMEOUT_MS = 5_000;
/** A hostile or misconfigured endpoint could answer with a huge list; the
 * picker is a menu, not a database. */
const MAX_DISCOVERED = 100;

export interface DiscoverInput {
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  /** Injected in tests. Production passes nothing and gets global fetch. */
  fetchImpl?: typeof fetch;
}

/** Ask the endpoint what it serves. Resolves to null — never throws and
 * never returns an empty catalog — when discovery is unavailable, so the
 * caller can keep whatever it had. */
export async function discoverModels(input: DiscoverInput): Promise<ModelCatalog | null> {
  const { apiKey, defaultModel } = input;
  if (!apiKey) return null;

  const base = (input.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const doFetch = input.fetchImpl ?? globalThis.fetch;
  if (typeof doFetch !== "function") return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DISCOVERY_TIMEOUT_MS);
  timer.unref?.();
  try {
    const res = await doFetch(`${base}/models`, {
      // The key goes to whichever host baseUrl names. That is the user's
      // choice, made explicit by the warning describeBaseUrl produces and
      // shown in Settings before it is ever sent (spec §97).
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const body: unknown = await res.json();
    const ids = readModelIds(body);
    if (!ids.length) return null;

    const options = ids.slice(0, MAX_DISCOVERED).map((id) => ({ id, label: id }));
    // The configured default has to stay selectable even if the endpoint
    // does not list it — a model can be available without being advertised,
    // and dropping it here would silently switch the bot's model.
    const model = defaultModel || DEFAULT_MODEL;
    if (!options.some((o) => o.id === model)) options.unshift({ id: model, label: model });
    return { default: model, options };
  } catch {
    // timeout, DNS, TLS, malformed JSON — all the same answer: no news
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** OpenAI-compatible shape: `{ data: [{ id }] }`. Anything else yields
 * nothing rather than a guess. */
function readModelIds(body: unknown): string[] {
  const data = (body as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) return [];
  const ids: string[] = [];
  for (const entry of data) {
    const id = (entry as { id?: unknown } | null)?.id;
    if (typeof id === "string" && id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}
