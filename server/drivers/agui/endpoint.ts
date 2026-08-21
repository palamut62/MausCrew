import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type EndpointVerdict = { allowed: true; url: string } | { allowed: false; reason: string };
export type EndpointResolver = (hostname: string) => Promise<Array<{ address: string; family: number }>>;

const NEVER_ALLOWED = new Set(["metadata.google.internal", "metadata.google", "169.254.169.254", "169.254.170.2", "100.100.100.200"]);

function privateAddress(address: string) {
  const normalized = address.toLowerCase().replace(/^::ffff:/, "");
  if (normalized === "::1" || normalized === "::" || normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  const parts = normalized.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false;
  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    parts[0] === 0
  );
}

const systemResolver: EndpointResolver = async (hostname) => {
  if (isIP(hostname)) return [{ address: hostname, family: isIP(hostname) }];
  return lookup(hostname, { all: true, verbatim: true });
};

export async function checkAguiEndpoint(
  raw: unknown,
  options: { allowPrivateHosts?: boolean; resolver?: EndpointResolver } = {},
): Promise<EndpointVerdict> {
  if (typeof raw !== "string" || !raw.trim()) return { allowed: false, reason: "An AG-UI agent needs an endpoint URL." };
  let endpoint: URL;
  try {
    endpoint = new URL(raw.trim());
  } catch {
    return { allowed: false, reason: "The AG-UI endpoint is not a valid URL." };
  }
  if (!(["http:", "https:"] as string[]).includes(endpoint.protocol)) return { allowed: false, reason: "Only HTTP and HTTPS AG-UI endpoints are supported." };
  if (endpoint.username || endpoint.password) return { allowed: false, reason: "Put credentials in the encrypted auth field, not in the endpoint URL." };
  if (endpoint.hash) return { allowed: false, reason: "An AG-UI endpoint URL cannot contain a fragment." };
  const hostname = endpoint.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (NEVER_ALLOWED.has(hostname)) return { allowed: false, reason: "Cloud and local metadata endpoints can never be registered as agents." };

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await (options.resolver ?? systemResolver)(hostname);
  } catch {
    return { allowed: false, reason: "The AG-UI endpoint hostname could not be resolved." };
  }
  if (!addresses.length) return { allowed: false, reason: "The AG-UI endpoint hostname has no network address." };
  for (const entry of addresses) {
    if (NEVER_ALLOWED.has(entry.address.toLowerCase())) return { allowed: false, reason: "Cloud and local metadata endpoints can never be registered as agents." };
    if (privateAddress(entry.address) && !options.allowPrivateHosts) {
      return { allowed: false, reason: "Private-network AG-UI endpoints are disabled for this deployment." };
    }
  }
  const allPrivate = addresses.every((entry) => privateAddress(entry.address));
  if (endpoint.protocol === "http:" && !allPrivate) return { allowed: false, reason: "Public AG-UI endpoints must use HTTPS." };
  return { allowed: true, url: endpoint.toString() };
}
