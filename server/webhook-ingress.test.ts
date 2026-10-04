import { createHmac } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { listenWebhookIngress, MAX_WEBHOOK_BODY_BYTES, webhookCredential, type WebhookIngress } from "./webhook-ingress.ts";
import { WebhookManager } from "./webhooks.ts";

let dir: string;
let ingress: WebhookIngress;
let endpointId: string;
let secret: string;
let manager: WebhookManager;
const queued: Array<Record<string, unknown>> = [];

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "mauscrew-webhook-ingress-"));
  manager = new WebhookManager({
    file: join(dir, "webhooks.json"),
    botState: () => "ready",
    enqueue: (input) => {
      queued.push(input);
      return { id: `run-${queued.length}` };
    },
  });
  const created = manager.create({ name: "Build event", prompt: "Review the build", botId: "maus-1" });
  endpointId = created.webhook.endpointId;
  secret = created.secret;
  ingress = await listenWebhookIngress(manager, { port: 0 });
});

afterAll(async () => {
  await new Promise<void>((resolve) => ingress.server.close(() => resolve()));
  rmSync(dir, { recursive: true, force: true });
});

describe("webhook-only ingress", () => {
  it("exposes health but nothing from the main MausCrew API", async () => {
    const health = await fetch(`${ingress.baseUrl}/health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ app: "mauscrew-webhooks", ready: true });
    expect((await fetch(`${ingress.baseUrl}/api/bots`)).status).toBe(404);
  });

  it("answers a malformed request target with 400 and keeps serving", async () => {
    const status = await new Promise<number>((resolve, reject) => {
      const socket = connect(ingress.port, "127.0.0.1", () => socket.write("GET //[ HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n"));
      let buffer = "";
      socket.on("data", (chunk) => (buffer += chunk));
      socket.on("error", reject);
      socket.on("close", () => resolve(Number(buffer.split(" ")[1] ?? 0)));
    });
    expect(status).toBe(400);
    expect((await fetch(`${ingress.baseUrl}/health`)).status).toBe(200);
  });

  it("accepts capability URLs and deduplicates retries", async () => {
    const credential = webhookCredential(ingress.baseUrl, endpointId, secret);
    const send = () => fetch(credential.url, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "delivery-1", "x-github-event": "push" },
      body: JSON.stringify({ ref: "main", id: "event-in-body" }),
    });
    const first = await send();
    expect(first.status).toBe(202);
    expect(await first.json()).toMatchObject({ accepted: true, duplicate: false, runId: "run-1" });
    const retry = await send();
    expect(retry.status).toBe(202);
    expect(await retry.json()).toMatchObject({ accepted: true, duplicate: true, runId: "run-1" });
    expect(queued).toHaveLength(1);
    expect(queued[0]?.prompt).toContain("Event: push");
  });

  it("also accepts a bearer secret without putting it in the URL", async () => {
    const response = await fetch(`${ingress.baseUrl}/hooks/${endpointId}`, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}`, "content-type": "application/x-www-form-urlencoded" },
      body: "ticket=42&priority=high",
    });
    expect(response.status).toBe(202);
    expect(queued.at(-1)?.prompt).toContain('"ticket": "42"');
  });

  it("does not deduplicate separate requests that reuse a generic payload id", async () => {
    const credential = webhookCredential(ingress.baseUrl, endpointId, secret);
    const before = queued.length;
    const send = () => fetch(credential.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "shared-record", task: "Handle this update" }),
    });
    expect((await send()).status).toBe(202);
    expect((await send()).status).toBe(202);
    expect(queued).toHaveLength(before + 2);
  });

  it("captures a verification event without queueing work", async () => {
    const created = manager.create({ name: "Verify", prompt: "", botId: "maus-1", enabled: false, verificationPending: true });
    const before = queued.length;
    const response = await fetch(webhookCredential(ingress.baseUrl, created.webhook.endpointId, created.secret).url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-webhook-event": "support.created" },
      body: JSON.stringify({ task: "Triage ticket 42" }),
    });
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ accepted: true, captured: true });
    expect(queued).toHaveLength(before);
    expect(manager.list().find((webhook) => webhook.id === created.webhook.id)).toMatchObject({ verificationPending: false, enabled: false });
  });

  it("runs a GitHub delivery on its signature, and only on its signature", async () => {
    const created = manager.create({ name: "GitHub", prompt: "Review the pull request", botId: "maus-1", provider: "github" });
    manager.setSigningSecret(created.webhook.id, "gh-signing-secret");
    const endpoint = `${ingress.baseUrl}/hooks/${created.webhook.endpointId}`;
    const body = JSON.stringify({ action: "opened", number: 7 });
    const signature = `sha256=${createHmac("sha256", "gh-signing-secret").update(body, "utf8").digest("hex")}`;
    const before = queued.length;

    const accepted = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": signature,
        "x-github-event": "pull_request",
        "x-github-delivery": "delivery-1",
      },
      body,
    });
    expect(accepted.status).toBe(202);
    expect(queued).toHaveLength(before + 1);

    // A body that does not match the signature it arrived with.
    const tampered = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", "x-hub-signature-256": signature, "x-github-delivery": "delivery-2" },
      body: JSON.stringify({ action: "closed" }),
    });
    expect(tampered.status).toBe(401);

    // The bearer secret is not a way in for a signed hook, even the real one.
    const bearer = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${created.secret}`, "x-github-delivery": "delivery-3" },
      body,
    });
    expect(bearer.status).toBe(401);
    expect(queued).toHaveLength(before + 1);
  });

  it("answers Slack's endpoint handshake without starting a turn", async () => {
    const created = manager.create({ name: "Slack", prompt: "Answer the mention", botId: "maus-1", provider: "slack" });
    manager.setSigningSecret(created.webhook.id, "slack-signing-secret");
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify({ type: "url_verification", challenge: "handshake-token" });
    const signature = `v0=${createHmac("sha256", "slack-signing-secret").update(`v0:${timestamp}:${body}`, "utf8").digest("hex")}`;
    const before = queued.length;

    const response = await fetch(`${ingress.baseUrl}/hooks/${created.webhook.endpointId}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-slack-signature": signature,
        "x-slack-request-timestamp": timestamp,
      },
      body,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ challenge: "handshake-token" });
    expect(queued).toHaveLength(before);
  });

  it("rejects invalid credentials, malformed JSON and oversized bodies", async () => {
    const unauthorized = await fetch(`${ingress.baseUrl}/hooks/${endpointId}/wrong`, { method: "POST", body: "{}" });
    expect(unauthorized.status).toBe(401);

    const malformed = await fetch(`${ingress.baseUrl}/hooks/${endpointId}/${secret}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });
    expect(malformed.status).toBe(400);

    const oversized = await fetch(`${ingress.baseUrl}/hooks/${endpointId}/${secret}`, {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "x".repeat(MAX_WEBHOOK_BODY_BYTES + 1),
    });
    expect(oversized.status).toBe(413);
    expect(manager.listAttempts().filter((attempt) => attempt.webhookId === manager.list().find((webhook) => webhook.endpointId === endpointId)?.id && attempt.outcome === "rejected").length).toBeGreaterThanOrEqual(3);
  });
});
