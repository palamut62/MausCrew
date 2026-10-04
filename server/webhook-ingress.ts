import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import type { WebhookManager } from "./webhooks.ts";
import { providerEventName, slackUrlVerification } from "./webhook-signature.ts";

export const MAX_WEBHOOK_BODY_BYTES = 256 * 1024;

export interface WebhookIngress {
  server: Server;
  host: string;
  port: number;
  baseUrl: string;
}

function json(res: ServerResponse, status: number, body: unknown, close = false): void {
  res.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    // `close` makes Node tear the socket down once this reply is flushed, which
    // discards whatever of the request body is still in flight. Destroying the
    // request directly would stop the sender too, but it also kills the
    // response, and a rejection the sender never receives is not a rejection.
    ...(close ? { connection: "close" } : {}),
  });
  res.end(JSON.stringify(body));
}

function readRawBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let raw = "";
    let bytes = 0;
    let done = false;
    const fail = (status: number, message: string) => {
      if (done) return;
      done = true;
      // Stop consuming immediately — an oversized or hostile body must not keep
      // being read into this process. The socket itself is closed by the 413
      // reply's `connection: close`, after the sender has been told why.
      req.pause();
      reject(Object.assign(new Error(message), { status }));
    };
    req.on("data", (chunk) => {
      if (done) return;
      bytes += typeof chunk === "string" ? Buffer.byteLength(chunk) : chunk.length;
      if (bytes > MAX_WEBHOOK_BODY_BYTES) return fail(413, "Webhook body is too large");
      raw += chunk;
    });
    req.on("end", () => {
      if (done) return;
      done = true;
      resolve(raw);
    });
    req.on("error", () => fail(400, "Could not read webhook body"));
  });
}

function parsePayload(raw: string, contentType: string): unknown {
  if (!raw) return {};
  if (contentType.includes("application/json") || contentType.includes("+json")) {
    try {
      return JSON.parse(raw);
    } catch {
      throw Object.assign(new Error("Invalid JSON webhook body"), { status: 400 });
    }
  }
  if (contentType.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(raw));
  }
  return raw;
}

function header(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function bearerSecret(req: IncomingMessage): string {
  const authorization = header(req, "authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || header(req, "x-mauscrew-secret")?.trim() || "";
}

function deliveryId(req: IncomingMessage): string | undefined {
  return (
    header(req, "idempotency-key") ??
    header(req, "x-webhook-id") ??
    header(req, "x-github-delivery") ??
    header(req, "webhook-id")
  )?.trim() || undefined;
}

function eventName(req: IncomingMessage): string | undefined {
  return (
    header(req, "x-github-event") ??
    header(req, "x-webhook-event") ??
    header(req, "x-event-type") ??
    header(req, "ce-type")
  )?.trim() || undefined;
}

export function createWebhookIngressHandler(manager: WebhookManager) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    let url: URL;
    try {
      url = new URL(req.url ?? "/", "http://localhost");
    } catch {
      return json(res, 400, { error: "Invalid request URL" });
    }
    if (req.method === "GET" && url.pathname === "/health") {
      return json(res, 200, { app: "mauscrew-webhooks", ready: true });
    }
    const match = url.pathname.match(/^\/hooks\/(wh_[A-Za-z0-9_-]+)(?:\/([^/]+))?$/);
    if (!match) return json(res, 404, { error: "Unknown webhook endpoint" });
    if (req.method !== "POST") return json(res, 405, { error: "Webhooks accept POST requests" });

    try {
      const pathSecret = match[2] ? decodeURIComponent(match[2]) : "";
      const secret = pathSecret || bearerSecret(req);
      const provider = manager.providerFor(match[1]);
      if (provider) {
        // A signature covers the raw bytes, so the body has to be read before
        // it can be checked — the size cap in readRawBody is what keeps that
        // from being a way in.
        const raw = await readRawBody(req);
        const signed = manager.verifySigned(match[1], { rawBody: raw, header: (name) => header(req, name) });
        if (!signed.ok) {
          manager.recordRejected(match[1], 401, signed.reason ?? "signature check failed", {
            contentType: header(req, "content-type"),
            eventName: eventName(req),
            deliveryId: deliveryId(req),
          });
          return json(res, 401, { error: signed.reason ?? "signature check failed" });
        }
        const contentType = header(req, "content-type")?.split(";")[0]?.trim().toLowerCase() ?? "application/json";
        const payload = parsePayload(raw, contentType);
        // Slack proves the URL exists before it will send events. Answering
        // the handshake here keeps it from becoming a bot turn.
        const challenge = provider === "slack" ? slackUrlVerification(payload) : null;
        if (challenge) return json(res, 200, { challenge });
        const result = manager.receive(
          match[1],
          "",
          {
            payload,
            contentType,
            eventName: providerEventName(provider, { rawBody: raw, header: (name) => header(req, name) }, payload),
            userAgent: header(req, "user-agent"),
            deliveryId: deliveryId(req),
          },
          { signatureVerified: true },
        );
        return json(res, 202, { accepted: true, ...result });
      }
      // Reject bad capability URLs before buffering or parsing attacker input.
      if (!manager.authorize(match[1], secret)) {
        manager.recordRejected(match[1], 401, "Invalid webhook URL or secret", {
          contentType: header(req, "content-type"),
          eventName: eventName(req),
          deliveryId: deliveryId(req),
        });
        return json(res, 401, { error: "Invalid webhook URL or secret" });
      }
      const raw = await readRawBody(req);
      const contentType = header(req, "content-type")?.split(";")[0]?.trim().toLowerCase() ?? "text/plain";
      const payload = parsePayload(raw, contentType);
      const result = manager.receive(match[1], secret, {
        payload,
        contentType,
        eventName: eventName(req),
        userAgent: header(req, "user-agent"),
        deliveryId: deliveryId(req),
      });
      return json(res, 202, { accepted: true, ...result });
    } catch (error) {
      const status = Number((error as { status?: number })?.status) || 500;
      const message = error instanceof Error ? error.message : String(error);
      // Manager-level validation records its own rejection with the parsed
      // payload. Receiver-level failures happen earlier, so record metadata
      // here without buffering untrusted data a second time.
      if (status === 400 || status === 413) {
        manager.recordRejected(match[1], status, message, {
          contentType: header(req, "content-type"),
          eventName: eventName(req),
          deliveryId: deliveryId(req),
        });
      }
      // 413/400 here mean the body was refused mid-read, so the rest of it is
      // still coming; end the connection with the answer.
      return json(res, status, { error: message }, status === 413 || status === 400);
    }
  };
}

export async function listenWebhookIngress(
  manager: WebhookManager,
  options: { host?: string; port: number },
): Promise<WebhookIngress> {
  const host = options.host ?? "127.0.0.1";
  const server = createServer(createWebhookIngressHandler(manager));
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => reject(error);
    server.once("error", onError);
    server.listen(options.port, host, () => {
      server.off("error", onError);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Webhook receiver did not get a TCP address");
  }
  return { server, host, port: address.port, baseUrl: `http://${host}:${address.port}` };
}

export function webhookCredential(baseUrl: string, endpointId: string, secret: string) {
  const endpointUrl = `${baseUrl.replace(/\/$/, "")}/hooks/${endpointId}`;
  return {
    endpointUrl,
    secret,
    url: `${endpointUrl}/${encodeURIComponent(secret)}`,
  };
}
