// Workspace-scoped SKILL.md management.
//
// The DeepSeek skill provider discovers `<project>/.agents/skills/<name>/SKILL.md`.
// This module owns only that direct, portable bundle shape. Every path segment
// is validated and existing symlinks/junctions are rejected before reads,
// writes, or recursive deletion so a skill name can never escape the selected
// workspace.
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

import { writeFileAtomic } from "./atomic.ts";

const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_NAME = 64;
const MAX_DESCRIPTION = 500;
const MAX_WHEN_TO_USE = 1_000;
const MAX_INSTRUCTIONS = 128 * 1024;
const MAX_FILE = 256 * 1024;
const KNOWN_KEYS = new Set([
  "name",
  "description",
  "whenToUse",
  "disable-model-invocation",
  "user-invocable",
  "disableModelInvocation",
  "modelInvocable",
  "userInvocable",
]);

export class SkillStoreError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface SkillInput {
  name: string;
  description: string;
  whenToUse?: string;
  instructions: string;
  userInvocable?: boolean;
  modelInvocable?: boolean;
}

export interface ManagedSkill {
  id: string;
  name: string;
  description: string;
  whenToUse: string;
  instructions: string;
  userInvocable: boolean;
  modelInvocable: boolean;
  valid: boolean;
  diagnostic?: string;
}

interface ParsedDocument extends Omit<ManagedSkill, "id" | "valid" | "diagnostic"> {
  unknownFrontmatter: string[];
  hasFrontmatter: boolean;
  diagnostics: string[];
}

function assertSkillName(value: unknown): string {
  if (typeof value !== "string") throw new SkillStoreError(400, "skill name must be a string");
  const name = value.trim();
  if (!name || name.length > MAX_NAME || !NAME_RE.test(name)) {
    throw new SkillStoreError(400, "skill name must be 1-64 lowercase kebab-case characters");
  }
  return name;
}

function textField(value: unknown, field: string, max: number, required: boolean): string {
  if (typeof value !== "string") throw new SkillStoreError(400, `${field} must be a string`);
  const text = value.trim();
  if (required && !text) throw new SkillStoreError(400, `${field} is required`);
  if (text.length > max) throw new SkillStoreError(400, `${field} is too long`);
  return text;
}

export function validateSkillInput(raw: unknown): SkillInput {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new SkillStoreError(400, "skill body must be an object");
  }
  const value = raw as Record<string, unknown>;
  if (value.userInvocable !== undefined && typeof value.userInvocable !== "boolean") {
    throw new SkillStoreError(400, "userInvocable must be true or false");
  }
  if (value.modelInvocable !== undefined && typeof value.modelInvocable !== "boolean") {
    throw new SkillStoreError(400, "modelInvocable must be true or false");
  }
  return {
    name: assertSkillName(value.name),
    description: textField(value.description, "description", MAX_DESCRIPTION, true),
    whenToUse: textField(value.whenToUse ?? "", "whenToUse", MAX_WHEN_TO_USE, false),
    instructions: textField(value.instructions, "instructions", MAX_INSTRUCTIONS, true),
    userInvocable: value.userInvocable ?? true,
    modelInvocable: value.modelInvocable ?? true,
  };
}

function ensureDirectory(path: string): void {
  if (existsSync(path)) {
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) throw new SkillStoreError(409, `skill path may not be a symbolic link: ${path}`);
    if (!stat.isDirectory()) throw new SkillStoreError(409, `skill path is not a directory: ${path}`);
    return;
  }
  mkdirSync(path, { mode: 0o700 });
}

