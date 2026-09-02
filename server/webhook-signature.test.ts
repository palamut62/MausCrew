import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  isWebhookProvider,
  providerEventName,
  slackUrlVerification,
  verifySignature,
} from "./webhook-signature.ts";

const secret = "whsec_example";
const rawBody = '{"action":"opened","number":7}';

const headers = (values: Record<string, string>) => ({
  rawBody,
  header: (name: string) => values[name],
});

const githubHeader = (body = rawBody, key = secret) =>
  `sha256=${createHmac("sha256", key).update(body, "utf8").digest("hex")}`;

const slackHeader = (timestamp: string, body = rawBody, key = secret) =>
  `v0=${createHmac("sha256", key).update(`v0:${timestamp}:${body}`, "utf8").digest("hex")}`;

describe("provider webhook signatures", () => {
  it("accepts a correctly signed GitHub delivery and rejects a tampered body", () => {
    expect(verifySignature("github", secret, headers({ "x-hub-signature-256": githubHeader() })).ok).toBe(true);
    // Same signature, different body: this is the case a verifier that hashes
    // a re-serialized payload would wave through.
    const tampered = { rawBody: '{"action":"closed"}', header: () => githubHeader() };
    expect(verifySignature("github", secret, tampered).ok).toBe(false);
    expect(verifySignature("github", "another-secret", headers({ "x-hub-signature-256": githubHeader() })).ok).toBe(false);
  });

  it("reports what was missing rather than failing silently", () => {
    expect(verifySignature("github", secret, headers({}))).toEqual({
      ok: false,
      reason: "missing X-Hub-Signature-256",
    });
    expect(verifySignature("github", "", headers({ "x-hub-signature-256": githubHeader() })).reason)
      .toContain("no signing secret");
  });

  it("verifies Slack's v0 signature over the timestamped body", () => {
    const now = 1_700_000_000_000;
    const timestamp = String(Math.floor(now / 1000));
    const request = {
      rawBody,
      header: (name: string) => ({ "x-slack-signature": slackHeader(timestamp), "x-slack-request-timestamp": timestamp })[name],
      now,
    };
    expect(verifySignature("slack", secret, request).ok).toBe(true);
  });

  it("refuses a Slack delivery replayed outside the five-minute window", () => {
    const now = 1_700_000_000_000;
    const old = String(Math.floor((now - 6 * 60 * 1000) / 1000));
    const request = {
      rawBody,
      header: (name: string) => ({ "x-slack-signature": slackHeader(old), "x-slack-request-timestamp": old })[name],
      now,
    };
    // The signature itself is valid — it is the age that disqualifies it.
    expect(verifySignature("slack", secret, request)).toEqual({
      ok: false,
      reason: "Slack delivery is outside the five-minute replay window",
    });
  });

  it("answers Slack's endpoint handshake and nothing else", () => {
    expect(slackUrlVerification({ type: "url_verification", challenge: "abc123" })).toBe("abc123");
    expect(slackUrlVerification({ type: "event_callback", challenge: "abc123" })).toBeNull();
    expect(slackUrlVerification({ type: "url_verification", challenge: "x".repeat(1001) })).toBeNull();
    expect(slackUrlVerification("not an object")).toBeNull();
  });

  it("finds the event name where each platform puts it", () => {
    expect(providerEventName("github", headers({ "x-github-event": "pull_request" }), {})).toBe("pull_request");
    expect(providerEventName("slack", headers({}), { type: "event_callback", event: { type: "app_mention" } }))
      .toBe("app_mention");
    expect(providerEventName("slack", headers({}), {})).toBeUndefined();
  });

  it("recognizes only the two providers it can verify", () => {
    expect(isWebhookProvider("github")).toBe(true);
    expect(isWebhookProvider("slack")).toBe(true);
    expect(isWebhookProvider("gitlab")).toBe(false);
  });
});
