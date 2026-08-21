import { useEffect, useState } from "react";
import { Check, Copy, DeviceMobile, LinkSimple, Trash } from "@phosphor-icons/react";
import { QRCodeSVG } from "qrcode.react";
import { Card, CommandLine } from "./SettingsPrimitives";

interface Device { id: string; name: string; createdAt: number; lastSeenAt: number }
interface Status { enabled: boolean; publicUrl: string; localPort: number; devices: Device[] }

export function RemoteAccessSection() {
  const [status, setStatus] = useState<Status>({ enabled: false, publicUrl: "", localPort: 8799, devices: [] });
  const [url, setUrl] = useState("");
  const [pairing, setPairing] = useState<{ code: string; url: string; expiresAt: number } | null>(null);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const refresh = () => fetch("/api/remote/status").then((res) => res.json()).then((next) => { setStatus(next); setUrl(next.publicUrl); });
  useEffect(() => { void refresh(); }, []);

  const save = async (enabled: boolean) => {
    setMessage("");
    const response = await fetch("/api/config", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ remoteAccess: { enabled, publicUrl: url.trim() } }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(body.error ?? "Could not save remote access");
    await refresh();
    setMessage(enabled ? "Remote access is ready for pairing." : "Remote access is off.");
  };

  const create = async () => {
    setMessage("");
    const response = await fetch("/api/remote/pairings", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(body.error ?? "Could not create pairing code");
    setCopied(false);
    setPairing(body);
  };

  return (
    <div className="flex flex-col gap-4">
      <Card title="Secure mobile access" subtitle="Expose the loopback server with an HTTPS reverse proxy such as Tailscale Serve, then enter its exact address here. The agent server itself never opens a LAN port.">
        <div className="mb-4"><CommandLine command={`tailscale serve --bg localhost:${status.localPort}`} /></div>
        <label className="text-[12px] text-ink-secondary">HTTPS address</label>
        <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://your-pc.tailnet.ts.net" className="mt-1.5 min-h-11 w-full rounded-lg border border-hairline bg-inset px-3 text-[14px] text-ink outline-none focus:border-accent" />
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => void save(true)} className="min-h-11 rounded-lg bg-accent px-4 text-[13px] font-semibold text-app">Enable</button>
          {status.enabled && <button onClick={() => void save(false)} className="min-h-11 rounded-lg border border-hairline px-4 text-[13px] text-ink hover:bg-raised">Disable</button>}
        </div>
        {message && <div className="mt-3 text-[12px] text-ink-secondary">{message}</div>}
      </Card>

      {status.enabled && <Card title="Pair a phone" subtitle="Codes work once and expire after 10 minutes. Open the link on your phone over the configured HTTPS address.">
        <button onClick={() => void create()} className="flex min-h-11 items-center gap-2 rounded-lg border border-hairline px-4 text-[13px] text-ink hover:bg-raised"><LinkSimple size={16} /> Create pairing link</button>
        {pairing && <div className="mt-3 rounded-xl border border-hairline bg-inset p-4">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div className="shrink-0 rounded-xl bg-white p-3 shadow-sm" aria-label="Phone pairing QR code">
              <QRCodeSVG
                value={pairing.url}
                size={196}
                level="M"
                marginSize={1}
                bgColor="#ffffff"
                fgColor="#111111"
                title="Scan to pair this phone with MausCrew"
              />
            </div>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <div className="text-[14px] font-semibold text-ink">Scan with your phone camera</div>
              <div className="mt-1 text-[12px] leading-5 text-ink-secondary">Open the camera on your phone, point it at this QR code, then tap the link that appears.</div>
              <div className="mt-3 font-mono text-lg tracking-widest text-accent">{pairing.code}</div>
              <div className="mt-1 break-all text-[11px] text-ink-secondary">{pairing.url}</div>
              <button onClick={() => void navigator.clipboard.writeText(pairing.url).then(() => setCopied(true))} className="mt-2 inline-flex min-h-11 items-center gap-2 text-[12px] text-ink">{copied ? <Check className="text-success" /> : <Copy />} {copied ? "Copied" : "Copy link"}</button>
            </div>
          </div>
        </div>}
      </Card>}

      <Card title="Paired devices" subtitle="Revoking a device immediately invalidates its remote session.">
        {status.devices.length === 0 ? <div className="text-[13px] text-ink-secondary">No phones paired.</div> : status.devices.map((device) => <div key={device.id} className="flex min-h-12 items-center gap-3 border-b border-hairline py-2 last:border-0">
          <DeviceMobile size={18} className="text-ink-secondary" />
          <div className="min-w-0 flex-1"><div className="truncate text-[13px] text-ink">{device.name}</div><div className="text-[10.5px] text-ink-secondary">Last seen {new Date(device.lastSeenAt).toLocaleString()}</div></div>
          <button aria-label={`Revoke ${device.name}`} onClick={() => void fetch(`/api/remote/devices/${device.id}`, { method: "DELETE" }).then(refresh)} className="min-h-11 min-w-11 rounded-lg p-2 text-danger hover:bg-danger/10"><Trash size={17} /></button>
        </div>)}
      </Card>
    </div>
  );
}