function isWithin(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

/** Create and resolve the one workspace-owned root this manager may touch. */
export function skillRootForWorkspace(workspacePath: string): string {
  if (!workspacePath || !isAbsolute(workspacePath)) {
    throw new SkillStoreError(409, "choose an absolute workspace before managing skills");
  }
  mkdirSync(workspacePath, { recursive: true, mode: 0o700 });
  const workspaceReal = realpathSync(workspacePath);
  const agents = join(workspacePath, ".agents");
  ensureDirectory(agents);
  const agentsReal = realpathSync(agents);
  if (!isWithin(workspaceReal, agentsReal)) throw new SkillStoreError(409, ".agents escapes the selected workspace");
  const root = join(agents, "skills");
  ensureDirectory(root);
  const rootReal = realpathSync(root);
  if (!isWithin(agentsReal, rootReal)) throw new SkillStoreError(409, "skills escapes the selected workspace");
  return rootReal;
}

function skillDirectory(root: string, id: string, create: boolean): string {
  const name = assertSkillName(id);
  const target = join(root, name);
  if (!existsSync(target)) {
    if (!create) throw new SkillStoreError(404, `skill "${name}" does not exist`);
    mkdirSync(target, { mode: 0o700 });
  }
  const stat = lstatSync(target);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new SkillStoreError(409, "skill bundle must be a real directory");
  const real = realpathSync(target);
  if (dirname(real) !== root) throw new SkillStoreError(409, "skill bundle escapes the skills directory");
  return real;
}

function readSkillFile(path: string): string {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new SkillStoreError(409, "SKILL.md must be a regular file");
  if (stat.size > MAX_FILE) throw new SkillStoreError(413, "SKILL.md is too large to manage in the app");
  return readFileSync(path, "utf8");
}

function scalar(value: string | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (raw.startsWith('"')) {
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === "string" ? parsed : raw;
    } catch {
      return raw;
    }
  }
  if (raw.startsWith("'") && raw.endsWith("'")) return raw.slice(1, -1).replace(/''/g, "'");
  return raw.replace(/\s+#.*$/, "").trim();
}

function boolScalar(value: string | undefined, fallback: boolean): { value: boolean; valid: boolean } {
  if (value === undefined) return { value: fallback, valid: true };
  const raw = scalar(value).toLowerCase();
  if (["true", "yes", "on", "1"].includes(raw)) return { value: true, valid: true };
  if (["false", "no", "off", "0"].includes(raw)) return { value: false, valid: true };
  return { value: false, valid: false };
}

function parseSkillDocument(text: string, fallbackName: string): ParsedDocument {
  const normalized = text.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  if (lines[0]?.trim() !== "---") {
    return {
      name: fallbackName,
      description: "",
      whenToUse: "",
      instructions: normalized.trim(),
      userInvocable: true,
      modelInvocable: true,
      unknownFrontmatter: [],
      hasFrontmatter: false,
      diagnostics: [],
    };
  }
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (end < 0) {
    return {
      name: fallbackName,
      description: "",
      whenToUse: "",
      instructions: normalized.trim(),
      userInvocable: true,
      modelInvocable: true,
      unknownFrontmatter: [],
      hasFrontmatter: false,
      diagnostics: [],
    };
  }
  const frontmatter = lines.slice(1, end);
  const values = new Map<string, string>();
  const unknown: string[] = [];
  let skippingKnownBlock = false;
  for (const line of frontmatter) {
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (match) {
      const [, key, value] = match;
      skippingKnownBlock = KNOWN_KEYS.has(key);
      if (skippingKnownBlock) values.set(key, value);
      else unknown.push(line);
      continue;
    }
    if (!skippingKnownBlock) unknown.push(line);
  }
  const disableModel = boolScalar(values.get("disable-model-invocation"), false);
  const userInvocable = boolScalar(values.get("user-invocable"), true);
  const diagnostics: string[] = [];
  if (!disableModel.valid) diagnostics.push("disable-model-invocation must be a boolean");
  if (!userInvocable.valid) diagnostics.push("user-invocable must be a boolean");
  const legacy = ["disableModelInvocation", "modelInvocable", "userInvocable"].filter((key) => values.has(key));
  if (legacy.length) diagnostics.push(`unsupported invocation field: ${legacy.join(", ")}`);
  const invocationValid = disableModel.valid && userInvocable.valid && legacy.length === 0;
  return {
    name: scalar(values.get("name")) || fallbackName,
    description: scalar(values.get("description")),
    whenToUse: scalar(values.get("whenToUse")),
    instructions: lines.slice(end + 1).join("\n").trim(),
    userInvocable: invocationValid ? userInvocable.value : false,
    modelInvocable: invocationValid ? !disableModel.value : false,
    unknownFrontmatter: unknown,
    hasFrontmatter: true,
    diagnostics,
  };
}

function renderSkillDocument(skill: SkillInput, unknownFrontmatter: string[] = []): string {
  const known = [
    `name: ${JSON.stringify(skill.name)}`,
    `description: ${JSON.stringify(skill.description)}`,
    ...(skill.whenToUse ? [`whenToUse: ${JSON.stringify(skill.whenToUse)}`] : []),
    `disable-model-invocation: ${skill.modelInvocable === false ? "true" : "false"}`,
    `user-invocable: ${skill.userInvocable === false ? "false" : "true"}`,
  ];
  const preserved = unknownFrontmatter.filter((line, index, all) => line.trim() || (index > 0 && all[index - 1]?.trim()));
  return ["---", ...known, ...preserved.length ? ["", ...preserved] : [], "---", "", skill.instructions.trim(), ""].join("\n");
}

function toManaged(id: string, parsed: ParsedDocument): ManagedSkill {
  const problems = [...parsed.diagnostics];
  if (!NAME_RE.test(parsed.name) || parsed.name.length > MAX_NAME) problems.push("frontmatter name is not kebab-case");
  if (!parsed.description) problems.push("description is missing");
  if (!parsed.instructions) problems.push("instructions are missing");
  if (!parsed.hasFrontmatter) problems.push("YAML frontmatter is missing or incomplete");
  return {
    id,
    name: parsed.name,
    description: parsed.description,
    whenToUse: parsed.whenToUse,
    instructions: parsed.instructions,
    userInvocable: parsed.userInvocable,
    modelInvocable: parsed.modelInvocable,
    valid: problems.length === 0,
    ...(problems.length ? { diagnostic: problems.join("; ") } : {}),
  };
}

export function listWorkspaceSkills(workspacePath: string): { rootPath: string; skills: ManagedSkill[] } {
  const root = skillRootForWorkspace(workspacePath);
  const skills: ManagedSkill[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.isSymbolicLink() || !NAME_RE.test(entry.name)) continue;
    const path = join(root, entry.name, "SKILL.md");
    if (!existsSync(path)) continue;
    try {
      skills.push(toManaged(entry.name, parseSkillDocument(readSkillFile(path), entry.name)));
    } catch (error) {
      skills.push({
        id: entry.name,
        name: entry.name,
        description: "",
        whenToUse: "",
        instructions: "",
        userInvocable: true,
        modelInvocable: true,
        valid: false,
        diagnostic: error instanceof Error ? error.message : String(error),
      });
    }
  }
  skills.sort((a, b) => a.name.localeCompare(b.name));
  return { rootPath: root, skills };
}

