// Windows speech bridge — the win32 counterpart of the macOS helper in
// speech.mjs, speaking the exact same renderer contract: speech:transcript
// {text, partial} lines plus speech:end {code, reason}. Node cannot open a
// microphone, so capture lives in the renderer (src/lib/stt/capture.ts):
// getUserMedia feeds 16 kHz mono Float32 chunks over IPC ("speech:audio"),
// and this side gates them with a voice detector, buffers utterances and
// runs whisper-cli.exe against temp WAVs. The binary ships in ggml-org's
// whisper.cpp release zip and the model comes from HuggingFace — both
// downloaded once, on first use, into userData/speech/.
import { spawn, spawnSync } from "node:child_process";
import {
  closeSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  rmSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { app } from "electron";

import { UtteranceTracker, VoiceGate, WavBuilder, rms } from "./stt-engine.mjs";

const WHISPER_TAG = "b4938";
const BIN_URL = `https://github.com/ggml-org/whisper.cpp/releases/download/${WHISPER_TAG}/whisper-bin-x64.zip`;
const MODEL_URL = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin";
const EXE_NAME = "whisper-cli.exe";
const MODEL_NAME = "ggml-base.bin";
const PARTIAL_INTERVAL_MS = 2_000;
/** Dictation chunks roll over at this length so a long draft cannot keep
 * re-transcribing an ever-growing WAV every partial tick. */
const MAX_CHUNK_SECONDS = 30;
const TRANSCRIBE_TIMEOUT_MS = 90_000;

export function speechDir() {
  return path.join(app.getPath("userData"), "speech");
}

function exePath() {
  return path.join(speechDir(), EXE_NAME);
}

function modelPath() {
  return path.join(speechDir(), MODEL_NAME);
}

/** One global download — two sessions racing would corrupt both files. */
let ensuring = null;

function reportStatus(win, label, percent) {
  if (win && !win.isDestroyed()) win.webContents.send("stt:status", { label, percent });
}

async function downloadTo(url, dest, win, label) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok || !res.body) throw new Error(`download failed: HTTP ${res.status}`);
  const total = Number(res.headers.get("content-length")) || 0;
  let done = 0;
  let lastPercent = -10;
  const out = openSync(dest, "w");
  try {
    for await (const chunk of Readable.fromWeb(res.body)) {
      writeSync(out, chunk);
      done += chunk.length;
      if (total > 0) {
        const percent = Math.floor((done / total) * 100);
        if (percent >= lastPercent + 10) {
          lastPercent = percent;
          reportStatus(win, label, percent);
        }
      }
    }
  } finally {
    closeSync(out);
  }
}

/** Expand-Archive handles any nesting the upstream zip picks; flatten the
 * exe and its DLLs to the speech dir root afterwards. */
function extractBinaries(zipPath) {
  const stage = mkdtempSync(path.join(app.getPath("temp"), "mauscrew-whisper-"));
  try {
    spawnSync("powershell.exe", [
      "-NoProfile", "-NonInteractive", "-Command",
      "Expand-Archive", "-LiteralPath", zipPath, "-DestinationPath", stage, "-Force",
    ], { timeout: 120_000, windowsHide: true });
    const flat = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) flat(full);
        else if (/\.(exe|dll)$/i.test(entry.name)) {
          cpSync(full, path.join(speechDir(), entry.name));
        }
      }
    };
    flat(stage);
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}

/** Make sure whisper-cli.exe and the model exist, downloading what's missing.
 * Resolves true when ready; throws with a readable reason otherwise. */
export async function ensureSpeechFiles(win) {
  if (existsSync(exePath()) && existsSync(modelPath())) return true;
  mkdirSync(speechDir(), { recursive: true });
  if (!ensuring) {
    ensuring = (async () => {
      const zip = path.join(app.getPath("temp"), "whisper-bin-x64.zip");
      if (!existsSync(exePath())) {
        await downloadTo(BIN_URL, zip, win, "recognizer");
        extractBinaries(zip);
        try { unlinkSync(zip); } catch {}
      }
      if (!existsSync(modelPath())) {
        await downloadTo(MODEL_URL, modelPath(), win, "model");
      }
    })().finally(() => {
      ensuring = null;
    });
  }
  await ensuring;
  if (!existsSync(exePath()) || !existsSync(modelPath())) {
    throw new Error("speech files missing after setup");
  }
  return true;
}

/**
 * One listening session. Mirrors the macOS helper's modes: endpointMs > 0
 * loops finalized per-utterance transcripts for call view; endpointMs == 0
 * streams cumulative partials for composer dictation until stopped, and
 * finish() flushes one final transcript (push-to-talk release). Every
 * transcription serializes through one promise chain — a slow whisper run
 * never stacks a second one on top of it.
 */
class WinSession {
  constructor(win, { endpointMs = 0, lang } = {}) {
    this.win = win;
    this.endpointMs = endpointMs;
    this.lang = lang;
    this.buffer = new WavBuilder();
    this.gate = new VoiceGate();
    this.tracker = new UtteranceTracker();
    // text already committed in continuous (dictation) mode
    this.committed = "";
    this.chain = Promise.resolve();
    this.finished = false;
    this.stopped = false;
    this.tempDir = mkdtempSync(path.join(app.getPath("temp"), "mauscrew-stt-"));
    this.seq = 0;
  }

  emit(line) {
    if (this.stopped || this.win.isDestroyed()) return;
    this.win.webContents.send("speech:transcript", line);
  }

