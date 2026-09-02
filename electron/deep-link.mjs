// Two deep-link schemes land here:
//
//  - mauscrew://bot/add?name=..&title=..&description=.. — MausCrew's own
//    scheme, for a site that wants a bot card to open directly in MausCrew.
//
//  - grokbot://app/v1/bot-template?id=<id> — the official "Add to Grok Bot"
//    button on x.ai/bot/<id> uses this. MausCrew registers itself for the
//    same scheme so that button opens MausCrew (per-user request: the user
//    wants their own installed app in the loop, not xAI's). Only the id is
//    in the link; the bot's name/description are the public preview already
//    shown on that page (not its real system prompt — that lives behind
//    xAI's own authenticated backend, which MausCrew has no access to), so
//    resolveGrokBotPreview() in main.mjs fetches that same public page and
//    reads the values back out of it.
//
// Pulled out of main.mjs (which has Electron-only globals) so the parsing
// itself — the part actually worth getting right — is testable with plain
// node --test / vitest, matching capabilities.cjs / terminal-launch.mjs.
export function findDeepLinkUrl(argv) {
  return (
    argv.find(
      (arg) =>
        typeof arg === "string" && (arg.startsWith("mauscrew://") || arg.startsWith("grokbot://")),
    ) ?? null
  );
}

/** Server-side validation (POST /api/bots + PATCH) is the real gate; this
 * only keeps an obviously-malformed link from reaching the renderer. */
export function parseDeepLinkBot(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== "mauscrew:") return null;
  // Custom-scheme URLs parse inconsistently across platforms — "bot" can
  // land in hostname or the first path segment depending on OS/Node — so
  // both are checked.
  const segments = [parsed.hostname, ...parsed.pathname.split("/")].filter(Boolean);
  if (segments[0] !== "bot" || segments[1] !== "add") return null;
  const name = parsed.searchParams.get("name")?.trim().slice(0, 64) ?? "";
  if (!name) return null;
  return {
    name,
    title: parsed.searchParams.get("title")?.trim().slice(0, 200) ?? "",
    description: parsed.searchParams.get("description")?.trim().slice(0, 4000) ?? "",
  };
}

/** grokbot://app/v1/bot-template?id=<id> → the id, or null. Charset/length
 * matches every id x.ai has issued so far (base62-ish with - and _); it is
 * about to become a URL path segment, so this doubles as the injection
 * guard on top of the URL/searchParams parse already having happened. */
export function parseGrokBotTemplateId(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== "grokbot:") return null;
  const segments = [parsed.hostname, ...parsed.pathname.split("/")].filter(Boolean);
  if (segments[0] !== "app" || segments[1] !== "v1" || segments[2] !== "bot-template") return null;
  const id = parsed.searchParams.get("id") ?? "";
  return /^[A-Za-z0-9_-]{1,64}$/.test(id) ? id : null;
}

function decodeHtmlEntities(text) {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** Pulls {name, description, sharerName} out of x.ai/bot/<id>'s HTML. Tried
 * in order of how much the page's markup could drift before each breaks:
 * the embedded React Server Component JSON (exact field names, what the
 * page's own UI reads) first, then the Open Graph meta tags (looser, but
 * present on effectively every page-preview integration) as a fallback.
 * Returns null when neither source has a usable name. */
export function extractGrokBotPreview(html) {
  if (typeof html !== "string" || !html) return null;

  // x.ai embeds this as a JSON blob inside a JS string literal (a Next.js
  // RSC push payload), so every quote in it is backslash-escaped in the raw
  // HTML: ...\"botName\":\"overnight shipper\"... — hence the optional \\?
  // around each quote below, non-greedy so one field's match doesn't run
  // past its own closing quote into the next field.
  const jsonField = (key) => {
    const match = html.match(new RegExp(`\\\\?"${key}\\\\?":\\\\?"((?:[^"\\\\]|\\\\.)*?)\\\\?"`));
    if (!match) return null;
    try {
      return JSON.parse(`"${match[1]}"`);
    } catch {
      return null;
    }
  };
  const jsonName = jsonField("botName");
  if (jsonName) {
    return {
      name: jsonName,
      description: jsonField("description") ?? "",
      sharerName: jsonField("sharerName") ?? "",
    };
  }

  const metaContent = (property) =>
    html.match(new RegExp(`<meta property="${property}" content="([^"]*)"`))?.[1];
  const ogTitle = metaContent("og:title");
  if (!ogTitle) return null;
  const title = decodeHtmlEntities(ogTitle);
  // The page renders the title as "<name> by <author>" — split on the LAST
  // " by " so a name that itself contains " by " degrades to the full
  // title rather than truncating mid-name.
  const byIndex = title.lastIndexOf(" by ");
  return {
    name: byIndex === -1 ? title : title.slice(0, byIndex),
    description: decodeHtmlEntities(metaContent("og:description") ?? ""),
    sharerName: byIndex === -1 ? "" : title.slice(byIndex + " by ".length),
  };
}
