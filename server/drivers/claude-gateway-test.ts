// Asking a gateway whether it actually works, before a bot finds out for you.
//
// A gateway is a base URL, a token and a model id, and all three can be wrong
// in ways that look fine when typed. The app already warns about the shapes it
// can see — a URL ending in /v1, an OpenRouter-style id sent to a vendor
// endpoint — but a key belonging to a different service, a model the account
// cannot reach, or an endpoint that speaks a different dialect all look
// perfectly valid until a turn dies halfway through.
//
// This makes one small real request and reports what came back, in the words
// the user needs to act on rather than the status code.

/** Long enough for a cold model to answer, short enough to feel like a test. */
const PROBE_TIMEOUT_MS = 30_000;
/** The reply is thrown away; only that one arrives matters. */
const PROBE_MAX_TOKENS = 4;

export interface GatewayProbeInput {
  readonly baseUrl: string;
  readonly authToken?: string | undefined;
  readonly model?: string | undefined;
}

export type GatewayProbeResult =
  | { ok: true; detail: string }
  | { ok: false; problem: string; detail?: string };

/** What the CLI would call: it appends the version and path itself. */
export function probeUrl(baseUrl: string): string {
  return `${baseUrl.trim().replace(/\/+$/, "")}/v1/messages`;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/**
 * Turn a failure into the sentence that tells the user what to change.
 *
 * The raw body is unhelpfully generic on every provider — "Missing
 * Authentication header" is what OpenRouter says when a key belongs to some
 * other service entirely, which reads as a bug in the app rather than a wrong
 * key. Naming the host and the likely cause is what makes it actionable.
 */
function explain(status: number, body: string, input: GatewayProbeInput): string {
  const host = hostOf(input.baseUrl);
  const token = input.authToken?.trim() ?? "";
  if (status === 401 || status === 403) {
    // An OpenRouter key is sk-or-…; anything else there is a key for a
    // different service, which is by far the most common way this fails.
    if (/openrouter\.ai$/i.test(host) && token && !token.startsWith("sk-or-")) {
      return `${host} rejected the key. OpenRouter keys begin with "sk-or-" — this one begins with "${token.slice(0, 6)}", so it looks like a key for a different service.`;
    }
    return token
      ? `${host} rejected the key. Check that it belongs to ${host} and is still active.`
      : `${host} needs a key and none is set.`;
  }
  if (status === 404) {
    return `${host} has nothing at ${probeUrl(input.baseUrl)}. Either the base URL is wrong or this endpoint does not speak the Anthropic Messages API.`;
  }
  if (status === 400 && /model/i.test(body)) {
    return `${host} did not accept the model "${input.model ?? ""}". Check the id against that provider's list.`;
  }
  if (status === 402) return `${host} says the account has no credit left.`;
  if (status === 429) return `${host} is rate-limiting this key right now. Try again shortly.`;
  if (status >= 500) return `${host} returned a server error (${status}). That is their side, not yours.`;
  return `${host} returned ${status}.`;
}

/** One small real request. Never throws: a probe that explodes is a failure. */
export async function probeGateway(
  input: GatewayProbeInput,
  fetchImpl: typeof fetch = fetch,
): Promise<GatewayProbeResult> {
  const baseUrl = input.baseUrl?.trim();
  if (!baseUrl) return { ok: false, problem: "No base URL." };
  const model = input.model?.trim();
  if (!model) return { ok: false, problem: "No model id to test with." };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetchImpl(probeUrl(baseUrl), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
        // Both spellings: Anthropic itself wants x-api-key, most compatible
        // gateways want a bearer, and sending both costs nothing.
        ...(input.authToken
          ? { "x-api-key": input.authToken, authorization: `Bearer ${input.authToken}` }
          : {}),
      },
      body: JSON.stringify({
        model,
        max_tokens: PROBE_MAX_TOKENS,
        messages: [{ role: "user", content: "hi" }],
      }),
      signal: controller.signal,
    });
    const body = await response.text().catch(() => "");
    if (response.ok) {
      return { ok: true, detail: `${hostOf(baseUrl)} answered as ${model}.` };
    }
    return {
      ok: false,
      problem: explain(response.status, body, { ...input, baseUrl }),
      detail: body.slice(0, 300) || undefined,
    };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return {
      ok: false,
      problem: aborted
        ? `${hostOf(baseUrl)} did not answer within ${PROBE_TIMEOUT_MS / 1000} seconds.`
        : `Could not reach ${hostOf(baseUrl)}. Check the address and your connection.`,
      detail: error instanceof Error ? error.message.slice(0, 200) : undefined,
    };
  } finally {
    clearTimeout(timer);
  }
}
