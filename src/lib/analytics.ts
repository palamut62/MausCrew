// PostHog usage analytics + the email → person identity link.
// The phc_ token is a write-only public key (safe to ship in the client).
// Only the named events below are sent — autocapture is OFF on purpose:
// it would ship the $el_text of clicked elements, and the sidebar/option
// cards render model output and message previews, so it would leak fragments
// of private conversations to a third party. Email submissions call
// identify(), so PostHog's Persons tab doubles as the collected-email list.
import posthog from "posthog-js";

const TOKEN = "phc_m2hP39w8y2gLPvHgDvSXAu6xcZ3agjf4ruL56rGcMZEe";

let ready = false;

/** Called once the harness has reported the setting — never before. Opting out
 * has to mean PostHog is never loaded, not that it loads and is asked to stay
 * quiet: an init'd client still resolves the host and writes its own storage. */
export function initAnalytics(enabled: boolean) {
  if (ready || !enabled) return;
  posthog.init(TOKEN, {
    api_host: "https://us.i.posthog.com",
    autocapture: false, // never capture clicked-element text (conversation leak)
    capture_pageview: false, // single-window desktop app — no page routes
    person_profiles: "identified_only",
    persistence: "localStorage",
    // Left to itself posthog-js pulls two more scripts off us-assets at
    // runtime — a remote config blob and surveys.js. That is third-party code
    // executing in a renderer that can drive the whole local harness, for
    // features this app does not use. The bundled library is all we want, so
    // external loading is refused and the CSP has no remote script host.
    disable_external_dependency_loading: true,
    disable_surveys: true,
    advanced_disable_flags: true, // no feature flags here, so no /flags request
    disable_session_recording: true,
  });
  ready = true;
  const platform = navigator.userAgent.includes("Electron") ? "desktop" : "browser";
  // one-time install marker — app_first_open counts installs (the closest
  // truth to "downloads that mattered"; raw download counts live on the
  // GitHub release assets)
  if (!localStorage.getItem("mauscrew-installed") && !localStorage.getItem("omb-installed")) {
    localStorage.setItem("mauscrew-installed", new Date().toISOString());
    posthog.capture("app_first_open", { platform });
  } else if (!localStorage.getItem("mauscrew-installed")) {
    localStorage.setItem("mauscrew-installed", localStorage.getItem("omb-installed")!);
  }
  posthog.capture("app_opened", { platform });
}

export function track(event: string, props?: Record<string, unknown>) {
  if (!ready) return;
  posthog.capture(event, props);
}

export function identifyEmail(email: string) {
  if (!ready) return;
  posthog.identify(email, { email });
  posthog.capture("email_submitted");
}

// first-run email gate state
const GATE_KEY = "mauscrew-email-gate";
const LEGACY_GATE_KEY = "omb-email-gate";
export function emailGateDone(): boolean {
  return Boolean(localStorage.getItem(GATE_KEY) || localStorage.getItem(LEGACY_GATE_KEY));
}
export function setEmailGateDone(status: "submitted" | "skipped") {
  localStorage.setItem(GATE_KEY, status);
}