/** Read-only sibling of listWorkspaceSkills, for the turn path.
 *
 * listWorkspaceSkills creates `<workspace>/.agents/skills` as a side effect,
 * which is right when the user opens the Skill Center and wrong on every
 * turn: it would litter a directory tree under every bot that never uses
 * skills. This one touches nothing and reports "no skills" instead. */
export function readWorkspaceSkills(workspacePath: string): { rootPath: string; skills: ManagedSkill[] } {
  const root = join(workspacePath, ".agents", "skills");
  if (!workspacePath || !isAbsolute(workspacePath) || !existsSync(root)) return { rootPath: root, skills: [] };
  try {
    return listWorkspaceSkills(workspacePath);
  } catch {
    // A malformed or unsafe skills directory must not take the turn down —
    // the Skill Center is where the user gets told about it.
    return { rootPath: root, skills: [] };
  }
}

/** The skill index handed to engines that do not discover skills themselves.
 *
 * Without this, a SKILL.md the user wrote (or taught from a task) sits on
 * disk and is invisible to the bot that owns it — which looks exactly like
 * the skill being broken, with nothing in the UI to explain why. Returns ""
 * when there is nothing usable, so the caller can concatenate it blind. */
/**
 * Ceiling for the whole catalog, in characters.
 *
 * The index is prepended to every single turn, so its size is a tax on every
 * request for as long as the skill exists. Unbounded, twenty skills is four
 * kilobytes a turn and fifty is ten — paid forever, invisibly, to advertise
 * skills most turns will never use. A cap turns that into a fixed cost.
 */
export const SKILL_INDEX_BUDGET_CHARS = 3_000;
/** A description shorter than this says nothing; drop the skill instead. */
const MIN_USEFUL_DESCRIPTION = 32;

/** One catalog entry, kept in parts so trimming never eats the path. */
interface SkillEntry {
  readonly name: string;
  readonly description: string;
  readonly whenUse: string;
  readonly path: string;
}

const renderEntry = (entry: SkillEntry, description: string, whenUse: string) =>
  ` • ${entry.name} — ${description}${whenUse} [${entry.path}]`;

/**
 * Fit the catalog into its budget, losing detail before losing skills.
 *
 * Order matters. A skill the agent cannot see it has is worse than one it can
 * see but must open to understand, so `whenToUse` goes first, then long
 * descriptions are trimmed, and only then are the last entries dropped.
 *
 * The name and the path are never trimmed. An entry without its path is worse
 * than no entry at all: the agent knows a skill exists, cannot open it, and
 * has no way to find out what it says.
 */
