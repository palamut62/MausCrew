// What MausCrew's own browser profile is signed into, and how a person signs
// it into something new.
//
// The profile is the boundary that keeps a bot out of the user's everyday
// Chrome (see pcBrowserIntegration in index.ts). Two things were missing on
// this side of it: no way to sign in ahead of time, so every first visit to a
// site became a bot stopping mid-task at a login wall; and no way to see what
// the profile holds, so "the bot has its own sessions" was a claim the user
// could not check.
//
// Both are answered here without a second browser stack: the same persistent
// profile, opened headed by a short-lived child process (drivers/
// playwright-signin.ts), reporting the cookie domains it ends up with.
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { writeFileAtomic } from "./atomic.ts";
import { DATA_DIR } from "./config.ts";

export const PROFILE_DIR = join(DATA_DIR, "pc-browser-profile");
const SNAPSHOT_FILE = join(DATA_DIR, "pc-browser-sites.json");

const signinScript = (() => {
  const ts = join(dirname(fileURLToPath(import.meta.url)), "drivers", "playwright-signin.ts");
  return existsSync(ts) ? ts : ts.replace(/\.ts$/, ".js");
})();

export interface ProfileSnapshot {
  /** Cookie domains, not cookies. Never a name or a value. */
  origins: string[];
  at: number;
}

export interface BrowserProfileStatus {
  profilePath: string;
  exists: boolean;
  /** A sign-in window is open right now. */
  signingIn: boolean;
  /** What the profile held the last time a window closed, and when. */
  lastSeen: ProfileSnapshot | null;
  problem?: string;
}

/**
 * Only http(s), and only a URL — this string becomes a navigation in a real
 * browser window carrying the profile's sessions, so a `file://` or a
 * `javascript:` here would be a way to read the machine or run script with
 * those cookies attached.
 */
export function validSignInUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function readSnapshot(): Promise<ProfileSnapshot | null> {
  try {
    const parsed = JSON.parse(await readFile(SNAPSHOT_FILE, "utf8")) as ProfileSnapshot;
    return Array.isArray(parsed?.origins) ? parsed : null;
  } catch {
    return null;
  }
}

let session: { child: ChildProcess; startedAt: number } | null = null;
let lastProblem: string | undefined;

export async function browserProfileStatus(): Promise<BrowserProfileStatus> {
  return {
    profilePath: PROFILE_DIR,
    exists: existsSync(PROFILE_DIR),
    signingIn: Boolean(session && session.child.exitCode === null),
    lastSeen: await readSnapshot(),
    ...(lastProblem ? { problem: lastProblem } : {}),
  };
}

export interface SignInResult {
  ok: boolean;
  problem?: string;
}

/**
 * Open the profile for the user to sign in with.
 *
 * Returns as soon as the window is launched. The window's lifetime is the
 * user's business, not the request's: it stays open until they close it or
 * press Cancel.
 */
export function openSignInWindow(
  url: string,
  { spawnImpl = spawn, execPath = process.execPath }: { spawnImpl?: typeof spawn; execPath?: string } = {},
): SignInResult {
  if (session && session.child.exitCode === null) {
    return { ok: false, problem: "a sign-in window is already open" };
  }
  lastProblem = undefined;
  const child = spawnImpl(execPath, [signinScript], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_OPTIONS: [process.env.NODE_OPTIONS, "--experimental-strip-types"].filter(Boolean).join(" "),
      MAUSCREW_PLAYWRIGHT_PROFILE: PROFILE_DIR,
      MAUSCREW_SIGNIN_URL: url,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  session = { child, startedAt: Date.now() };

  let out = "";
  child.stdout?.on("data", (chunk: Buffer) => {
    out = `${out}${chunk}`.slice(-4000);
  });
  let err = "";
  child.stderr?.on("data", (chunk: Buffer) => {
    err = `${err}${chunk}`.slice(-2000);
  });
  child.on("error", (error) => {
    lastProblem = error.message;
    session = null;
  });
  child.on("exit", () => {
    session = null;
    // The child reports what the profile ended up holding; a run that says
    // nothing leaves the previous snapshot alone rather than blanking it.
    for (const line of out.split("\n").filter(Boolean).reverse()) {
      try {
        const parsed = JSON.parse(line) as { ok?: boolean; origins?: string[]; at?: number; error?: string };
        if (parsed.ok && Array.isArray(parsed.origins)) {
          writeFileAtomic(
            SNAPSHOT_FILE,
            JSON.stringify({ origins: parsed.origins, at: parsed.at ?? Date.now() }, null, 2),
            { mode: 0o600 },
          );
          lastProblem = undefined;
          return;
        }
        if (parsed.error) {
          lastProblem = parsed.error;
          return;
        }
      } catch {
        // Not the report line; keep looking backwards.
      }
    }
    if (err.trim()) lastProblem = err.trim().slice(-300);
  });
  return { ok: true };
}

export function closeSignInWindow(): void {
  session?.child.kill("SIGTERM");
}

/**
 * Delete the profile — every session the bot's browser holds.
 *
 * Refused while a window is open: removing the directory under a running
 * Chromium leaves a profile that is neither the old one nor empty.
 */
export async function forgetBrowserProfile(): Promise<SignInResult> {
  if (session && session.child.exitCode === null) {
    return { ok: false, problem: "close the sign-in window first" };
  }
  await rm(PROFILE_DIR, { recursive: true, force: true });
  await rm(SNAPSHOT_FILE, { force: true });
  lastProblem = undefined;
  return { ok: true };
}
