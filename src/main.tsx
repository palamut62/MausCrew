import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { RemotePairingPage } from "./components/RemotePairingPage";
import { installSttCapture } from "./lib/stt/capture";
import { installViewportHeight } from "./lib/viewport";
import "./styles.css";

// Windows speech recognition captures in this window (see capture.ts);
// registering is a no-op wherever the bridge or the tap is absent.
installSttCapture();

// Keeps --app-height on the real visible height so the composer stays above
// a phone's keyboard. No-op without visualViewport, where CSS dvh stands.
installViewportHeight();

function Root() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const pairingPath = window.location.pathname === "/pair";
  useEffect(() => {
    if (pairingPath) return setAuthorized(false);
    void fetch("/api/remote/session")
      .then((response) => setAuthorized(response.ok))
      .catch(() => setAuthorized(true));
  }, [pairingPath]);
  if (pairingPath || authorized === false) return <RemotePairingPage />;
  if (authorized === null) return <div className="h-full bg-app" />;
  return <App />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);

if ("serviceWorker" in navigator && window.location.protocol === "https:") {
  window.addEventListener("load", () => void navigator.serviceWorker.register("/sw.js"));
}
