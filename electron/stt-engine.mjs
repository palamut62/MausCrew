// Pure decision logic for the Windows speech bridge, kept Electron-free so
// node --test can exercise it headlessly. The Electron-facing half lives in
// speech-win.mjs; everything here is plain data in, plain data out.

/** The recognizer runs on 16 kHz mono — whisper.cpp's native input rate. */
export const SAMPLE_RATE = 16_000;

/**
 * Accumulates mono Float32 samples and renders 16-bit PCM WAV buffers.
 * Copies every push: the renderer reuses its transfer buffers across IPC
 * ticks, so retaining them would silently corrupt earlier audio.
 */
export class WavBuilder {
  constructor() {
    this.chunks = [];
    this.length = 0;
  }

  push(samples) {
    if (!(samples instanceof Float32Array) || samples.length === 0) return;
    this.chunks.push(samples.slice());
    this.length += samples.length;
  }

  get seconds() {
    return this.length / SAMPLE_RATE;
  }

  /** Interleaved float samples as one array (for partial snapshots). */
  concat() {
    const out = new Float32Array(this.length);
    let at = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, at);
      at += chunk.length;
    }
    return out;
  }

  /** RIFF/WAVE bytes: 16-bit PCM, one channel, 16 kHz. */
  toWav() {
    const pcm = new Int16Array(this.length);
    const floats = this.concat();
    for (let i = 0; i < floats.length; i++) {
      const clamped = Math.max(-1, Math.min(1, floats[i]));
      pcm[i] = Math.round(clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff);
    }
    const header = Buffer.alloc(44);
    header.write("RIFF", 0);
    header.writeUInt32LE(36 + pcm.byteLength, 4);
    header.write("WAVE", 8);
    header.write("fmt ", 12);
    header.writeUInt32LE(16, 16); // PCM chunk size
    header.writeUInt16LE(1, 20); // PCM format
    header.writeUInt16LE(1, 22); // mono
    header.writeUInt32LE(SAMPLE_RATE, 24);
    header.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
    header.writeUInt16LE(2, 32); // block align
    header.writeUInt16LE(16, 34); // bits per sample
    header.write("data", 36);
    header.writeUInt32LE(pcm.byteLength, 40);
    return Buffer.concat([header, Buffer.from(pcm.buffer)]);
  }
}

/** Root-mean-square of a sample block — the cheap loudness proxy the gate
 * and endpointing both run on. */
export function rms(samples) {
  if (!samples || samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length);
}

/**
 * Adaptive voice gate: learns the room's noise floor and opens once
 * loudness clears max(floor × ratio, absMin). The first `warmupUpdates`
 * blocks calibrate unconditionally — without them a steady room hum above
 * the absolute minimum latches the gate open forever and the floor never
 * learns. After warmup the floor only adapts while closed, so sustained
 * speech never raises the bar against itself, and closing uses a lower
 * hysteresis level so one dip between words does not cut an utterance.
 */
export class VoiceGate {
  constructor({ absMin = 0.006, ratio = 3.5, floorMax = 0.05, warmupUpdates = 8 } = {}) {
    this.absMin = absMin;
    this.ratio = ratio;
    this.floorMax = floorMax;
    this.warmup = warmupUpdates;
    this.floor = 0.001;
    this.open = false;
  }

  threshold() {
    return Math.max(this.floor * this.ratio, this.absMin);
  }

  /** Feed one RMS value; returns true while speech is held open. */
  update(level) {
    if (this.warmup > 0) {
      this.warmup -= 1;
      this.floor = Math.min(this.floorMax, Math.max(1e-4, this.floor + (level - this.floor) * 0.25));
      return false;
    }
    const threshold = this.threshold();
    if (this.open) {
      if (level >= threshold * 0.6) return true;
      this.open = false;
    } else if (level >= threshold) {
      this.open = true;
      return true;
    }
    this.floor = Math.min(this.floorMax, Math.max(1e-4, this.floor + (level - this.floor) * 0.05));
    return false;
  }
}

/**
 * Timing decisions for one utterance: when to snapshot a partial and when
 * silence has gone on long enough to finalize. Clock comes in so tests can
 * drive time by hand.
 */
export class UtteranceTracker {
  constructor({ now, maxSeconds = 30 } = {}) {
    this.now = now ?? (() => Date.now());
    this.maxSeconds = maxSeconds;
    this.active = false;
    this.lastVoiceAt = 0;
    this.lastTranscribeAt = 0;
    this.samplesSinceTranscribe = 0;
  }

  begin(at = this.now()) {
    this.active = true;
    this.lastVoiceAt = at;
    this.lastTranscribeAt = 0;
    this.samplesSinceTranscribe = 0;
  }

  append(sampleCount, voiced, at = this.now()) {
    if (!this.active) return;
    if (voiced) this.lastVoiceAt = at;
    this.samplesSinceTranscribe += sampleCount;
  }

  silenceFor(at = this.now()) {
    return this.active ? at - this.lastVoiceAt : Infinity;
  }

  /** A partial is due after `intervalMs` of fresh audio while speaking —
   * not wall-clock since the last one, or silent stretches would trigger
   * empty re-transcribes. */
  duePartial(intervalMs, at = this.now()) {
    if (!this.active || this.samplesSinceTranscribe <= 0) return false;
    const audioMs = (this.samplesSinceTranscribe / SAMPLE_RATE) * 1000;
    if (audioMs < intervalMs) return false;
    if (this.lastTranscribeAt && at - this.lastTranscribeAt < intervalMs) return false;
    return true;
  }

  markTranscribed(at = this.now()) {
    this.lastTranscribeAt = at;
    this.samplesSinceTranscribe = 0;
  }

  /** Finalize when the endpoint silence elapsed or the hard cap hit — an
   * open mic must never buffer minutes of audio waiting for a pause. */
  dueFinal(endpointMs, at = this.now()) {
    if (!this.active) return false;
    return this.silenceFor(at) >= endpointMs || this.secondsOpen() >= this.maxSeconds;
  }

  secondsOpen(at = this.now()) {
    return this.active ? (at - this.lastVoiceAt + this.samplesSinceTranscribe / SAMPLE_RATE * 1000) / 1000 : 0;
  }

  end() {
    this.active = false;
  }
}
