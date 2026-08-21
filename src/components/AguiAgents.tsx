import { useState } from "react";
import { CheckCircle, Flask, Plus, Spinner, Trash, WarningCircle } from "@phosphor-icons/react";

import { useStore, type ConfigStatus } from "@/state/store";

type Agent = NonNullable<ConfigStatus["aguiAgents"]>[number];

async function request(path: string, init?: RequestInit) {
  const response = await fetch(path, { headers: { "content-type": "application/json" }, ...init });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? body.reason ?? `${response.status} ${response.statusText}`);
  return body;
}

export function AguiAgents() {
  const { state, dispatch } = useStore();
  const agents = state.config?.aguiAgents ?? [];
  const [label, setLabel] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [authHeader, setAuthHeader] = useState("Authorization");
  const [authValue, setAuthValue] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const test = async (agent?: Agent) => {
    setBusy(agent ? `test:${agent.id}` : "test:new");
    setMessage(null);
    try {
      const result = await request("/api/agui-agents/test", {
        method: "POST",
        body: JSON.stringify(agent
          ? { id: agent.id, endpoint: agent.endpoint, authHeader: agent.authHeader }
          : { endpoint, authHeader, authValue }),
      });
      setMessage({ ok: true, text: `Connected: ${result.events.join(" → ")}` });
      return true;
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : String(error) });
      return false;
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    if (!label.trim() || !endpoint.trim()) return;
    setBusy("save");
    setMessage(null);
    try {
      if (!(await test())) return;
      const id = crypto.randomUUID();
      const next = [
        ...agents.map(({ id, label, endpoint, authHeader, configured }) => ({ id, label, endpoint, authHeader, authConfigured: configured })),
        { id, label: label.trim(), endpoint: endpoint.trim(), authHeader: authHeader.trim() || "Authorization", authConfigured: Boolean(authValue.trim()) },
      ];
      let config = await request("/api/agui-agents", { method: "PUT", body: JSON.stringify({ agents: next }) });
      if (authValue.trim()) {
        config = window.mauscrew?.setCredential
          ? await window.mauscrew.setCredential(`aguiAuth:${id}`, authValue.trim())
          : await request(`/api/agui-agents/${id}/credential`, { method: "PUT", body: JSON.stringify({ value: authValue.trim() }) });
      }
      dispatch({ type: "configStatus", config });
      setLabel("");
      setEndpoint("");
      setAuthHeader("Authorization");
      setAuthValue("");
      setMessage({ ok: true, text: "AG-UI agent added to the model picker." });
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(null);
    }
  };

  const remove = async (agent: Agent) => {
    if (!window.confirm(`Remove ${agent.label}? Existing chats stay on disk, but this remote agent will become unavailable.`)) return;
    setBusy(`remove:${agent.id}`);
    setMessage(null);
    try {
      if (agent.configured && window.mauscrew?.setCredential) {
        await window.mauscrew.setCredential(`aguiAuth:${agent.id}`, "");
      }
      const next = agents
        .filter((candidate) => candidate.id !== agent.id)
        .map(({ id, label, endpoint, authHeader, configured }) => ({ id, label, endpoint, authHeader, authConfigured: configured }));
      const config = await request("/api/agui-agents", { method: "PUT", body: JSON.stringify({ agents: next }) });
      dispatch({ type: "configStatus", config });
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(null);
    }
  };

  const inputClass = "w-full rounded-lg border border-hairline bg-inset px-3 py-2 text-[12.5px] text-ink placeholder:text-ink-secondary outline-none focus:border-accent/50";
  return (
    <div className="space-y-3">
      {agents.map((agent) => (
        <div key={agent.id} className="rounded-lg border border-hairline bg-inset px-3 py-2.5">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[13px] font-medium text-ink">
                {agent.label}
                {agent.configured && <span className="rounded bg-success/10 px-1.5 py-0.5 text-[9.5px] uppercase text-success">Auth</span>}
              </div>
              <div className="mt-0.5 truncate font-mono text-[10.5px] text-ink-secondary" title={agent.endpoint}>{agent.endpoint}</div>
            </div>
            <button onClick={() => void test(agent)} disabled={Boolean(busy)} className="rounded-md p-2 text-ink-secondary hover:bg-raised hover:text-ink" title="Test connection">
              {busy === `test:${agent.id}` ? <Spinner size={15} className="animate-spin" /> : <Flask size={15} />}
            </button>
            <button onClick={() => void remove(agent)} disabled={Boolean(busy)} className="rounded-md p-2 text-danger hover:bg-danger/10" title="Remove agent">
              <Trash size={15} />
            </button>
          </div>
        </div>
      ))}

      <div className="grid gap-2 rounded-lg border border-dashed border-hairline p-3 sm:grid-cols-2">
        <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Agent name" className={inputClass} />
        <input value={endpoint} onChange={(event) => setEndpoint(event.target.value)} placeholder="https://agent.example.com/ag-ui" className={inputClass} />
        <input value={authHeader} onChange={(event) => setAuthHeader(event.target.value)} placeholder="Authorization" className={inputClass} />
        <input type="password" value={authValue} onChange={(event) => setAuthValue(event.target.value)} placeholder="Bearer token (optional)" autoComplete="new-password" className={inputClass} />
        <div className="flex gap-2 sm:col-span-2">
          <button onClick={() => void test()} disabled={!endpoint.trim() || Boolean(busy)} className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-2 text-[12px] text-ink hover:bg-raised disabled:opacity-40">
            <Flask size={14} /> Test
          </button>
          <button onClick={() => void save()} disabled={!label.trim() || !endpoint.trim() || Boolean(busy)} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-[12px] font-semibold text-black disabled:opacity-40">
            {busy === "save" ? <Spinner size={14} className="animate-spin" /> : <Plus size={14} weight="bold" />} Add agent
          </button>
        </div>
      </div>

      {message && (
        <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-[11.5px] ${message.ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
          {message.ok ? <CheckCircle size={15} className="mt-0.5 shrink-0" /> : <WarningCircle size={15} className="mt-0.5 shrink-0" />}
          {message.text}
        </div>
      )}
      <div className="text-[10.5px] leading-relaxed text-ink-secondary">
        AG-UI auth values are encrypted with the operating system credential store in the desktop app and are never returned to this form.
      </div>
    </div>
  );
}
