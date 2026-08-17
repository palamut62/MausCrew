// Approval mailbox — the driver's half (spec §37–§43, §82, §87, §103).
//
// The Cordis plugin that gates tool calls runs inside the DeepSeek runtime,
// which is a Node process the Python SDK spawns — and on Windows that whole
// tree lives inside WSL. So the two halves of an approval cannot talk over
// the bridge's stdio (it belongs to the Python process, and spec §23 reserves
// its stdout for protocol frames), and they cannot talk over a socket either:
// WSL2 is NAT'd, so the guest reaching the host's loopback is unreliable, and
// binding anything wider would put an "allow this tool" endpoint on the
// network. A Unix socket does not cross the boundary at all.
//
// What both halves demonstrably share is the session root: the driver picks
// it, and process-manager already translates it to a path the guest can open.
// So the mailbox is two files in a directory under it. No port, no token, no
// second transport, and identical behaviour native and under WSL.
//
// The protocol is deliberately dumb:
//
//   <root>/approvals/<id>.req.json   written by the plugin, read by us
//   <root>/approvals/<id>.res.json   written by us, read by the plugin
//
// Both sides write to a temp name and rename, so neither can ever read half a
// file. The plugin removes the pair once it has its answer.
//
// Every failure here is a denial. A mailbox that cannot be created, a request
// we cannot parse, a decision that arrives after the deadline: the tool does
// not run. That is the §95 rule stated as code — the permission layer wins
// over the agent's convenience, including when the permission layer is broken.
import { mkdirSync, readdirSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

import { writeFileAtomic } from "../../atomic.ts";

/** Bumped only for an incompatible change. A request carrying anything else
 * is from a build we cannot reason about, so it is denied rather than
 * interpreted. */
export const MAILBOX_VERSION = 1;

export const MAILBOX_DIRNAME = "approvals";

/** How often we look for new requests. A human is on the other end of this
 * wait, so a quarter second is invisible; a watcher would be cheaper and less
 * reliable — fs.watch does not fire dependably for writes that cross the WSL
 * boundary onto /mnt/c, which is exactly the case this has to work in. */
export const POLL_INTERVAL_MS = 250;

/** Only ids we ourselves would accept as a filename. The name is used to
 * build a path, so anything outside this alphabet is a traversal attempt, not
 * a malformed id (spec §81). */
const ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

export interface ApprovalRequest {
  id: string;
  /** The runtime session the call belongs to — `dsh:<instanceId>:<threadId>`.
   * This is how a request finds its thread. */
  sessionId: string;
  tool: string;
  summary: string;
  /** When the plugin wrote the request, as epoch ms. Used only to discard
   * requests older than the deadline. */
  createdAt: number;
}

export type ApprovalDecision = "allow" | "deny";

export interface ApprovalMailboxOptions {
  /** The instance's session root. The mailbox is a directory inside it. */
  sessionRoot: string;
  onRequest: (request: ApprovalRequest) => void;
  /** Requests older than this are answered `deny` and dropped, so a question
   * nobody ever saw cannot sit in the directory authorizing a later run. */
  timeoutMs: number;
  pollIntervalMs?: number;
}

/**
 * Watches the mailbox directory and answers requests.
 *
 * Constructed per provider instance and started lazily — a bot that never
 * runs a turn never creates the directory.
 */
export class ApprovalMailbox {
  readonly dir: string;
  private readonly onRequest: (request: ApprovalRequest) => void;
  private readonly timeoutMs: number;
  private readonly pollIntervalMs: number;
  /** Requests we have already handed upward. The file stays on disk until
   * the plugin cleans it up, so without this every poll would re-announce
   * the same question. */
  private readonly announced = new Map<string, number>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private stopped = false;

  constructor(options: ApprovalMailboxOptions) {
    this.dir = join(options.sessionRoot, MAILBOX_DIRNAME);
    this.onRequest = options.onRequest;
    this.timeoutMs = options.timeoutMs;
    this.pollIntervalMs = options.pollIntervalMs ?? POLL_INTERVAL_MS;
  }

  /** Create the directory and begin polling. Idempotent.
   *
   * Starting also empties the directory (spec §103, P3-08). A response file
   * left behind by a previous run is an answer to a question from a process
   * that no longer exists, and the ids are minted by the plugin: a fresh run
   * could mint the same one and find its permission already granted. Nothing
   * in here outlives the process that wrote it. */
  start(): void {
    if (this.timer || this.stopped) return;
    mkdirSync(this.dir, { recursive: true });
    for (const name of this.list()) {
      try {
        rmSync(join(this.dir, name), { force: true });
      } catch {
        // a file we cannot remove is one we also will not trust: the id
        // filter and the freshness check below both still apply
      }
    }
    this.timer = setInterval(() => this.poll(), this.pollIntervalMs);
    this.timer.unref?.();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.announced.clear();
  }

  /** Answer a request. Writing the file is the whole act — the plugin is
   * blocked on it. Unknown or already-answered ids are ignored rather than
   * thrown, because the caller is the UI and a double-click is not an error. */
  respond(id: string, decision: ApprovalDecision, message?: string): void {
    if (!ID_PATTERN.test(id)) return;
    if (!this.announced.has(id)) return;
    this.announced.delete(id);
    const path = join(this.dir, `${id}.res.json`);
    if (existsSync(path)) return;
    writeFileAtomic(
      path,
      JSON.stringify({ v: MAILBOX_VERSION, id, decision, ...(message ? { message } : {}) }),
      { mode: 0o600 },
    );
  }

  /** Deny everything still open. Called when a turn ends or the instance
   * goes away: a pending question whose asker is gone must resolve, and the
   * only safe resolution is no. */
  denyAll(reason: string): void {
    for (const id of [...this.announced.keys()]) this.respond(id, "deny", reason);
  }

  /** True when this request is still ours to answer. */
  isOpen(id: string): boolean {
    return this.announced.has(id);
  }

  private list(): string[] {
    try {
      return readdirSync(this.dir);
    } catch {
      return [];
    }
  }

  private poll(): void {
    const now = Date.now();

    // Anything we announced but nobody answered in time is denied here. The
    // plugin has its own deadline, but ours is what guarantees the UI card
    // does not outlive the call it belongs to (P3-07).
    for (const [id, at] of [...this.announced]) {
      if (now - at > this.timeoutMs) this.respond(id, "deny", "no answer in time");
    }

    for (const name of this.list()) {
      if (!name.endsWith(".req.json")) continue;
      const id = name.slice(0, -".req.json".length);
      if (!ID_PATTERN.test(id)) continue;
      if (this.announced.has(id)) continue;
      if (existsSync(join(this.dir, `${id}.res.json`))) continue;

      const request = this.read(id);
      if (!request) {
        // Unreadable, wrong version, or wrong shape. Answering `deny` is
        // better than ignoring it: the plugin is waiting, and a denial ends
        // its wait immediately instead of after its whole timeout.
        this.announced.set(id, now);
        this.respond(id, "deny", "the approval request could not be read");
        continue;
      }
      if (now - request.createdAt > this.timeoutMs) {
        this.announced.set(id, now);
        this.respond(id, "deny", "the approval request had already expired");
        continue;
      }
      this.announced.set(id, now);
      try {
        this.onRequest(request);
      } catch {
        // a listener that throws must not stop the poll loop, but it also
        // means nobody is going to answer — so this one dies now
        this.respond(id, "deny", "the approval could not be shown");
      }
    }
  }

  private read(id: string): ApprovalRequest | null {
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(join(this.dir, `${id}.req.json`), "utf8"));
    } catch {
      return null;
    }
    if (typeof raw !== "object" || raw === null) return null;
    const o = raw as Record<string, unknown>;
    if (o.v !== MAILBOX_VERSION) return null;
    if (o.id !== id) return null;
    const sessionId = typeof o.sessionId === "string" ? o.sessionId : "";
    const tool = typeof o.tool === "string" && o.tool ? o.tool : "";
    if (!sessionId || !tool) return null;
    return {
      id,
      sessionId,
      tool,
      summary: typeof o.summary === "string" ? o.summary.slice(0, 400) : "",
      createdAt: typeof o.createdAt === "number" && Number.isFinite(o.createdAt) ? o.createdAt : 0,
    };
  }
}