function fitToBudget(entries: readonly SkillEntry[]): string {
  const total = (list: readonly string[]) => list.reduce((n, line) => n + line.length, 0);

  const full = entries.map((entry) => renderEntry(entry, entry.description, entry.whenUse));
  if (total(full) <= SKILL_INDEX_BUDGET_CHARS) return full.join("");

  // 1. drop the "use when" clauses; the description still identifies the skill
  const withoutWhen = entries.map((entry) => renderEntry(entry, entry.description, ""));
  if (total(withoutWhen) <= SKILL_INDEX_BUDGET_CHARS) return withoutWhen.join("");

  // 2. trim descriptions towards an equal share of what is left after the
  //    fixed cost of every name and path, which cannot be given up
  const fixed = total(entries.map((entry) => renderEntry(entry, "", "")));
  const room = SKILL_INDEX_BUDGET_CHARS - fixed;
  const share = Math.floor(room / Math.max(1, entries.length));
  if (share >= MIN_USEFUL_DESCRIPTION) {
    const trimmed = entries.map((entry) =>
      renderEntry(
        entry,
        entry.description.length > share ? `${entry.description.slice(0, share - 1)}…` : entry.description,
        "",
      ),
    );
    if (total(trimmed) <= SKILL_INDEX_BUDGET_CHARS) return trimmed.join("");
  }

  // 3. only now lose skills, and say how many
  const kept: string[] = [];
  let used = 0;
  for (const entry of entries) {
    const line = renderEntry(
      entry,
      entry.description.length > MIN_USEFUL_DESCRIPTION
        ? `${entry.description.slice(0, MIN_USEFUL_DESCRIPTION - 1)}…`
        : entry.description,
      "",
    );
    if (used + line.length > SKILL_INDEX_BUDGET_CHARS) break;
    kept.push(line);
    used += line.length;
  }
  const dropped = entries.length - kept.length;
  if (!dropped) return kept.join("");
  return `${kept.join("")} (…and ${dropped} more skill${dropped === 1 ? "" : "s"} not listed here — read the skills directory if none of the above fits.)`;
}

export function skillIndexPrompt(workspacePath: string): string {
  const { rootPath, skills } = readWorkspaceSkills(workspacePath);
  // A malformed bundle is a Skill Center problem; advertising it here would
  // send the agent to read a file that cannot be followed.
  const usable = skills.filter((skill) => skill.valid && skill.modelInvocable);
  if (!usable.length) return "";
  const entries: SkillEntry[] = usable.map((skill) => ({
    name: skill.name,
    description: skill.description,
    whenUse: skill.whenToUse ? ` Use when: ${skill.whenToUse}` : "",
    path: join(rootPath, skill.name, "SKILL.md"),
  }));
  return (
    " This workspace has saved skills: reusable procedures for work already done once and worth repeating the same way." +
    " Before starting a task, check whether one applies. If one does, read that SKILL.md in full and follow it as your first action — never just name a skill without opening it." +
    " Your own instructions from the user outrank a skill; a skill you have opened outranks your own judgement where they do not conflict." +
    fitToBudget(entries)
  );
}

export function createWorkspaceSkill(workspacePath: string, raw: unknown): ManagedSkill {
  const input = validateSkillInput(raw);
  const root = skillRootForWorkspace(workspacePath);
  const target = join(root, input.name);
  if (existsSync(target)) throw new SkillStoreError(409, `skill "${input.name}" already exists`);
  const dir = skillDirectory(root, input.name, true);
  writeFileAtomic(join(dir, "SKILL.md"), renderSkillDocument(input), { mode: 0o600 });
  return toManaged(input.name, parseSkillDocument(readSkillFile(join(dir, "SKILL.md")), input.name));
}

export function updateWorkspaceSkill(workspacePath: string, id: string, raw: unknown): ManagedSkill {
  const input = validateSkillInput(raw);
  const skillId = assertSkillName(id);
  if (input.name !== skillId) throw new SkillStoreError(400, "renaming a skill requires creating a new skill");
  const root = skillRootForWorkspace(workspacePath);
  const dir = skillDirectory(root, skillId, false);
  const path = join(dir, "SKILL.md");
  const existing = existsSync(path) ? parseSkillDocument(readSkillFile(path), skillId) : null;
  writeFileAtomic(path, renderSkillDocument(input, existing?.unknownFrontmatter), { mode: 0o600 });
  return toManaged(skillId, parseSkillDocument(readSkillFile(path), skillId));
}

export function deleteWorkspaceSkill(workspacePath: string, id: string): void {
  const root = skillRootForWorkspace(workspacePath);
  const dir = skillDirectory(root, id, false);
  // Re-resolve immediately before recursive deletion. `skillDirectory`
  // proves the exact target is one direct child of the verified root.
  const real = realpathSync(dir);
  if (dirname(real) !== root || resolve(real) === resolve(root)) {
    throw new SkillStoreError(409, "refusing to delete an unsafe skill path");
  }
  rmSync(real, { recursive: true, force: false, maxRetries: 3, retryDelay: 50 });
}

export function skillFileMode(workspacePath: string, id: string): number {
  const root = skillRootForWorkspace(workspacePath);
  const path = join(skillDirectory(root, id, false), "SKILL.md");
  return statSync(path).mode;
}
