// The narrow bridge the Electron preload exposes. Absent in the browser.
export {};

declare global {
  type DesktopCapabilities = {
    host: {
      platform: "darwin" | "linux" | "win32" | "other";
      label: string;
      session: "x11" | "wayland" | "headless" | "unknown";
      packaged: boolean;
    };
    windowChrome: "mac-inset" | "native";
    screenPreview: {
      available: boolean;
      interaction: "direct" | "portal-picker" | "none";
      reasonCode?: string;
    };
    dictation: {
      available: boolean;
      engine: "apple-speech" | "whisper-local" | "none";
      onDevice: boolean;
      reasonCode?: string;
    };
    localComputer: {
      available: boolean;
      support: "supported" | "limited" | "unsupported";
      reasonCode?: string;
    };
  };

  interface Window {
    mauscrew?: {
      platform: NodeJS.Platform;
      getCapabilities(): Promise<DesktopCapabilities>;
      screenFrame(): Promise<string | null>;
      /** Start native dictation. Call mode supplies endpointMs so silence
       * finalizes a turn; composer dictation omits it and remains manual. */
      speechStart(options?: { endpointMs?: number }): Promise<void>;
      speechStop(): Promise<void>;
      /** Finish capture and emit the recognizer's final transcript. */
      speechFinish?(): Promise<void>;
      onSpeechTranscript(
        cb: (line: { partial?: boolean; text?: string; error?: string }) => void,
      ): () => void;
      onSpeechEnd(cb: (info: { code: number | null; reason?: string }) => void): () => void;
      /** Windows speech capture (see src/lib/stt/capture.ts). The app
       * registers a mic tap at boot; speechStart hands off to it once the
       * main process confirms the recognizer is ready. Absent in older
       * shells, so every use is optional-chained. */
      registerSttCapture?(impl: { start(): Promise<void>; stop(): void }): void;
      /** One 16 kHz mono Float32 PCM block from the tap. */
      sttAudio?(chunk: ArrayBuffer): void;
      /** Main-process lifecycle commands for the tap: {cmd:"stop"}. */
      onSttControl?(cb: (info: { cmd: string }) => void): () => void;
      /** Recognizer download progress: {label, percent}. */
      onSttStatus?(cb: (info: { label: string; percent: number }) => void): () => void;
      /** Absolute path of a dropped File ("" when the drag carried no
       * file on disk). Absent in older builds of the shell. */
      getPathForFile?(file: File): string;
      /** {mic} TCC status: granted|denied|not-determined|unknown. Screen
       * status is deliberately absent — macOS 15+ caches it per-process,
       * so it lies for the whole session after a grant. */
      permStatus(): Promise<{ mic: string }>;
      /** Triggers the macOS microphone prompt; resolves true when granted. */
      permRequestMic(): Promise<boolean>;
      /** Opens System Settings on a privacy pane: mic|screen|speech. */
      permOpenSettings(pane: "mic" | "screen" | "speech"): Promise<void>;
      /** Copies an engine install command and opens a blank terminal. False
       * when no terminal could be launched; the clipboard still has it. */
      openInstallTerminal?(command: string): Promise<boolean>;
      /** Native directory picker for a bot's coding workspace. */
      chooseWorkspace?(): Promise<string | null>;
      /** Save a provider credential through Electron's OS-backed store. */
      setCredential?(name: "composioApiKey" | `aguiAuth:${string}` | `mcpEnv:${string}:${string}`, value: string): Promise<ConfigStatus>;
      /** In-app auto-update (packaged app only; dormant in dev). onState
       * fires immediately with the current state, then on transitions. */
      updater?: {
        check(): Promise<void>;
        download(): Promise<void>;
        /** quit-and-install the downloaded update */
        install(): Promise<void>;
        onState(cb: (s: UpdaterState) => void): () => void;
      };
    };
  }
}

export interface UpdaterState {
  status:
    | "idle"
    | "checking"
    | "available"
    | "downloading"
    | "downloaded"
    | "installing"
    | "error";
  version?: string;
  percent?: number;
  message?: string;
}
