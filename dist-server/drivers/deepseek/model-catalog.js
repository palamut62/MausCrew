import { DEFAULT_MODEL } from "./config.js";
const KNOWN = [{ id: DEFAULT_MODEL, label: "DeepSeek V4 Flash" }];
export const MODELS = {
    default: DEFAULT_MODEL,
    options: [...KNOWN],
};
/** Catalog for one configured instance: the known models plus the user's
 * own default when it is something else, so a custom endpoint's model shows
 * up in the picker instead of silently falling back. */
export function catalogFor(defaultModel) {
    const model = defaultModel || DEFAULT_MODEL;
    const options = KNOWN.some((m) => m.id === model) ? [...KNOWN] : [...KNOWN, { id: model, label: model }];
    return { default: model, options };
}
const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DISCOVERY_TIMEOUT_MS = 5_000;
/** A hostile or misconfigured endpoint could answer with a huge list; the
 * picker is a menu, not a database. */
const MAX_DISCOVERED = 100;
/** Ask the endpoint what it serves. Resolves to null — never throws and
 * never returns an empty catalog — when discovery is unavailable, so the
 * caller can keep whatever it had. */
export async function discoverModels(input) {
    const { apiKey, defaultModel } = input;
    if (!apiKey)
        return null;
    const base = (input.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
    const doFetch = input.fetchImpl ?? globalThis.fetch;
    if (typeof doFetch !== "function")
        return null;
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
        if (!res.ok)
            return null;
        const body = await res.json();
        const ids = readModelIds(body);
        if (!ids.length)
            return null;
        const options = ids.slice(0, MAX_DISCOVERED).map((id) => ({ id, label: id }));
        // The configured default has to stay selectable even if the endpoint
        // does not list it — a model can be available without being advertised,
        // and dropping it here would silently switch the bot's model.
        const model = defaultModel || DEFAULT_MODEL;
        if (!options.some((o) => o.id === model))
            options.unshift({ id: model, label: model });
        return { default: model, options };
    }
    catch {
        // timeout, DNS, TLS, malformed JSON — all the same answer: no news
        return null;
    }
    finally {
        clearTimeout(timer);
    }
}
/** OpenAI-compatible shape: `{ data: [{ id }] }`. Anything else yields
 * nothing rather than a guess. */
function readModelIds(body) {
    const data = body?.data;
    if (!Array.isArray(data))
        return [];
    const ids = [];
    for (const entry of data) {
        const id = entry?.id;
        if (typeof id === "string" && id && !ids.includes(id))
            ids.push(id);
    }
    return ids;
}
