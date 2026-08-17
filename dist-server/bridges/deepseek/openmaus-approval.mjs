/**
 * OpenMausBot approval gate — the runtime's half of the mailbox
 * (spec §37–§43, §82, §87, §95, §103).
 *
 * This is a Cordis plugin. It is loaded by name from `openmaus.cordis.yml`
 * as `./openmaus-approval.mjs`, which app-boot resolves beside the config
 * file, so nothing here has to be published or installed.
 *
 * It is plain JavaScript on purpose. This file executes inside the DeepSeek
 * runtime — a Node process the Python SDK spawns, and on Windows one that
 * lives inside WSL — so it cannot share a module, a type, or a build step
 * with the TypeScript driver on the other side. The mailbox format below is
 * duplicated in `server/drivers/deepseek/approval-mailbox.ts`; the version
 * field is what keeps the two honest, and the driver denies anything whose
 * version it does not recognize.
 *
 * What it does: for every tool call the model makes, decide whether the call
 * is one OpenMausBot's user should see before it happens. If it is, write a
 * request file, block until the driver writes the answer, and turn that
 * answer into a Cordis `PreToolDecision`.
 *
 * Every path that is not an explicit `allow` is a deny (§95): no mailbox, an
 * unwritable directory, a malformed answer, a deadline, an aborted call. The
 * agent never gains a permission by breaking the thing that grants them.
 */

import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'

export const name = 'openmaus-approval'

/** Must match MAILBOX_VERSION in approval-mailbox.ts. */
const MAILBOX_VERSION = 1
const POLL_INTERVAL_MS = 100
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000

/**
 * Tools that change something outside the conversation, keyed by the exact
 * name the runtime registers. Reads are not here: a `read`, a glob, or a
 * search inside a workspace the user already chose is not a decision anyone
 * wants to be asked about a hundred times, and prompting for it is how a
 * permission dialog becomes something people click through (spec §41).
 *
 * The wildcard entries matter more than the literals. `mcp_*` covers every
 * tool a connected app contributes — names this build has never heard of —
 * and the unknown-tool rule below covers the rest.
 */
const DANGEROUS = [
  'bash',
  'pwsh',
  'shell',
  'run_code',
  'write',
  'edit',
  'multi_edit',
  'apply_patch',
  'str_replace',
  'delete',
  'move',
  'web_fetch',
  'mcp_*',
  'subagent*',
]

/**
 * Tools known to be read-only or conversational. Anything in neither list is
 * treated as dangerous — a tool this build does not recognize is exactly the
 * case where guessing "harmless" is the expensive mistake (spec §42).
 */
const SAFE = [
  'read',
  'glob',
  'grep',
  'ls',
  'list',
  'search',
  'fs_search',
  'web_search',
  'todo_write',
  'ask_user_question',
  'exit_plan_mode',
  'skill',
  'goal*',
]

/** `*` is the only metacharacter; everything else is matched literally. */
function toPattern(glob) {
  const escaped = glob.replace(/[.*+?^${}()|[\]\\]/g, ch => (ch === '*' ? '.*' : `\\${ch}`))
  return new RegExp(`^${escaped}$`)
}

const DANGEROUS_PATTERNS = DANGEROUS.map(toPattern)
const SAFE_PATTERNS = SAFE.map(toPattern)

/**
 * Whether a call needs a human. Unknown names land here as `true`.
 * @param {string} toolName
 * @returns {boolean}
 */
export function needsApproval(toolName) {
  const lower = String(toolName || '').toLowerCase()
  if (DANGEROUS_PATTERNS.some(pattern => pattern.test(lower))) return true
  if (SAFE_PATTERNS.some(pattern => pattern.test(lower))) return false
  return true
}

/**
 * One line describing the call, for the approval card. Arguments are the
 * whole point — "run bash" is not a decision anyone can make, "run bash:
 * rm -rf /" is — but they are also model output, so the value is truncated
 * hard and never interpreted.
 */
function summarize(toolName, args) {
  const detail = describeArguments(args)
  return detail ? `${toolName}: ${detail}` : toolName
}

function describeArguments(args) {
  if (typeof args === 'string') return args.slice(0, 300)
  if (typeof args !== 'object' || args === null) return ''
  for (const key of ['command', 'cmd', 'script', 'code', 'path', 'file_path', 'url', 'pattern']) {
    const value = args[key]
    if (typeof value === 'string' && value) return `${key}=${value.slice(0, 300)}`
  }
  try {
    return JSON.stringify(args).slice(0, 300)
  } catch {
    return ''
  }
}

