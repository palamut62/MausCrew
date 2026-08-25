import { Check, Circle, WarningCircle, X } from "@phosphor-icons/react";
import { Spin } from "./Spin";

import type { Message } from "@/state/store";

const record = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};

export function StructuredResult({ message }: { message: Message }) {
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
      return <div className={`${shell} p-3`}>{props.title && <div className="mb-2 px-1 text-[13px] font-medium text-ink">{props.title}</div>}<div className="space-y-1">{props.items.map((item: any, index: number) => <div key={index} className="flex items-center gap-2 rounded-lg bg-inset px-3 py-2 text-[12px] text-ink">{item.status === "done" ? <Check size={14} className="text-success" /> : item.status === "failed" ? <X size={14} className="text-danger" /> : item.status === "running" ? <Spin size={14} className="text-accent" /> : <Circle size={13} className="text-ink-secondary" />}<span>{item.label}</span></div>)}</div></div>;
    case "timeline":
      return <div className={`${shell} p-4`}>{props.title && <div className="mb-3 text-[13px] font-medium text-ink">{props.title}</div>}<div className="space-y-3 border-l border-accent/30 pl-4">{props.items.map((item: any, index: number) => <div key={index} className="relative"><span className="absolute -left-[19px] top-1 size-2 rounded-full bg-accent" /><div className="flex items-start justify-between gap-3"><span className="text-[12.5px] font-medium text-ink">{item.title}</span>{item.time && <span className="font-mono text-[10px] text-ink-secondary">{item.time}</span>}</div>{item.detail && <div className="mt-0.5 text-[11.5px] text-ink-secondary">{item.detail}</div>}</div>)}</div></div>;
    case "status-grid":
      return <div className={`${shell} grid gap-px bg-hairline sm:grid-cols-2`}>{props.items.map((item: any, index: number) => <div key={index} className="bg-panel p-3"><div className="text-[10.5px] text-ink-secondary">{item.label}</div><div className={`mt-0.5 text-[14px] font-medium ${item.status === "success" ? "text-success" : item.status === "danger" ? "text-danger" : item.status === "warning" ? "text-warning" : "text-ink"}`}>{item.value}</div></div>)}</div>;
    case "agent-result": {
      const failed = props.status === "failed";
      return <div className={`${shell} flex items-start gap-3 p-4`}>{failed ? <WarningCircle size={20} className="shrink-0 text-danger" /> : <Check size={20} className="shrink-0 text-success" />}<div><div className="text-[13px] font-medium text-ink">{props.title}</div><div className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-ink-secondary">{props.summary}</div></div></div>;
    }
    default:
      return null;
  }
}
