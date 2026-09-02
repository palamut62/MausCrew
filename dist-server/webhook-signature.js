// GitHub and Slack sign their deliveries; they do not carry a bearer token.
//
// MausCrew's own webhooks authenticate with a secret it generates and only
// ever stores hashed — which is right for a secret MausCrew hands out, and
// impossible for these two. A signature is an HMAC over the raw body, so both
// ends need the same key in the clear; that is what the platform's own
// "webhook secret" / "signing secret" field is. So a provider hook keeps its
// signing key beside the hash rather than instead of it: the bearer path is
// unchanged, and the plaintext exists only for hooks the user explicitly
// pointed at GitHub or Slack.
//
// Everything here works on the raw request body. A parsed-and-reserialized
// body does not reproduce the bytes that were signed — that is the classic
// way to build a verifier that says yes to everything.
import { createHmac, timingSafeEqual } from "node:crypto";
export const WEBHOOK_PROVIDERS = ["github", "slack"];
export const isWebhookProvider = (value) => typeof value === "string" && WEBHOOK_PROVIDERS.includes(value);
/** Slack refuses anything older than five minutes; the same window here stops
 * a captured delivery being replayed tomorrow. */
export const SLACK_MAX_SKEW_MS = 5 * 60 * 1000;
function equal(a, b) {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    return left.length === right.length && timingSafeEqual(left, right);
}
function githubSignature(secret, rawBody) {
    return `sha256=${createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")}`;
}
function slackSignature(secret, timestamp, rawBody) {
    return `v0=${createHmac("sha256", secret).update(`v0:${timestamp}:${rawBody}`, "utf8").digest("hex")}`;
}
export function verifySignature(provider, secret, request) {
    if (!secret)
        return { ok: false, reason: "no signing secret is configured for this webhook" };
    if (provider === "github") {
        const header = request.header("x-hub-signature-256");
        if (!header)
            return { ok: false, reason: "missing X-Hub-Signature-256" };
        return equal(header, githubSignature(secret, request.rawBody))
            ? { ok: true }
            : { ok: false, reason: "GitHub signature did not match" };
    }
    const signature = request.header("x-slack-signature");
    const timestamp = request.header("x-slack-request-timestamp");
    if (!signature || !timestamp)
        return { ok: false, reason: "missing Slack signature headers" };
    const sentAt = Number(timestamp) * 1000;
    if (!Number.isFinite(sentAt))
        return { ok: false, reason: "Slack timestamp is not a number" };
    const now = request.now ?? Date.now();
    if (Math.abs(now - sentAt) > SLACK_MAX_SKEW_MS) {
        return { ok: false, reason: "Slack delivery is outside the five-minute replay window" };
    }
    return equal(signature, slackSignature(secret, timestamp, request.rawBody))
        ? { ok: true }
        : { ok: false, reason: "Slack signature did not match" };
}
/**
 * Slack's one-time endpoint check: it posts `{type:"url_verification",
 * challenge}` and expects the challenge echoed back. Answered before anything
 * is queued — it is a handshake, not an event, and running a bot turn for it
 * would be a turn spent on Slack proving the URL exists.
 */
export function slackUrlVerification(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload))
        return null;
    const body = payload;
    if (body.type !== "url_verification")
        return null;
    return typeof body.challenge === "string" && body.challenge.length <= 1000 ? body.challenge : null;
}
/** The event name each platform puts in a different place. */
export function providerEventName(provider, request, payload) {
    if (provider === "github")
        return request.header("x-github-event")?.trim() || undefined;
    const body = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
    const inner = body.event && typeof body.event === "object" && !Array.isArray(body.event)
        ? body.event
        : {};
    const name = typeof inner.type === "string" ? inner.type : typeof body.type === "string" ? body.type : "";
    return name || undefined;
}
