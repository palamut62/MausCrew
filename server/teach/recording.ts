// Watching a workflow happen, rather than reconstructing it afterwards.
//
// The existing draft reads a finished task and infers what the workflow was.
// That loses two things a recipe needs. It cannot tell where the workflow
// starts and ends, so it guesses with a window and picks up whatever else the
// session contained; and by the time it runs, the transcript has already
// reduced each tool call to its bare name, so "ran Bash" is all that survives
// of `git checkout -b release/0.2`.
//
// A recording fixes both by being present while it happens: the user marks the
// boundaries, and each step is captured with the detail the approval card had
// at the time.
//
// Nothing is screen-recorded: the useful record is the sequence of actions,
// not pixels of them.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { DATA_DIR } from "../config.ts";

export const RECORDING_DIR = join(DATA_DIR, "teach-recordings");
/** A recording nobody stopped is an accident, not a demonstration. */
export const MAX_RECORDING_MS = 2 * 60 * 60 * 1000;
export const MAX_STEPS = 400;

export interface RecordedStep {
  readonly at: number;
  readonly kind: "asked" | "action" | "approved" | "said";
  /** Tool or actor, when there is one. */
  readonly tool?: string;
  /** What actually ran — the command, the path, the argument. */
  readonly detail?: string;
  readonly ok?: boolean;
}

export interface Recording {
  readonly botId: string;
  readonly threadId: string;
  readonly startedAt: number;
  readonly label: string;
  steps: RecordedStep[];
  stoppedAt?: number;
}

function path(botId: string) {
  return join(RECORDING_DIR, `${botId.replace(/[^\w-]/g, "")}.json`);
}

function read(botId: string): Recording | null {
  try {
    const file = path(botId);
    if (!existsSync(file)) return null;
    const parsed = JSON.parse(readFileSync(file, "utf8")) as Recording;
    return parsed && Array.isArray(parsed.steps) ? parsed : null;
  } catch {
    return null;
  }
}

function write(recording: Recording | null, botId: string) {
  mkdirSync(RECORDING_DIR, { recursive: true });
  writeFileSync(path(botId), JSON.stringify(recording ?? null), "utf8");
}

/** The live recording for a bot, or null. Expired ones are treated as stopped
 * so a forgotten session cannot keep collecting for days. */
export function active(botId: string, now: number): Recording | null {
  const recording = read(botId);
  if (!recording || recording.stoppedAt) return null;
  if (now - recording.startedAt > MAX_RECORDING_MS) return null;
  return recording;
}

export function start(botId: string, threadId: string, label: string, now: number): Recording {
  const recording: Recording = {
    botId,
    threadId,
    startedAt: now,
    label: label.trim().slice(0, 120) || "Recorded workflow",
    steps: [],
  };
  write(recording, botId);
  return recording;
}

export function stop(botId: string, now: number): Recording | null {
  const recording = read(botId);
  if (!recording) return null;
  const stopped = { ...recording, stoppedAt: recording.stoppedAt ?? now };
  write(stopped, botId);
  return stopped;
}

export function discard(botId: string): void {
  write(null, botId);
}

/** Most recent recording whether or not it is still running. */
export function last(botId: string): Recording | null {
  return read(botId);
}

/**
 * Add a step, if this bot is recording and the step is on the recorded thread.
 *
 * Silently ignores everything else: a recording follows one demonstration, and
 * work the bot does elsewhere in the meantime is not part of it.
 */
export function record(botId: string, threadId: string, step: RecordedStep, now: number): void {
  const recording = active(botId, now);
  if (!recording || recording.threadId !== threadId) return;
  if (recording.steps.length >= MAX_STEPS) return;
  const detail = step.detail?.trim();
  const previous = recording.steps.at(-1);
  // A retried tool call arrives as the same step twice; a recipe that says to
  // do it twice is wrong.
  if (previous && previous.kind === step.kind && previous.tool === step.tool && previous.detail === detail) {
    return;
  }
  recording.steps.push({ ...step, ...(detail ? { detail } : {}) });
  write(recording, botId);
}
