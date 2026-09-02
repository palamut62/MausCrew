import { useState } from "react";
import { Spin } from "./Spin";
import { CaretDown, CaretRight, CheckCircle, Flask, Plus, Trash, WarningCircle } from "@phosphor-icons/react";

import { useStore, type ConfigStatus } from "@/state/store";

type Server = NonNullable<ConfigStatus["mcpServers"]>[number];

async function api(path: string, init?: RequestInit) {
  const response = await fetch(path, { headers: { "content-type": "application/json" }, ...init });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? `${response.status} ${response.statusText}`);
  return body;
}

function parseArgs(value: string) {
  return value.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean);
}

function parseToolList(value: string) {
  return [...new Set(value.split(/[\s,]+/).map((entry) => entry.trim()).filter(Boolean))];
}

function parseEnv(value: string) {
  const values: Record<string, string> = {};
  for (const line of value.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const separator = line.indexOf("=");
    if (separator < 1) throw new Error("Environment entries must use NAME=value, one per line.");
    const name = line.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,79}$/.test(name)) throw new Error(`Invalid environment name: ${name}`);
    values[name] = line.slice(separator + 1);
  }
  return values;
}

export function McpServers() {
  const { state, dispatch } = useStore();
  const servers = state.config?.mcpServers ?? [];
  const bots = state.bots.filter((bot) => !bot.hidden);
  const [name, setName] = useState("");
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState("");
  const [env, setEnv] = useState("");
  const [allowedBots, setAllowedBots] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  // Per-server guidance is edited in place: it is written after the server
  // already connected, usually right after seeing which tools it exposes.
  const [openServer, setOpenServer] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ instructions: string; disabledTools: string }>({ instructions: "", disabledTools: "" });

  const descriptor = (id: string, values: Record<string, string>) => ({
    id,
    name: name.trim(),
    command: command.trim(),
    args: parseArgs(args),
    envNames: Object.keys(values),
    allowedBots,
    enabled: true,
  });

  const testAndAdd = async () => {
    if (!name.trim() || !command.trim()) return;
    setBusy("add");
    setMessage(null);
    try {
      const values = parseEnv(env);
      const id = crypto.randomUUID();
      const server = descriptor(id, values);
      const tested = await api("/api/mcp-servers/test", {
        method: "POST",
        body: JSON.stringify({ server, envValues: values }),
      });
      const next = [
        ...servers.map(({ configuredEnvNames: _configured, ...saved }) => saved),
        server,
      ];
      let config = await api("/api/mcp-servers", { method: "PUT", body: JSON.stringify({ servers: next }) });
      for (const [field, value] of Object.entries(values)) {
        config = window.mauscrew?.setCredential
          ? await window.mauscrew.setCredential(`mcpEnv:${id}:${field}`, value)
          : await api(`/api/mcp-servers/${id}/credential/${field}`, { method: "PUT", body: JSON.stringify({ value }) });
      }
      dispatch({ type: "configStatus", config });
      setName("");
      setCommand("");
      setArgs("");
      setEnv("");
      setAllowedBots([]);
      const classes = [...new Set((tested.tools as Array<{ class: string }>).map((tool) => tool.class))];
      setMessage({ ok: true, text: `Connected. ${tested.tools.length} tools found${classes.length ? ` (${classes.join(", ")})` : ""}.` });
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(null);
    }
  };

  const openEditor = (server: Server) => {
    if (openServer === server.id) return setOpenServer(null);
    setOpenServer(server.id);
    setDraft({
      instructions: server.instructions ?? "",
      disabledTools: (server.disabledTools ?? []).join("\n"),
    });
  };

  const saveGuidance = async (server: Server) => {
    setBusy(`edit:${server.id}`);
    setMessage(null);
    try {
      const next = servers.map(({ configuredEnvNames: _configured, ...saved }) =>
        saved.id === server.id
          ? { ...saved, instructions: draft.instructions.trim(), disabledTools: parseToolList(draft.disabledTools) }
          : saved,
      );
      const config = await api("/api/mcp-servers", { method: "PUT", body: JSON.stringify({ servers: next }) });
      dispatch({ type: "configStatus", config });
      setOpenServer(null);
      setMessage({ ok: true, text: `Saved instructions for ${server.name}.` });
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(null);
    }
  };

  const remove = async (server: Server) => {
    if (!window.confirm(`Remove MCP server ${server.name}?`)) return;
    setBusy(`remove:${server.id}`);
    setMessage(null);
    try {
      for (const field of server.configuredEnvNames) {
        if (window.mauscrew?.setCredential) await window.mauscrew.setCredential(`mcpEnv:${server.id}:${field}`, "");
      }
      const next = servers
        .filter((candidate) => candidate.id !== server.id)
        .map(({ configuredEnvNames: _configured, ...saved }) => saved);
      const config = await api("/api/mcp-servers", { method: "PUT", body: JSON.stringify({ servers: next }) });
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
      {servers.map((server) => (
        <div key={server.id} className="rounded-lg border border-hairline bg-inset px-3 py-2.5">
          <div className="flex items-start gap-3">
            <button onClick={() => openEditor(server)} className="min-w-0 flex-1 text-left" title="Server instructions and disabled tools">
              <div className="flex items-center gap-1 text-[13px] font-medium text-ink">
                {openServer === server.id ? <CaretDown size={12} /> : <CaretRight size={12} />}
                {server.name}
              </div>
              <div className="mt-0.5 truncate font-mono text-[10.5px] text-ink-secondary">{server.command} {server.args.join(" ")}</div>
              <div className="mt-1 text-[10px] text-ink-secondary">
                {server.allowedBots.length ? `${server.allowedBots.length} bot grant` : "All bots"}
                {server.envNames.length ? ` · ${server.configuredEnvNames.length}/${server.envNames.length} encrypted env` : ""}
                {server.instructions ? " · custom instructions" : ""}
                {server.disabledTools?.length ? ` · ${server.disabledTools.length} tool blocked` : ""}
              </div>
            </button>
            <button onClick={() => void remove(server)} disabled={Boolean(busy)} className="rounded-md p-2 text-danger hover:bg-danger/10" title="Remove MCP server">
              {busy === `remove:${server.id}` ? <Spin size={15} /> : <Trash size={15} />}
            </button>
          </div>
          {openServer === server.id && (
            <div className="mt-2.5 space-y-2 border-t border-hairline pt-2.5">
              <div>
                <div className="mb-1 text-[10.5px] text-ink-secondary">Instructions for this server — added to the prompt of every bot that mounts it</div>
                <textarea
                  value={draft.instructions}
                  onChange={(event) => setDraft((current) => ({ ...current, instructions: event.target.value }))}
                  rows={3}
                  maxLength={2000}
                  placeholder="Use this server only for the staging database. Never run migrations."
                  className={inputClass}
                />
              </div>
              <div>
                <div className="mb-1 text-[10.5px] text-ink-secondary">Disabled tools, one per line — denied at the permission gate, not just discouraged</div>
                <textarea
                  value={draft.disabledTools}
                  onChange={(event) => setDraft((current) => ({ ...current, disabledTools: event.target.value }))}
                  rows={2}
                  placeholder={"delete_file\nwrite_query"}
                  className={inputClass}
                />
              </div>
              <button
                onClick={() => void saveGuidance(server)}
                disabled={Boolean(busy)}
                className="rounded-lg bg-accent px-3 py-1.5 text-[11.5px] font-semibold text-black disabled:opacity-40"
              >
                {busy === `edit:${server.id}` ? <Spin size={13} /> : "Save"}
              </button>
            </div>
          )}
        </div>
      ))}

      <div className="space-y-2 rounded-lg border border-dashed border-hairline p-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Server name" className={inputClass} />
          <input value={command} onChange={(event) => setCommand(event.target.value)} placeholder="Command (for example npx)" className={inputClass} />
          <textarea value={args} onChange={(event) => setArgs(event.target.value)} rows={3} placeholder={"Arguments, one per line\n-y\n@modelcontextprotocol/server-filesystem"} className={inputClass} />
          <textarea value={env} onChange={(event) => setEnv(event.target.value)} rows={3} placeholder={"Encrypted environment, one per line\nAPI_KEY=..."} className={inputClass} />
        </div>
        {bots.length > 0 && (
          <div>
            <div className="mb-1.5 text-[10.5px] text-ink-secondary">Bot grants (none selected means all bots)</div>
            <div className="flex flex-wrap gap-1.5">
              {bots.map((bot) => (
                <button
                  key={bot.id}
                  onClick={() => setAllowedBots((current) => current.includes(bot.id) ? current.filter((id) => id !== bot.id) : [...current, bot.id])}
                  className={`rounded-md border px-2 py-1 text-[10.5px] ${allowedBots.includes(bot.id) ? "border-accent/40 bg-accent/10 text-accent" : "border-hairline text-ink-secondary"}`}
                >
                  {bot.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <button onClick={() => void testAndAdd()} disabled={!name.trim() || !command.trim() || Boolean(busy)} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-[12px] font-semibold text-black disabled:opacity-40">
          {busy === "add" ? <Spin size={14} /> : <><Flask size={14} /><Plus size={13} weight="bold" /></>} Test and add
        </button>
      </div>

      {message && (
        <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-[11.5px] ${message.ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
          {message.ok ? <CheckCircle size={15} className="mt-0.5 shrink-0" /> : <WarningCircle size={15} className="mt-0.5 shrink-0" />}
          {message.text}
        </div>
      )}
      <div className="text-[10.5px] leading-relaxed text-ink-secondary">
        MCP commands run locally only for granted bots. Environment values are encrypted by the desktop credential store; unknown and write tools default to approval.
      </div>
    </div>
  );
}
