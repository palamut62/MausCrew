// Saying what a pasted blob actually is.
//
// Everything dropped into the composer used to arrive as `<pasted-text>`, so a
// stack trace, a CSV export, a git diff and a JSON response all looked
// identical to the model. It would work the kind out anyway, but it spends the
// first part of its answer doing so, and it guesses wrong on the ambiguous
// ones — a log of JSON lines read as prose, a TSV read as a table of nothing.
//
// Each kind of attached thing is labelled so the model reads it in the shape
// it reads best.
//
// Detection is deliberately conservative. A wrong label is worse than none:
// "this is a diff" sends the model looking for hunks that are not there.

export type PasteKind =
  | "stack-trace"
  | "diff"
  | "json"
  | "csv"
  | "log"
  | "markdown-table"
  | "urls"
  | "code"
  | "text";

export interface PasteAnalysis {
  readonly kind: PasteKind;
  /** Only ever set for `code`, and only when the guess is unambiguous. */
  readonly language?: string;
}

const LANGUAGE_HINTS: ReadonlyArray<{ language: string; pattern: RegExp }> = [
  { language: "typescript", pattern: /^\s*(?:import type |interface \w+|type \w+\s*=|export (?:const|function|class|interface|type))/m },
  { language: "python", pattern: /^\s*(?:def \w+\(|class \w+(?:\(|:)|from \w+ import |import \w+$)/m },
  { language: "rust", pattern: /^\s*(?:fn \w+|impl(?:<[^>]*>)? \w+|use \w+::|pub (?:fn|struct|enum))/m },
  { language: "go", pattern: /^\s*(?:func \w+\(|package \w+$|import \(\s*$)/m },
  { language: "sql", pattern: /^\s*(?:SELECT\s+[\s\S]{0,200}?\sFROM\s|INSERT\s+INTO\s|CREATE\s+TABLE\s)/im },
  { language: "shell", pattern: /^\s*(?:#!\/bin\/(?:ba)?sh|\$ \w+|sudo \w+|npm |pnpm |git )/m },
  { language: "javascript", pattern: /^\s*(?:const \w+\s*=|function \w+\(|module\.exports|require\(['"])/m },
];

const looksLikeStackTrace = (text: string) =>
  /^\s*(?:at\s+\S+\s*\(|File "|Traceback \(most recent call last\)|\w+Error:|\w+Exception:)/m.test(text)
  && /(?:\.(?:ts|tsx|js|jsx|py|rs|go|java|rb|cs):\d+|line \d+)/.test(text);

const looksLikeDiff = (text: string) =>
  /^(?:diff --git |@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@|--- a\/|\+\+\+ b\/)/m.test(text);

function looksLikeJson(text: string): boolean {
  const body = text.trim();
  if (!/^[[{]/.test(body) || !/[\]}]$/.test(body)) return false;
  try {
    JSON.parse(body);
    return true;
  } catch {
    return false;
  }
}

/** Log lines carry a timestamp or a level at the start, repeatedly. */
function looksLikeLog(lines: readonly string[]): boolean {
  if (lines.length < 3) return false;
  const marked = lines.filter((line) =>
    /^\s*(?:\[?\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}|\d{2}:\d{2}:\d{2}|\[(?:INFO|WARN|WARNING|ERROR|DEBUG|TRACE)\]|(?:INFO|WARN|WARNING|ERROR|DEBUG|TRACE)\b)/i.test(line),
  );
  return marked.length >= Math.max(3, Math.ceil(lines.length * 0.6));
}

/** Separated values need the SAME count on most rows — one comma is prose. */
function delimiterShape(lines: readonly string[], delimiter: string): boolean {
  if (lines.length < 2) return false;
  const counts = lines.slice(0, 20).map((line) => line.split(delimiter).length - 1);
  const first = counts[0]!;
  if (first < 1) return false;
  return counts.filter((count) => count === first).length >= Math.ceil(counts.length * 0.8);
}

function looksLikeMarkdownTable(lines: readonly string[]): boolean {
  return (
    lines.length >= 2
    && lines[0]!.includes("|")
    && /^\s*\|?[\s:-]*-{3,}[\s:|-]*\|?\s*$/.test(lines[1] ?? "")
  );
}

function looksLikeUrlList(lines: readonly string[]): boolean {
  if (lines.length < 2) return false;
  return lines.every((line) => /^\s*https?:\/\/\S+\s*$/.test(line));
}

function guessLanguage(text: string): string | undefined {
  const hits = LANGUAGE_HINTS.filter(({ pattern }) => pattern.test(text));
  // Two languages matching means the guess is not worth making.
  return hits.length === 1 ? hits[0]!.language : undefined;
}

/**
 * Label a pasted blob. Falls back to "text", which is what it was before, so
 * an unrecognised paste is never worse off than it used to be.
 */
export function analysePaste(text: string): PasteAnalysis {
  const body = text.trim();
  if (!body) return { kind: "text" };
  const lines = body.split("\n").map((line) => line.trimEnd());

  // Order matters: a stack trace contains code, a diff contains both, and a
  // log can contain JSON. The most specific reading wins.
  if (looksLikeStackTrace(body)) return { kind: "stack-trace" };
  if (looksLikeDiff(body)) return { kind: "diff" };
  if (looksLikeJson(body)) return { kind: "json" };
  if (looksLikeMarkdownTable(lines)) return { kind: "markdown-table" };
  if (looksLikeUrlList(lines)) return { kind: "urls" };
  if (looksLikeLog(lines)) return { kind: "log" };
  if (delimiterShape(lines, "\t") || delimiterShape(lines, ",")) return { kind: "csv" };

  const language = guessLanguage(body);
  return language ? { kind: "code", language } : { kind: "text" };
}

/** How each kind is introduced, when saying so helps. */
const GUIDANCE: Partial<Record<PasteKind, string>> = {
  "stack-trace": "An error and its stack. The top frame is usually where to look.",
  diff: "A patch. Lines starting with - are removed and + are added.",
  csv: "Separated values. The first row is probably a header.",
  log: "Log output, oldest line first.",
  urls: "A list of links.",
};

export function pasteGuidance(kind: PasteKind): string | undefined {
  return GUIDANCE[kind];
}
