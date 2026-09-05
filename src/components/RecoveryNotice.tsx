import { useEffect, useState } from "react";
import { api, useStore } from "@/state/store";
export function RecoveryNotice() {
  const { state, dispatch } = useStore();
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    let alive = true;
    const check = () => void api("/api/recovery?summary=1").then((r) => { if (alive) setBlocked(Boolean(r.issues.length || r.restartRequired)); }).catch(() => {});
    check(); const timer = setInterval(check, 15000);
    return () => { alive = false; clearInterval(timer); };
  }, []);
  if (!blocked && !state.loadError) return null;
  return <div role="alert" className="fixed inset-x-2 top-2 z-40 mx-auto flex max-w-2xl flex-wrap items-center gap-2 rounded-lg border border-warning bg-panel p-3 text-xs text-ink shadow-lg"><span className="flex-1">{blocked ? "Bazı kayıtlar kurtarma gerektiriyor. Yeni işler durduruldu; veriler korunuyor." : `Veriler yenilenemedi: ${state.loadError}`}</span><button className="rounded border border-hairline p-2" onClick={() => blocked ? dispatch({ type: "toggleAppSettings", open: true, section: "recovery" }) : window.dispatchEvent(new Event("mauscrew:retry-load"))}>{blocked ? "Kurtarma merkezini aç" : "Tekrar dene"}</button></div>;
}