/** Write through a temp name so the driver can never read a partial file. */
function writeAtomic(path, text) {
  const temp = `${path}.${process.pid}.tmp`
  writeFileSync(temp, text, { encoding: 'utf8', mode: 0o600 })
  renameSync(temp, path)
}

function remove(path) {
  try {
    unlinkSync(path)
  } catch {
    /* already gone */
  }
}

/**
 * Block until the file appears or the deadline passes.
 *
 * Synchronous sleeping via Atomics.wait is deliberate. A `tools/pre-execute`
 * listener is awaited by the scheduler, so returning a promise would be the
 * ordinary choice — but this plugin's whole job is to stop the call, and the
 * simplest way to be certain nothing proceeds is not to yield. The runtime is
 * idle during the wait either way: it is waiting on a human.
 */
function sleep(ms) {
  const buffer = new Int32Array(new SharedArrayBuffer(4))
  Atomics.wait(buffer, 0, 0, ms)
}

export const inject = { optional: ['logger'] }

export function apply(ctx, config = {}) {
  const root = config.mailbox || process.env.DSH_OPENMAUS_APPROVAL_DIR || ''
  const configured = Number(config.timeoutMs || process.env.DSH_OPENMAUS_APPROVAL_TIMEOUT_MS)
  const timeoutMs = Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TIMEOUT_MS
  // 'never' is upstream's own vocabulary for "do not prompt anyone"; here it
  // means every dangerous call is refused without a round trip, which is the
  // right answer for an unattended run and the one whose outcome is knowable
  // without asking.
  const policy = config.policy === 'never' ? 'never' : 'ask'

  // No mailbox configured is not "approvals off". It is a broker that cannot
  // be reached, so the gate closes: dangerous tools are refused and the
  // reason says why, rather than the agent quietly getting a free hand.
  const ready = Boolean(root) && ensureDir(root)

  ctx.on('tools/pre-execute', async (exec, next) => {
    const toolName = String(exec?.name || '')
    if (!needsApproval(toolName)) return next()

    if (policy === 'never') {
      return { kind: 'deny', reason: `${toolName} requires approval, and this session runs with approvals disabled.` }
    }
    if (!ready) {
      return {
        kind: 'deny',
        reason: `${toolName} requires approval, but no approval channel is available in this session.`,
      }
    }

    const decision = ask(root, {
      sessionId: String(exec?.agent?.id || ''),
      tool: toolName,
      summary: summarize(toolName, exec?.arguments),
      signal: exec?.signal,
      timeoutMs,
    })
    if (decision.allowed) return next()
    return { kind: 'deny', reason: decision.reason }
  })
}

function ensureDir(root) {
  try {
    mkdirSync(root, { recursive: true })
    return true
  } catch {
    return false
  }
}

/**
 * One round trip. Returns `{allowed}` and, when denied, the sentence the
 * model is told — which is also what the user reads in the transcript, so it
 * says what happened rather than that something "failed".
 */
function ask(root, request) {
  const id = randomUUID()
  const requestPath = join(root, `${id}.req.json`)
  const responsePath = join(root, `${id}.res.json`)

  try {
    writeAtomic(
      requestPath,
      JSON.stringify({
        v: MAILBOX_VERSION,
        id,
        sessionId: request.sessionId,
        tool: request.tool,
        summary: request.summary,
        createdAt: Date.now(),
      }),
    )
  } catch {
    return { allowed: false, reason: `${request.tool} was not run: the approval request could not be delivered.` }
  }

  const deadline = Date.now() + request.timeoutMs
  try {
    for (;;) {
      if (request.signal?.aborted) {
        return { allowed: false, reason: `${request.tool} was not run: the turn was cancelled while waiting for approval.` }
      }
      const answer = readAnswer(responsePath, id)
      if (answer) {
        if (answer.decision === 'allow') return { allowed: true }
        const detail = answer.message ? ` (${answer.message})` : ''
        return { allowed: false, reason: `${request.tool} was not approved${detail}.` }
      }
      if (Date.now() >= deadline) {
        return { allowed: false, reason: `${request.tool} was not run: nobody answered the approval request in time.` }
      }
      sleep(POLL_INTERVAL_MS)
    }
  } finally {
    // The pair is ours to clean up. Leaving a response behind would be an
    // answer sitting in a directory a later request could collide with.
    remove(requestPath)
    remove(responsePath)
  }
}

function readAnswer(path, id) {
  let parsed
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  if (parsed.v !== MAILBOX_VERSION || parsed.id !== id) return null
  if (parsed.decision !== 'allow' && parsed.decision !== 'deny') return null
  return { decision: parsed.decision, message: typeof parsed.message === 'string' ? parsed.message : '' }
}
