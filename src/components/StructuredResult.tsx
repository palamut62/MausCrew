import { Check, Circle, Clock, Copy, FileText, FolderOpen, PaperPlaneTilt, Pause, Play, WarningCircle, X } from "@phosphor-icons/react";
import { Spin } from "./Spin";

import { useStore, type Message } from "@/state/store";

const record = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};

/** Bytes as something a person reads, not as a number they have to divide. */
function fileSize(bytes: unknown): string {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) return "";
  if (value < 1024) return `${value} B`;
  const units = ["KB", "MB", "GB"];
  let size = value / 1024;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size < 10 ? size.toFixed(1) : Math.round(size)} ${units[unit]}`;
}

export function StructuredResult({ message }: { message: Message }) {
  const { dispatch } = useStore();
  if (!message.ui) return null;
  const props = record(message.ui.props);
  const shell = "w-full max-w-[720px] overflow-hidden rounded-xl border border-hairline bg-panel";
  switch (message.ui.component) {
    case "metric-card":
      return <div className={`${shell} p-4`}><div className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-secondary">{props.title}</div><div className="mt-1 text-[26px] font-semibold tracking-tight text-ink">{props.value}</div>{props.detail && <div className="mt-1 text-[12px] text-ink-secondary">{props.detail}</div>}</div>;
    case "progress":
      return <div className={`${shell} p-4`}><div className="flex items-center justify-between gap-3 text-[13px]"><span className="font-medium text-ink">{props.title}</span><span className="font-mono text-accent">{props.value}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-inset"><div className="h-full rounded-full bg-accent" style={{ width: `${props.value}%` }} /></div>{props.detail && <div className="mt-2 text-[11.5px] text-ink-secondary">{props.detail}</div>}</div>;
    case "table":
      return <div className={`${shell} overflow-x-auto`}><table className="w-full min-w-[420px] border-collapse text-left text-[12px]"><thead className="bg-inset text-ink-secondary"><tr>{props.columns.map((column: string, index: number) => <th key={index} className="border-b border-hairline px-3 py-2 font-medium">{column}</th>)}</tr></thead><tbody>{props.rows.map((row: unknown[], rowIndex: number) => <tr key={rowIndex} className="border-b border-hairline last:border-0">{props.columns.map((_column: string, cellIndex: number) => <td key={cellIndex} className="max-w-[320px] px-3 py-2 text-ink">{String(row[cellIndex] ?? "")}</td>)}</tr>)}</tbody></table></div>;
    case "task-list":
      return <div className={`${shell} p-3`}>{props.title && <div className="mb-2 flex items-center justify-between gap-3 px-1"><div className="text-[13px] font-medium text-ink">{props.title}</div>{props.status && <span className="font-mono text-[10px] uppercase tracking-wide text-ink-secondary">{props.status}</span>}</div>}<div className="space-y-1">{(props.items ?? []).map((item: any, index: number) => <div key={item.id ?? index} className="rounded-lg bg-inset px-3 py-2 text-[12px] text-ink"><div className="flex items-center gap-2">{item.status === "done" ? <Check size={14} className="text-success" /> : item.status === "failed" ? <X size={14} className="text-danger" /> : item.status === "running" ? <Spin size={14} className="text-accent" /> : item.status === "blocked" ? <WarningCircle size={14} className="text-warning" /> : <Circle size={13} className="text-ink-secondary" />}<span className="min-w-0 flex-1">{item.label}</span>{item.assignee && <span className="font-mono text-[10.5px] text-ink-secondary">@{item.assignee}</span>}</div>{item.output && <div className="ml-5 mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-ink-secondary">{item.output}</div>}</div>)}</div></div>;
    case "timeline":
      return <div className={`${shell} p-4`}>{props.title && <div className="mb-3 text-[13px] font-medium text-ink">{props.title}</div>}<div className="space-y-3 border-l border-accent/30 pl-4">{props.items.map((item: any, index: number) => <div key={index} className="relative"><span className="absolute -left-[19px] top-1 size-2 rounded-full bg-accent" /><div className="flex items-start justify-between gap-3"><span className="text-[12.5px] font-medium text-ink">{item.title}</span>{item.time && <span className="font-mono text-[10px] text-ink-secondary">{item.time}</span>}</div>{item.detail && <div className="mt-0.5 text-[11.5px] text-ink-secondary">{item.detail}</div>}</div>)}</div></div>;
    case "status-grid":
      return <div className={`${shell} grid gap-px bg-hairline sm:grid-cols-2`}>{props.items.map((item: any, index: number) => <div key={index} className="bg-panel p-3"><div className="text-[10.5px] text-ink-secondary">{item.label}</div><div className={`mt-0.5 text-[14px] font-medium ${item.status === "success" ? "text-success" : item.status === "danger" ? "text-danger" : item.status === "warning" ? "text-warning" : "text-ink"}`}>{item.value}</div></div>)}</div>;
    case "file-list":
      return (
        <div className={shell}>
          {props.title && <div className="border-b border-hairline px-4 py-2.5 text-[13px] font-medium text-ink">{props.title}</div>}
          <div className="divide-y divide-hairline/70">
            {(props.items ?? []).map((item: any, index: number) => (
              <div key={index} className="flex items-start gap-3 px-4 py-2.5">
                <FileText size={16} className="mt-0.5 shrink-0 text-ink-secondary" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-medium text-ink">{item.name}</div>
                  {item.path && <div className="truncate font-mono text-[10.5px] text-ink-secondary" title={item.path}>{item.path}</div>}
                  <div className="mt-0.5 flex flex-wrap gap-x-2 text-[10.5px] text-ink-secondary">
                    {item.kind && <span className="uppercase tracking-wide">{item.kind}</span>}
                    {fileSize(item.bytes) && <span>{fileSize(item.bytes)}</span>}
                  </div>
                  {item.note && <div className="mt-1 text-[11.5px] leading-relaxed text-ink-secondary">{item.note}</div>}
                </div>
                {item.path && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => void navigator.clipboard?.writeText(String(item.path))}
                      className="rounded-md p-1.5 text-ink-secondary hover:bg-raised hover:text-ink"
                      title="Copy path"
                      aria-label={`Copy the path of ${item.name}`}
                    >
                      <Copy size={14} />
                    </button>
                    {/* Reveal, never open: the path comes from model output, and
                        showing a folder cannot run anything. */}
                    {window.mauscrew?.revealPath && (
                      <button
                        onClick={() => void window.mauscrew?.revealPath?.(String(item.path))}
                        className="rounded-md p-1.5 text-ink-secondary hover:bg-raised hover:text-ink"
                        title="Show in folder"
                        aria-label={`Show ${item.name} in its folder`}
                      >
                        <FolderOpen size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    case "agent-result": {
      const failed = props.status === "failed";
      return <div className={`${shell} flex items-start gap-3 p-4`}>{failed ? <WarningCircle size={20} className="shrink-0 text-danger" /> : <Check size={20} className="shrink-0 text-success" />}<div><div className="text-[13px] font-medium text-ink">{props.title}</div><div className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-ink-secondary">{props.summary}</div></div></div>;
    }
    case "live-work": {
      const status = String(props.status ?? "working");
      const running = status === "preparing" || status === "working";
      const needsUser = status === "action-needed" || status === "human-control";
      const failed = status === "failed" || status === "stopped";
      return <div className={`${shell}`}><div className="flex items-start gap-3 px-4 py-3">{running ? <Spin size={17} className="mt-0.5 text-accent" /> : needsUser ? <Clock size={17} className="mt-0.5 text-warning" /> : failed ? <X size={17} className="mt-0.5 text-danger" /> : <Check size={17} className="mt-0.5 text-success" />}<div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><div className="text-[13px] font-medium text-ink">{props.title ?? "Working"}</div><span className="font-mono text-[10px] uppercase tracking-wide text-ink-secondary">{String(status).replace("-", " ")}</span></div>{props.lastAction && <div className="mt-1 truncate text-[11.5px] text-ink-secondary">{props.lastAction}</div>}{props.summary && <div className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed text-ink-secondary">{props.summary}</div>}</div></div>{props.botId && (running || status === "action-needed" || status === "human-control") && <div className="flex justify-end border-t border-hairline px-4 py-2.5">{status === "human-control" ? <button onClick={() => dispatch({ type: "setTakeover", botId: String(props.botId), active: false, resume: true })} className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-[11.5px] font-semibold text-app hover:brightness-110"><Play size={13} weight="fill" />Return control and resume</button> : <button onClick={() => dispatch({ type: "setTakeover", botId: String(props.botId), active: true })} className="flex items-center gap-2 rounded-lg border border-hairline px-3 py-2 text-[11.5px] font-medium text-ink hover:bg-raised"><Pause size={13} weight="fill" />Take control</button>}</div>}</div>;
    }
    case "review-item": {
      const pending = props.status === "pending";
      return <div className={`${shell}`}><div className="flex items-start gap-3 border-b border-hairline px-4 py-3"><PaperPlaneTilt size={17} className="mt-0.5 text-accent" /><div className="min-w-0 flex-1"><div className="text-[13px] font-medium text-ink">{props.title}</div><div className="mt-0.5 text-[11px] text-ink-secondary">Review before sending to {props.target}</div></div><span className="font-mono text-[10px] uppercase tracking-wide text-ink-secondary">{props.status}</span></div><pre className="max-h-56 overflow-auto whitespace-pre-wrap px-4 py-3 font-sans text-[12px] leading-relaxed text-ink">{props.content}</pre>{pending && <div className="flex justify-end gap-2 border-t border-hairline px-4 py-2.5"><button onClick={() => dispatch({ type: "reviewAction", itemId: String(props.id), action: "dismiss" })} className="rounded-lg border border-hairline px-3 py-2 text-[11.5px] text-ink-secondary hover:bg-raised hover:text-ink">Dismiss</button><button onClick={() => dispatch({ type: "reviewAction", itemId: String(props.id), action: "approve" })} className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-[11.5px] font-semibold text-app hover:brightness-110"><PaperPlaneTilt size={13} weight="fill" />Approve and send</button></div>}</div>;
    }
    default:
      return null;
  }
}
