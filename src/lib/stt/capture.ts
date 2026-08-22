// Renderer-side microphone tap for Windows speech recognition. The main
// process cannot open a mic on Windows, and the macOS helper is darwin-only,
// so on win32 the bridge hands capture to this module: getUserMedia feeds an
// AudioWorklet that batches PCM into ~128 ms blocks, downsamples to the
// recognizer's 16 kHz mono when the context runs at another rate, and ships
// Float32 buffers over IPC ("speech:audio"). Lifecycle stays owned by the
// main-process session — it sends {cmd:"stop"} through stt:control, and this
// side never emits transcripts itself.
const WORKLET_SOURCE = `
class MauscrewSttTap extends AudioWorkletProcessor {
  constructor() {
    super();
    this.acc = new Float32Array(2048); // ~128 ms at 16 kHz
    this.at = 0;
  }
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) {
      for (let i = 0; i < channel.length; i++) {
        this.acc[this.at++] = channel[i];
        if (this.at === this.acc.length) {
          this.port.postMessage(this.acc.slice(0));
          this.at = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor("mauscrew-stt-tap", MauscrewSttTap);
`;

/** Linear resample to 16 kHz — only used when the AudioContext could not be
 * opened at the recognizer rate directly (Chromium normally honors it). */
function resampleTo16k(input: Float32Array, fromRate: number): Float32Array {
  if (fromRate === 16_000) return input;
  const ratio = fromRate / 16_000;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const pos = i * ratio;
    const left = Math.floor(pos);
    const frac = pos - left;
    const a = input[left] ?? 0;
    const b = input[left + 1] ?? a;
    out[i] = a + (b - a) * frac;
  }
  return out;
}

let teardown: (() => void) | null = null;

async function start(): Promise<void> {
  const bridge = window.mauscrew;
  if (!bridge?.sttAudio || !bridge.registerSttCapture) return;
  teardown?.();

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
  });
  const context = new AudioContext({ sampleRate: 16_000 });
  const blobUrl = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: "application/javascript" }));
  try {
    await context.audioWorklet.addModule(blobUrl);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
  const source = context.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(context, "mauscrew-stt-tap");
  node.port.onmessage = (event) => {
    const block = event.data as Float32Array;
    bridge.sttAudio!(resampleTo16k(block, context.sampleRate).buffer as ArrayBuffer);
  };
  // The tap must not reach the destination: routing mic output to speakers
  // would feed every call its own echo.
  source.connect(node);

  teardown = () => {
    node.port.onmessage = null;
    try {
      source.disconnect();
      node.disconnect();
    } catch {}
    for (const track of stream.getTracks()) track.stop();
    void context.close().catch(() => {});
    teardown = null;
  };
}

function stop(): void {
  teardown?.();
}

/** Wire the tap into the bridge once at app boot; harmless everywhere else
 * (browser dev, macOS, Linux never call into it). */
export function installSttCapture(): void {
  const bridge = window.mauscrew;
  if (!bridge?.registerSttCapture) return;
  bridge.registerSttCapture({ start, stop });
  bridge.onSttControl?.((info) => {
    if (info.cmd === "stop") stop();
  });
}
