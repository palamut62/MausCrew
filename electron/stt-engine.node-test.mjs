import { strict as assert } from "node:assert";
import { test } from "node:test";

import { SAMPLE_RATE, UtteranceTracker, VoiceGate, WavBuilder, rms } from "./stt-engine.mjs";

test("WavBuilder renders a valid 16 kHz mono PCM WAV", () => {
  const wav = new WavBuilder();
  const tone = new Float32Array(SAMPLE_RATE); // one second of half-scale DC
  tone.fill(0.5);
  wav.push(tone);
  const bytes = wav.toWav();
  assert.equal(bytes.readUInt32LE(24), SAMPLE_RATE);
  assert.equal(bytes.readUInt16LE(22), 1);
  assert.equal(bytes.readUInt16LE(34), 16);
  assert.equal(bytes.readUInt32LE(40), SAMPLE_RATE * 2);
  assert.equal(bytes.length, 44 + SAMPLE_RATE * 2);
  // 0.5 float → ~16384 PCM
  assert.ok(Math.abs(bytes.readInt16LE(44) - 16384) <= 1);
});

test("WavBuilder copies pushes, so later mutation cannot rewrite history", () => {
  const wav = new WavBuilder();
  const chunk = new Float32Array([0.5]);
  wav.push(chunk);
  chunk[0] = -1;
  assert.equal(wav.toWav().readInt16LE(44), 16384);
});

test("VoiceGate opens on speech and re-learns a louder floor in silence", () => {
  const gate = new VoiceGate();
  for (let i = 0; i < 200; i++) gate.update(0.001);
  assert.ok(!gate.open);
  assert.ok(gate.update(0.2)); // loud speech opens
  // after sustained quiet at a higher level, the floor climbs and old
  // "speech" levels stop opening the gate
  const gate2 = new VoiceGate({ floorMax: 0.05 });
  for (let i = 0; i < 4000; i++) gate2.update(0.01);
  assert.ok(gate2.floor > 0.008);
  assert.ok(!gate2.update(0.011));
});

test("UtteranceTracker finalizes only after endpoint silence", () => {
  let t = 1_000;
  const tracker = new UtteranceTracker({ now: () => t });
  tracker.begin(t);
  // 2 s voiced audio
  for (let i = 0; i < 20; i++) {
    tracker.append(SAMPLE_RATE / 10, true, t);
    t += 100;
  }
  assert.ok(!tracker.dueFinal(850));
  // 900 ms of silence crosses an 850 ms endpoint
  tracker.append(SAMPLE_RATE / 10, false, t);
  t += 900;
  assert.ok(tracker.dueFinal(850));
});

test("UtteranceTracker partial cadence needs fresh audio, not wall time", () => {
  let t = 0;
  const tracker = new UtteranceTracker({ now: () => t });
  tracker.begin(t);
  assert.ok(!tracker.duePartial(2_000));
  tracker.append(SAMPLE_RATE * 2, true, t); // two fresh seconds
  assert.ok(tracker.duePartial(2_000));
  tracker.markTranscribed(t);
  // silence ticking by must not schedule another transcribe
  t += 60_000;
  assert.ok(!tracker.duePartial(2_000));
});

test("rms measures loudness", () => {
  const quiet = new Float32Array(64);
  assert.equal(rms(quiet), 0);
  const loud = new Float32Array(64).fill(0.5);
  assert.ok(Math.abs(rms(loud) - 0.5) < 1e-9);
});
