export const structuredComponents = ["metric-card", "progress", "table", "task-list", "timeline", "status-grid", "agent-result"] as const;
export type StructuredComponent = (typeof structuredComponents)[number];
export type StructuredUi = { component: StructuredComponent; props: Record<string, unknown> };

const text = (value: unknown, max = 300) => typeof value === "string" ? value.trim().slice(0, max) : "";
const primitive = (value: unknown) => typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null;

export function validateStructuredUi(value: unknown): StructuredUi {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("structured UI must be an object");
  const input = value as Record<string, unknown>;
  if (!structuredComponents.includes(input.component as StructuredComponent)) throw new Error("unknown structured UI component");
  if (!input.props || typeof input.props !== "object" || Array.isArray(input.props)) throw new Error("structured UI props must be an object");
  const props = input.props as Record<string, unknown>;
  switch (input.component as StructuredComponent) {
    case "metric-card": {
      const title = text(props.title, 100);
      const metricValue = text(props.value, 100);
      if (!title || !metricValue) throw new Error("metric-card needs title and value");
      return { component: "metric-card", props: { title, value: metricValue, ...(text(props.detail) ? { detail: text(props.detail) } : {}) } };
    }
    case "progress": {
      const title = text(props.title, 100);
      const progress = Number(props.value);
      if (!title || !Number.isFinite(progress)) throw new Error("progress needs title and numeric value");
      return { component: "progress", props: { title, value: Math.max(0, Math.min(100, progress)), ...(text(props.detail) ? { detail: text(props.detail) } : {}) } };
    }
    case "table": {
      const columns = Array.isArray(props.columns) ? props.columns.map((column) => text(column, 80)).filter(Boolean).slice(0, 8) : [];
      if (!columns.length) throw new Error("table needs columns");
      const rows = Array.isArray(props.rows)
        ? props.rows.filter(Array.isArray).slice(0, 50).map((row) => row.slice(0, columns.length).map((cell) => primitive(cell) ? cell : text(JSON.stringify(cell), 300)))
        : [];
      return { component: "table", props: { columns, rows } };
    }
    case "task-list": {
      const items = Array.isArray(props.items) ? props.items.slice(0, 50).map((item) => {
        const record = item && typeof item === "object" && !Array.isArray(item) ? item as Record<string, unknown> : {};
        const status = ["pending", "running", "done", "failed"].includes(String(record.status)) ? String(record.status) : "pending";
        return { label: text(record.label, 200), status };
      }).filter((item) => item.label) : [];
      return { component: "task-list", props: { ...(text(props.title, 100) ? { title: text(props.title, 100) } : {}), items } };
    }
    case "timeline": {
      const items = Array.isArray(props.items) ? props.items.slice(0, 40).map((item) => {
        const record = item && typeof item === "object" && !Array.isArray(item) ? item as Record<string, unknown> : {};
        return { title: text(record.title, 150), detail: text(record.detail, 400), time: text(record.time, 80) };
      }).filter((item) => item.title) : [];
      return { component: "timeline", props: { ...(text(props.title, 100) ? { title: text(props.title, 100) } : {}), items } };
    }
    case "status-grid": {
      const items = Array.isArray(props.items) ? props.items.slice(0, 30).map((item) => {
        const record = item && typeof item === "object" && !Array.isArray(item) ? item as Record<string, unknown> : {};
        const status = ["neutral", "success", "warning", "danger"].includes(String(record.status)) ? String(record.status) : "neutral";
        return { label: text(record.label, 100), value: text(record.value, 120), status };
      }).filter((item) => item.label && item.value) : [];
      return { component: "status-grid", props: { items } };
    }
    case "agent-result": {
      const title = text(props.title, 120);
      const summary = text(props.summary, 2000);
      if (!title || !summary) throw new Error("agent-result needs title and summary");
      const status = ["success", "failed", "partial"].includes(String(props.status)) ? String(props.status) : "success";
      return { component: "agent-result", props: { title, summary, status } };
    }
  }
}

const UI_FENCE = /```mauscrew-ui\s*\r?\n([\s\S]*?)\r?\n```/i;

export function extractStructuredUi(reply: string): { text: string; ui?: StructuredUi } {
  const match = UI_FENCE.exec(reply);
  if (!match) return { text: reply };
  try {
    const ui = validateStructuredUi(JSON.parse(match[1]));
    const remaining = `${reply.slice(0, match.index)}${reply.slice(match.index + match[0].length)}`.trim();
    return { text: remaining, ui };
  } catch {
    return { text: reply };
  }
}
