// Who should do the thing that just arrived from Telegram.
//
// The decision is the Chief's — it is a judgement about expertise, tools and
// what each MAUS is already holding, and no keyword table gets that right.
// So the model picks and this file does the two things a model must not be
// trusted with: it builds the roster the choice is made from, and it refuses
// any answer that is not a real MAUS or a well-formed new one.
//
// Two rules are enforced here rather than asked for politely, because a model
// that ignores them costs the user a bot they did not want:
//
//  - Busy is not a reason to create. A specialist that fits and is mid-turn
//    gets the work queued behind its current turn; the queue already exists.
//  - Creation happens only when the user has switched it on. Otherwise the
//    request comes back as "nobody fits", and the user decides.
const NAME_LIMIT = 64;
const TITLE_LIMIT = 200;
const DESCRIPTION_LIMIT = 2_000;
/** The roster, as the Chief sees it. Ids are opaque to the reader on purpose:
 * the model has to echo one back, and a name would be ambiguous the moment
 * two bots share one. */
export function routingPrompt(request, roster, canCreate) {
    const lines = roster.map((entry) => `- id: ${entry.id}\n  name: ${entry.name}\n  role: ${entry.title || "unspecified"}\n  about: ${(entry.description || "no description").slice(0, 400)}\n  busy: ${entry.busy ? "yes" : "no"}${entry.chief ? "\n  note: this is the Chief of Staff; it coordinates rather than doing the work" : ""}`);
    return [
        "You are staffing one incoming request against an existing team.",
        "",
        "REQUEST:",
        request.slice(0, 4_000),
        "",
        "TEAM:",
        lines.join("\n") || "(nobody yet)",
        "",
        "Pick the one MAUS whose role and description fit this request best.",
        "A MAUS that fits but is busy is still the right answer — its work is queued, not dropped.",
        canCreate
            ? "If nobody on the team plausibly fits, propose one new MAUS for this kind of work — a durable specialist, not a one-off."
            : "If nobody fits, say so. You may not propose a new MAUS.",
        "",
        "Answer with JSON and nothing else, in one of these shapes:",
        '{"botId":"<id from the list>","why":"<short reason>"}',
        canCreate ? '{"create":{"name":"<short name>","title":"<role>","description":"<what it owns, second person>"},"why":"<short reason>"}' : "",
        '{"none":true,"why":"<short reason>"}',
    ]
        .filter(Boolean)
        .join("\n");
}
function text(value, limit) {
    return typeof value === "string" ? value.trim().slice(0, limit) : "";
}
/** Pull the JSON out of whatever the model wrapped it in — a fenced block, a
 * sentence of preamble — without running anything. */
function extractJson(raw) {
    const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
    const candidate = fenced ? fenced[1] : raw;
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start === -1 || end <= start)
        return null;
    try {
        return JSON.parse(candidate.slice(start, end + 1));
    }
    catch {
        return null;
    }
}
/**
 * Validate the Chief's answer against the roster it was given.
 *
 * Every failure mode lands on "none" with a reason rather than a throw: the
 * caller has a user waiting in Telegram, and "I could not decide" is an
 * answer they can act on.
 */
export function parseRouting(raw, roster, canCreate) {
    const parsed = extractJson(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { kind: "none", why: "the Chief did not answer in a form I could read" };
    }
    const answer = parsed;
    const why = text(answer.why, 300) || "no reason given";
    const botId = text(answer.botId, 100);
    if (botId) {
        // Must be a MAUS that was actually on the list. A hallucinated id would
        // otherwise become a 404 the user sees as "nothing happened".
        return roster.some((entry) => entry.id === botId)
            ? { kind: "existing", botId, why }
            : { kind: "none", why: "the Chief named a MAUS that is not on the team" };
    }
    const create = answer.create;
    if (create && typeof create === "object" && !Array.isArray(create)) {
        if (!canCreate)
            return { kind: "none", why: "nobody fits, and creating one is switched off" };
        const record = create;
        const name = text(record.name, NAME_LIMIT);
        if (!name)
            return { kind: "none", why: "the proposed MAUS had no name" };
        // A name already in use would make @mentions ambiguous for good.
        if (roster.some((entry) => entry.name.toLowerCase() === name.toLowerCase())) {
            return { kind: "none", why: `there is already a MAUS called ${name}` };
        }
        return {
            kind: "create",
            profile: {
                name,
                title: text(record.title, TITLE_LIMIT),
                description: text(record.description, DESCRIPTION_LIMIT),
            },
            why,
        };
    }
    return { kind: "none", why };
}
