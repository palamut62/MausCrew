import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { writeFileAtomic } from "./atomic.js";
import { DATA_DIR } from "./config.js";
const DEVICES_FILE = join(DATA_DIR, "remote-devices.json");
const pairings = new Map();
const claimAttempts = new Map();
const PAIRING_TTL_MS = 10 * 60_000;
const CLAIM_WINDOW_MS = 60_000;
const CLAIM_LIMIT = 10;
const digest = (value) => createHash("sha256").update(value).digest("hex");
function safeEqual(left, right) {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
}
function loadDevices() {
    try {
        const parsed = JSON.parse(readFileSync(DEVICES_FILE, "utf8"));
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
}
function saveDevices(devices) {
    writeFileAtomic(DEVICES_FILE, JSON.stringify(devices, null, 2), { mode: 0o600 });
}
export function listRemoteDevices() {
    return loadDevices().map(({ tokenHash: _tokenHash, ...device }) => device);
}
export function createPairing() {
    const code = randomBytes(6).toString("base64url").toUpperCase();
    const expiresAt = Date.now() + PAIRING_TTL_MS;
    pairings.set(digest(code), { codeHash: digest(code), expiresAt });
    return { code, expiresAt };
}
export function claimPairing(code, name, attemptKey) {
    const now = Date.now();
    const recent = (claimAttempts.get(attemptKey) ?? []).filter((at) => now - at < CLAIM_WINDOW_MS);
    if (recent.length >= CLAIM_LIMIT)
        return "rate-limited";
    recent.push(now);
    claimAttempts.set(attemptKey, recent);
    const codeHash = digest(code.trim().toUpperCase());
    const pairing = [...pairings.values()].find((candidate) => safeEqual(candidate.codeHash, codeHash));
    if (!pairing || pairing.expiresAt < now)
        return null;
    pairings.delete(pairing.codeHash);
    const token = randomBytes(32).toString("base64url");
    const device = {
        id: randomUUID(),
        name: name.trim().slice(0, 80) || "Mobile device",
        createdAt: now,
        lastSeenAt: now,
        tokenHash: digest(token),
    };
    saveDevices([...loadDevices(), device]);
    const { tokenHash: _tokenHash, ...publicDevice } = device;
    return { token, device: publicDevice };
}
export function authenticateRemoteToken(token) {
    if (!token)
        return null;
    const tokenHash = digest(token);
    const devices = loadDevices();
    const index = devices.findIndex((device) => safeEqual(device.tokenHash, tokenHash));
    if (index < 0)
        return null;
    const now = Date.now();
    const device = devices[index];
    if (now - device.lastSeenAt > 60_000) {
        devices[index] = { ...device, lastSeenAt: now };
        saveDevices(devices);
    }
    const { tokenHash: _tokenHash, ...publicDevice } = devices[index];
    return publicDevice;
}
export function revokeRemoteDevice(id) {
    if (!existsSync(DEVICES_FILE))
        return false;
    const devices = loadDevices();
    const kept = devices.filter((device) => device.id !== id);
    if (kept.length === devices.length)
        return false;
    saveDevices(kept);
    return true;
}
export function cookieToken(cookie) {
    if (!cookie)
        return null;
    for (const part of cookie.split(";")) {
        const [key, ...value] = part.trim().split("=");
        if (key === "mauscrew_remote")
            return decodeURIComponent(value.join("="));
    }
    return null;
}
