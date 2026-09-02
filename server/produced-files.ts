// Which files a bot may hand back, and which it may not.
//
// A bot announces what it produced with a `file-list` block, and the paths in
// that block come from model output. Two features now act on those paths —
// a download button in the transcript and an upload to Telegram — so a path
// is no longer just text on screen: it is a file this process will read and
// send somewhere.
//
// That makes containment the whole job. A bot that read a hostile web page
// and came back listing `~/.ssh/id_rsa` as its "report" must get nothing but
// a refusal. So a file is only ever released when it resolves, after symlinks,
// inside one of the workspaces that turn was actually working in.
import { realpathSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

export interface ProducedFile {
  /** The real path on disk, symlinks resolved. */
  path: string;
  bytes: number;
}

/** Windows paths differ only in case; comparing them case-sensitively would
 * let `C:\Users\...` escape a root spelled `c:\users\...`. */
const sameCase = (value: string) => (process.platform === "win32" ? value.toLowerCase() : value);

function realOrNull(path: string): string | null {
  try {
    return realpathSync(path);
  } catch {
    return null;
  }
}

/** Is `target` inside `root`, once both are real? */
export function containedBy(target: string, root: string): boolean {
  const realRoot = realOrNull(root);
  if (!realRoot) return false;
  const rel = relative(sameCase(realRoot), sameCase(target));
  // "" means target IS the root — a directory, not a file we would send.
  // A leading ".." or an absolute result means it escaped.
  return rel !== "" && !rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel);
}

/**
 * Resolve one announced path into a file that may be released, or null.
 *
 * Null covers every refusal on purpose — outside the workspaces, a
 * directory, a dangling symlink, unreadable, or larger than the caller can
 * carry. The caller shows the path instead, which is what the card did before
 * either feature existed.
 */
export function resolveProducedFile(
  announced: string,
  roots: readonly string[],
  { maxBytes = Number.POSITIVE_INFINITY }: { maxBytes?: number } = {},
): ProducedFile | null {
  const trimmed = String(announced ?? "").trim();
  // Relative paths are ambiguous — relative to which root? — and the prompt
  // asks for absolute ones.
  if (!trimmed || !isAbsolute(trimmed)) return null;

  // Resolve symlinks BEFORE the containment test: a link inside the
  // workspace pointing at ~/.ssh is exactly the case a string comparison on
  // the announced path would wave through.
  const real = realOrNull(resolve(trimmed));
  if (!real) return null;

  let stats;
  try {
    stats = statSync(real);
  } catch {
    return null;
  }
  if (!stats.isFile()) return null;
  if (stats.size > maxBytes) return null;

  const usable = roots.map((root) => String(root ?? "").trim()).filter((root) => root && isAbsolute(root));
  if (!usable.some((root) => containedBy(real, root))) return null;

  return { path: real, bytes: stats.size };
}

/** The `file-list` items of a structured block, or an empty list for anything
 * else. Shaped defensively: this reads a validated block, but it is one
 * schema change away from not being one. */
export function fileListItems(ui: { component?: string; props?: Record<string, unknown> } | null | undefined): Array<{
  name: string;
  path: string;
}> {
  if (!ui || ui.component !== "file-list") return [];
  const items = ui.props?.items;
  if (!Array.isArray(items)) return [];
  return items.flatMap((item) => {
    const entry = item && typeof item === "object" && !Array.isArray(item) ? (item as Record<string, unknown>) : {};
    const path = typeof entry.path === "string" ? entry.path : "";
    const name = typeof entry.name === "string" ? entry.name : "";
    return path ? [{ name: name || path.split(/[\\/]/).pop() || "file", path }] : [];
  });
}
