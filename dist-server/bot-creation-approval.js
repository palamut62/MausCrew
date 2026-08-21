import { newId } from "./contracts.js";
const pendingCreations = new Map();
const APPROVAL_TIMEOUT_MS = 15 * 60_000;
function settleCard(pending, behavior, dismissed) {
    const existing = pending.bus.store.messagesFor(pending.threadId).find((message) => message.id === pending.messageId);
    if (!existing?.card || existing.card.answered)
        return;
    const message = pending.bus.store.patchMessage(pending.threadId, pending.messageId, {
        card: { ...existing.card, answered: behavior, dismissed },
    });
    if (message)
        pending.bus.broadcast({ kind: "message.patch", threadId: pending.threadId, message });
}
export function requestBotCreationApproval(bus, from, request, sourceThreadId = from.threadId) {
    return new Promise((resolve) => {
        const requestId = newId();
        const card = bus.store.appendMessage(sourceThreadId, {
            role: "bot",
            kind: "options",
            card: {
                title: `@${from.name} wants to create @${request.name}`,
                subtitle: `${request.title}: ${request.description}`.slice(0, 240),
                options: ["Allow", "Deny"],
                requestId,
                tool: "create_bot",
            },
        });
        bus.broadcast({ kind: "message", threadId: sourceThreadId, message: card });
        const timer = setTimeout(() => {
            const pending = pendingCreations.get(requestId);
            if (!pending)
                return;
            pendingCreations.delete(requestId);
            settleCard(pending, "deny", true);
            resolve("deny");
        }, APPROVAL_TIMEOUT_MS);
        timer.unref?.();
        pendingCreations.set(requestId, { resolve, timer, fromBotId: from.id, threadId: sourceThreadId, messageId: card.id, bus });
    });
}
export function resolveBotCreation(requestId, behavior) {
    const pending = pendingCreations.get(requestId);
    if (!pending)
        return false;
    pendingCreations.delete(requestId);
    clearTimeout(pending.timer);
    const result = behavior === "allow" ? "allow" : "deny";
    settleCard(pending, result, false);
    pending.resolve(result);
    return true;
}
export function cancelBotCreationApprovalsFor(botId) {
    for (const [requestId, pending] of [...pendingCreations]) {
        if (pending.fromBotId !== botId)
            continue;
        pendingCreations.delete(requestId);
        clearTimeout(pending.timer);
        settleCard(pending, "deny", true);
        pending.resolve("deny");
    }
}
export function dismissStaleBotCreationCards(bus) {
    let dismissed = 0;
    for (const bot of bus.store.bots) {
        for (const threadId of new Set([bot.threadId, ...(bot.tasks ?? []).map((task) => task.threadId)])) {
            for (const message of bus.store.messagesFor(threadId)) {
                if (message.card?.tool !== "create_bot" || !message.card.requestId || message.card.answered)
                    continue;
                if (pendingCreations.has(message.card.requestId))
                    continue;
                const patched = bus.store.patchMessage(threadId, message.id, {
                    card: { ...message.card, answered: "deny", dismissed: true },
                });
                if (patched)
                    bus.broadcast({ kind: "message.patch", threadId, message: patched });
                dismissed += 1;
            }
        }
    }
    return dismissed;
}
export function createApprovedBot(bus, request, modelSelection) {
    return bus.store.createBot({ ...request, modelSelection });
}
