import { fileListItems } from "./produced-files.js";
export const TASK_NOTES_PROMPT = " When substantial work produces durable decisions or remaining work, finish with short headings 'Decisions:' and 'Remaining work:' (or 'Kararlar:' and 'Kalan iş:') and concise bullet points. Omit empty headings. Do not call untested results verified. These sections become editable memory for this task.";
export function captureTaskNotes(store, botId, threadId, messages) {
    const task = store.taskByThread(botId, threadId);
    if (!task)
        return;
    const add = (message, kind, text) => {
        if (!text.trim() || task.memorySuppressed?.includes(`${message.id}:${kind}`))
            return;
        if (task.memory?.some((entry) => entry.sourceMessageId === message.id && entry.kind === kind))
            return;
        store.upsertTaskMemory(botId, threadId, { kind, text: text.trim(), sourceMessageId: message.id });
    };
    for (const message of messages) {
        if (message.role !== "bot")
            continue;
        const files = fileListItems(message.ui);
        if (files.length)
            add(message, "artifact", files.map((file) => `${file.name}: ${file.path}`).join("\n"));
        if (message.kind !== "text" || !message.text)
            continue;
        let kind;
        const parts = new Map();
        for (const raw of message.text.split("\n")) {
            const line = raw.replace(/^[#\s]+/, "").replaceAll("**", "").trim();
            if (/^(decisions|kararlar)\s*:?$/i.test(line)) {
                kind = "decision";
                continue;
            }
            if (/^(remaining work|kalan iş|kalan işler)\s*:?$/i.test(line)) {
                kind = "remaining";
                continue;
            }
            if (/^[#]/.test(raw) || /^\*\*[^*]+\*\*:?$/.test(raw))
                kind = undefined;
            if (kind && line) {
                const values = parts.get(kind) ?? [];
                values.push(line);
                parts.set(kind, values);
            }
        }
        for (const [entryKind, lines] of parts)
            add(message, entryKind, lines.join("\n"));
    }
}