  /** Feed one 16 kHz mono Float32 block straight from the worklet tap. */
  push(samples) {
    if (this.stopped || this.finished) return;
    const level = rms(samples);
    const voiced = this.gate.update(level);
    if (!this.tracker.active && voiced) this.tracker.begin();
    if (!this.tracker.active) return;
    this.buffer.push(samples);
    this.tracker.append(samples.length, voiced);

    if (this.tracker.duePartial(PARTIAL_INTERVAL_MS)) {
      this.requestTranscribe(this.endpointMs === 0);
    } else if (this.endpointMs === 0 && this.buffer.seconds >= MAX_CHUNK_SECONDS) {
      this.requestTranscribe(true);
    }
    if (this.endpointMs > 0 && this.tracker.dueFinal(this.endpointMs)) {
      this.requestTranscribe(false);
    }
  }

  requestTranscribe(asPartial) {
    if (this.stopped || this.finished) return;
    this.chain = this.chain
      .then(() => this.transcribe(asPartial))
      .catch(() => {});
  }

  async transcribe(asPartial) {
    if (this.stopped || this.finished || this.buffer.seconds < 0.35) return;
    const wavPath = path.join(this.tempDir, `chunk-${++this.seq}.wav`);
    try {
      writeFileSync(wavPath, this.buffer.toWav());
      const text = await runWhisper(exePath(), modelPath(), wavPath, this.lang);
      if (text && !this.stopped && !this.finished) {
        if (this.endpointMs > 0) {
          // call view: every finalized utterance is its own spoken turn
          this.emit({ text, partial: Boolean(asPartial) });
        } else if (asPartial) {
          // dictation replaces the whole draft each event, so partials are
          // cumulative across chunks
          this.emit({ text: (this.committed + " " + text).trim(), partial: true });
        } else {
          const joined = (this.committed + " " + text).trim();
          this.committed = joined;
          this.emit({ text: joined, partial: false });
        }
      }
    } catch {
      // transient recognizer failure: drop this chunk, keep the mic alive
    } finally {
      try { unlinkSync(wavPath); } catch {}
      // consumed either way — the next word opens a fresh utterance, which
      // is what bounds memory and keeps turns self-contained
      this.buffer = new WavBuilder();
      this.tracker.end();
    }
  }

  /** Push-to-talk release / composer finish: settle the chain, flush the
   * remainder as one final, then end with the macOS "completed" code. */
  async finish() {
    if (this.finished || this.stopped) return;
    this.finished = true;
    this.tracker.end();
    await this.chain;
    if (this.buffer.seconds >= 0.35) {
      await this.transcribe(false).catch(() => {});
    } else if (this.endpointMs === 0 && this.committed) {
      // nothing new since the last partial — promote it to the final
      this.emit({ text: this.committed.trim(), partial: false });
    }
    this.teardown();
    if (!this.win.isDestroyed()) {
      this.win.webContents.send("speech:end", { code: 0, reason: "completed" });
    }
  }

  /** Silent teardown — intentional stops (barge-in muting, toggling the
   * composer mic) must never masquerade as a natural end of speech. */
  stop() {
    this.stopped = true;
    this.teardown();
  }

  teardown() {
    this.tracker.end();
    try { rmSync(this.tempDir, { recursive: true, force: true }); } catch {}
  }
}

/** Run whisper-cli on one WAV; resolves trimmed text or "". */
function runWhisper(exe, model, wavPath, lang) {
  return new Promise((resolve, reject) => {
    const args = ["-m", model, "-f", wavPath, "-nt", "-np", "-t", String(Math.min(8, os.cpus()?.length ?? 4))];
    if (lang) args.push("-l", lang);
    const child = spawn(exe, args, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let settled = false;
    const timer = setTimeout(() => {
      try { child.kill(); } catch {}
    }, TRANSCRIBE_TIMEOUT_MS);
    timer.unref?.();
    child.stdout.on("data", (d) => {
      stdout += d.toString("utf8");
    });
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(stdout.replace(/\s+/g, " ").trim());
    });
  });
}

let session = null;

function controlStop(win) {
  if (win && !win.isDestroyed()) win.webContents.send("stt:control", { cmd: "stop" });
}

export const winStt = {
  /** Called on speech:start. Resolves once the recognizer files exist, so
   * the bridge can start renderer-side capture exactly then. */
  async start(win, options = {}) {
    if (process.platform !== "win32") return null;
    if (session) {
      const stale = session;
      session = null;
      stale.stop();
      controlStop(stale.win);
    }
    const requested = Number(options?.endpointMs);
    const endpointMs = Number.isFinite(requested) && requested > 0
      ? Math.min(5_000, Math.max(250, Math.round(requested)))
      : 0;
    await ensureSpeechFiles(win);
    if (win.isDestroyed()) return null;
    session = new WinSession(win, { endpointMs, lang: options?.lang });
    return { mode: "renderer" };
  },

  /** Audio from the renderer tap, transferred as an ArrayBuffer. */
  pushAudio(chunk) {
    if (session) session.push(new Float32Array(chunk));
  },

  stop() {
    const current = session;
    session = null;
    if (current) {
      current.stop();
      controlStop(current.win);
    }
  },

  async finish() {
    const current = session;
    session = null;
    if (current) {
      await current.finish();
      controlStop(current.win);
    }
  },
};

if (process.platform === "win32") {
  // quit-time safety: the same guarantee main.mjs applies to the macOS helper
  app.on("will-quit", () => {
    winStt.stop();
  });
}
