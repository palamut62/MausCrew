import { useId, useState } from "react";
import { DeviceMobile, LockKey } from "@phosphor-icons/react";

export function RemotePairingPage() {
  const params = new URLSearchParams(window.location.search);
  const [code, setCode] = useState(params.get("code") ?? "");
  const [name, setName] = useState(() => navigator.userAgent.includes("iPhone") ? "iPhone" : "Mobile device");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const nameId = useId();
  const codeId = useId();

  const pair = async () => {
    setWorking(true);
    setError("");
    try {
      const response = await fetch("/api/remote/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, name }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Pairing failed");
      window.location.replace("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Pairing failed");
      setWorking(false);
    }
  };

  return (
    <main className="flex min-h-full items-center justify-center bg-app p-5 [padding-top:max(1.25rem,env(safe-area-inset-top))] [padding-bottom:max(1.25rem,env(safe-area-inset-bottom))]">
      <section className="w-full max-w-sm rounded-2xl border border-hairline bg-panel p-6 shadow-2xl">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
          <DeviceMobile size={25} weight="duotone" />
        </div>
        <h1 className="text-xl font-semibold text-ink">Connect to MausCrew</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-secondary">
          This device will be able to chat with bots, follow tasks and answer approval requests on your computer.
        </p>
        <label htmlFor={nameId} className="mt-6 block text-[12px] font-medium text-ink-secondary">Device name</label>
        <input id={nameId} value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-hairline bg-inset px-3 text-[15px] text-ink outline-none focus:border-accent" />
        <label htmlFor={codeId} className="mt-4 block text-[12px] font-medium text-ink-secondary">Pairing code</label>
        <input id={codeId} value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} autoCapitalize="characters" autoCorrect="off" className="mt-1.5 min-h-11 w-full rounded-lg border border-hairline bg-inset px-3 font-mono text-[16px] tracking-wider text-ink outline-none focus:border-accent" />
        {error && <div role="alert" className="mt-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">{error}</div>}
        <button onClick={() => void pair()} disabled={working || !code.trim()} className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 text-[14px] font-semibold text-app disabled:opacity-40">
          <LockKey size={17} weight="bold" />
          {working ? "Connecting…" : "Connect securely"}
        </button>
        <div className="mt-5 text-center text-[10.5px] leading-relaxed text-ink-secondary">
          Product Owner: Umut Çelik · <a href="https://x.com/palamut62" className="underline">X</a> · <a href="https://github.com/palamut62" className="underline">GitHub</a>
        </div>
      </section>
    </main>
  );
}
